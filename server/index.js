import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { configDotenv } from "dotenv";
import hardwarerouter from "./router/hardware.route.js";
import authrouter from "./router/auth.route.js";
import softwarerouter from "./router/software.route.js";
import alertsrouter from "./router/alerts.route.js";
import ticketrouter from "./router/ticket.route.js";
import telemetryrouter from "./router/telemetry.route.js";
import superadminrouter from "./router/superadmin.route.js";
import scannerrouter from "./router/scanner.route.js";
import backuprouter from "./router/backup.route.js";
import exportrouter from "./router/export.route.js";
import auditrouter from "./router/audit.route.js";
import logger, { httpLogger } from "./utils/logger.js";
import { apiLimiter, scannerLimiter } from "./middleware/rateLimiter.js";
import { helmetConfig, mongoSanitizeConfig, securityHeaders } from "./middleware/security.js";
import { swaggerUi, swaggerSpec } from "./config/swagger.js";

const app = express();
configDotenv();

// Create logs directory
import fs from 'fs';
if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs');
}

// Security middleware
app.use(helmetConfig);
app.use(securityHeaders);
app.use(mongoSanitizeConfig);

// HTTP logging
app.use(httpLogger);

// Middleware
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
  "http://localhost:3000",
  "http://localhost:3001"
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'ITAM Enterprise API Documentation'
}));

// Health check endpoint (no rate limiting)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Routes
app.use("/api/hardware", hardwarerouter);
app.use("/api/auth", authrouter);
app.use("/api/software", softwarerouter);
app.use("/api/alerts", alertsrouter);
app.use("/api/tickets", ticketrouter);
app.use("/api/telemetry", telemetryrouter);
app.use("/api/superadmin", superadminrouter);
app.use("/api/scanner", scannerLimiter, scannerrouter);
app.use("/api/backup", backuprouter);
app.use("/api/export", exportrouter);
app.use("/api/audit", auditrouter);

// 404 handler for undefined routes
app.use("*", (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: "Route not found",
    message: `The requested endpoint ${req.originalUrl} does not exist`
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error(`Global error: ${error.message}`, { stack: error.stack });
  res.status(error.status || 500).json({
    success: false,
    error: error.name || "Internal server error",
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : error.message
  });
});
// MongoDB connection URI
const mongoUri = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose
  .connect(mongoUri)
  .then(() => {
    logger.info("Connected to MongoDB successfully");
    logger.info(`Database: ${mongoUri.split('/').pop().split('?')[0]}`);
  })
  .catch((err) => {
    logger.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} signal received: closing HTTP server`);
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
});
