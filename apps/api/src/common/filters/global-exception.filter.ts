import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException,
  HttpStatus, Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

/**
 * Global exception filter — catches ALL unhandled errors and returns
 * safe, consistent JSON responses. Never leaks stack traces to clients.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object') {
        const obj = exResponse as any;
        message = obj.message || message;
        error = obj.error || error;
        // Handle ValidationPipe array messages
        if (Array.isArray(message)) {
          message = message.join('; ');
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      // Log full stack in production for debugging
      this.logger.error(
        `${request.method} ${request.url} — ${exception.message}`,
        exception.stack,
      );
    }

    // Don't log 4xx as errors
    if (status >= 500) {
      this.logger.error(`[${status}] ${request.method} ${request.url} — ${message}`);
    }

    // Check for specific error types
    if (exception instanceof Error) {
      // Prisma connection errors
      if (exception.message.includes('ECONNREFUSED') || exception.message.includes('P1001')) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Database is temporarily unavailable';
        error = 'Service Unavailable';
      }
      // Payload too large
      if (exception.message.includes('PayloadTooLargeError') || exception.message.includes('request entity too large')) {
        status = HttpStatus.PAYLOAD_TOO_LARGE;
        message = 'Request payload exceeds the maximum allowed size (10MB)';
        error = 'Payload Too Large';
      }
      // Out of memory safety
      if (exception.message.includes('ENOMEM') || exception.message.includes('allocation failed')) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Server is under heavy load. Please try again later.';
        error = 'Service Unavailable';
      }
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
