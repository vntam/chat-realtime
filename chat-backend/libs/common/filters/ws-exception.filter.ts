import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Logger,
  HttpException,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

export interface WsErrorResponse {
  event: 'error';
  data: {
    code: string;
    message: string;
    timestamp: string;
    details?: any;
  };
}

@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    // Only handle WebSocket contexts, ignore HTTP requests
    if (host.getType() !== 'ws') {
      return;
    }

    const client = host.switchToWs().getClient<Socket>();
    const data = host.switchToWs().getData();

    let code = 'INTERNAL_ERROR';
    let message = 'An internal error occurred';
    let details: any = undefined;

    if (exception instanceof WsException) {
      const error = exception.getError();
      if (typeof error === 'string') {
        message = error;
      } else if (typeof error === 'object') {
        code = (error as any).code || code;
        message = (error as any).message || message;
        details = (error as any).details;
      }
    } else if (exception instanceof HttpException) {
      const response = exception.getResponse();
      code = exception.name.replace('Exception', '').toUpperCase();
      message =
        typeof response === 'string' ? response : (response as any).message;
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `WebSocket unhandled exception: ${exception.message}`,
        exception.stack,
      );
    }

    const errorResponse: WsErrorResponse = {
      event: 'error',
      data: {
        code,
        message,
        timestamp: new Date().toISOString(),
        ...(details && { details }),
      },
    };

    // Log error with safe serialization
    try {
      const payload =
        data && typeof data === 'object' && !Array.isArray(data)
          ? Object.keys(data as Record<string, any>).filter(
              (k) => k !== 'event',
            )
          : [];

      this.logger.error(
        `WebSocket error [${code}]: ${message}`,
        JSON.stringify({
          userId: (client as any).userId,
          socketId: client.id,
          event:
            data && typeof data === 'object'
              ? (data as Record<string, any>).event
              : undefined,
          payload,
        }),
      );
    } catch (logError) {
      // Fallback if serialization fails
      this.logger.warn(
        `Failed to serialize error context: ${logError instanceof Error ? logError.message : 'Unknown error'}`,
      );
      this.logger.error(
        `WebSocket error [${code}]: ${message}`,
        `userId: ${(client as any).userId}, socketId: ${client.id}`,
      );
    }

    client.emit('error', errorResponse.data);
  }
}
