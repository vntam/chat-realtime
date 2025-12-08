import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error?: string;
  traceId?: string;
  details?: any;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        error = (exceptionResponse as any).error || exception.name;
        details = (exceptionResponse as any).details;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;

      // Log stack trace for non-HTTP exceptions
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
      traceId: request.headers['x-trace-id'] as string,
      ...(details && { details }),
    };

    // Log error with context
    const logContext = {
      statusCode: status,
      method: request.method,
      path: request.url,
      userId: (request as any).user?.sub,
      traceId: request.headers['x-trace-id'],
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    };

    const statusNum = Number(status);
    if (statusNum >= 500) {
      this.logger.error(
        `${request.method} ${String(request.url)} - ${Array.isArray(message) ? message.join(', ') : message}`,
        JSON.stringify(logContext),
      );
    } else if (statusNum >= 400) {
      this.logger.warn(
        `${request.method} ${String(request.url)} - ${Array.isArray(message) ? message.join(', ') : message}`,
        JSON.stringify(logContext),
      );
    }

    response.status(status).json(errorResponse);
  }
}
