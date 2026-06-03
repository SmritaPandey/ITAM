import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('PrismaExceptionFilter');

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected database error occurred';

    switch (exception.code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[])?.join(', ') || 'field';
        message = `A record with this ${target} already exists`;
        break;
      }
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'The requested record was not found';
        break;
      case 'P2003': {
        status = HttpStatus.BAD_REQUEST;
        message = 'A related record was not found. Check your references.';
        break;
      }
      case 'P2014':
        status = HttpStatus.BAD_REQUEST;
        message = 'This operation would violate a required relation';
        break;
      default:
        this.logger.error(`Unhandled Prisma error ${exception.code}: ${exception.message}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status],
    });
  }
}
