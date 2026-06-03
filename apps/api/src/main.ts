import { NestFactory } from '@nestjs/core';
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
  app.use(helmet());
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
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global exception filter — safe error responses
  app.useGlobalFilters(new AllExceptionsFilter(), new PrismaExceptionFilter(), new GlobalExceptionFilter());

  // Swagger API docs
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

  const port = process.env.PORT || 4100;
  await app.listen(port);
  logger.log(`🚀 QS Asset Management API running on http://localhost:${port}`);
  logger.log(`📚 API Docs at http://localhost:${port}/api/docs`);

  // Handle uncaught exceptions gracefully
  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Rejection: ${reason}`);
  });
}
bootstrap();
