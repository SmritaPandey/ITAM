import { NestFactory } from '@nestjs/core';
import { v4 as uuidv4 } from 'uuid';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { SanitizePipe } from './common/pipes/sanitize.pipe';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug'],
  });

  // Graceful shutdown — flush DB connections, close sockets
  app.enableShutdownHooks();

  // Request body size limits — prevent OOM via large payloads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Security
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // allow API calls from web app
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }));

  // Request ID for tracing
  app.use((req: any, res: any, next: any) => {
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-Id', req.id);
    next();
  });

  // Additional security headers
  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0'); // Modern browsers: CSP is preferred
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.removeHeader('X-Powered-By');
    next();
  });
  app.use(compression());
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
      : ['http://localhost:3000', 'http://localhost:3100', 'https://qsasset.com', 'https://www.qsasset.com', 'https://qsasset.vercel.app'],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new SanitizePipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global exception filter — safe error responses
  app.useGlobalFilters(new AllExceptionsFilter(), new PrismaExceptionFilter(), new GlobalExceptionFilter());

  // Swagger API docs (disabled in production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('QS Asset Management API')
      .setDescription('Enterprise IT Asset Monitoring, Management & Security Platform — API Reference')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addServer(process.env.NODE_ENV === 'production' ? 'https://api.qsasset.com' : `http://localhost:${process.env.PORT || 4100}`)
      .addTag('auth', 'Authentication & authorization')
      .addTag('assets', 'Asset management & CMDB')
      .addTag('tickets', 'ITSM ticketing')
      .addTag('users', 'User management')
      .addTag('monitoring', 'Network, CCTV & VDI monitoring')
      .addTag('scanning', 'Security & vulnerability scanning')
      .addTag('reports', 'Reports & analytics')
      .addTag('health', 'System health checks')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 4100;
  await app.listen(port);
  logger.log(`🚀 QS Asset Management API running on http://localhost:${port}`);
  logger.log(`📚 API Docs at http://localhost:${port}/api/docs`);

  // Hard deadline so hung onModuleDestroy hooks cannot leave a zombie process
  // that still accepts HTTP after Prisma has disconnected (login hangs forever).
  const SHUTDOWN_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '15000', 10);
  const forceExit = (signal: string) => {
    logger.warn(`${signal} received — forcing exit in ${SHUTDOWN_MS}ms if shutdown hangs`);
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing process.exit(1)');
      process.exit(1);
    }, SHUTDOWN_MS).unref();
  };
  process.once('SIGTERM', () => forceExit('SIGTERM'));
  process.once('SIGINT', () => forceExit('SIGINT'));

  // Handle uncaught exceptions gracefully
  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Rejection: ${reason}`);
  });
}
bootstrap();
