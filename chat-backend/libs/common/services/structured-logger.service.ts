import {
  Injectable,
  Logger as NestLogger,
  LoggerService,
} from '@nestjs/common';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

export interface LogContext {
  traceId?: string;
  userId?: number;
  service?: string;
  action?: string;
  duration?: number;
  [key: string]: any;
}

@Injectable()
export class StructuredLogger implements LoggerService {
  private readonly logger: NestLogger;
  private readonly serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.logger = new NestLogger(serviceName);
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      service: this.serviceName,
      message,
      ...context,
    };

    // In production, you might want to use JSON format for log aggregation
    if (process.env.NODE_ENV === 'production') {
      return JSON.stringify(logEntry);
    }

    // Development: human-readable format
    return message;
  }

  log(message: string, context?: LogContext) {
    const formattedMessage = this.formatMessage(
      LogLevel.INFO,
      message,
      context,
    );
    this.logger.log(
      formattedMessage,
      context ? JSON.stringify(context) : undefined,
    );
  }

  error(message: string, trace?: string, context?: LogContext) {
    const formattedMessage = this.formatMessage(
      LogLevel.ERROR,
      message,
      context,
    );
    this.logger.error(
      formattedMessage,
      trace,
      context ? JSON.stringify(context) : undefined,
    );
  }

  warn(message: string, context?: LogContext) {
    const formattedMessage = this.formatMessage(
      LogLevel.WARN,
      message,
      context,
    );
    this.logger.warn(
      formattedMessage,
      context ? JSON.stringify(context) : undefined,
    );
  }

  debug(message: string, context?: LogContext) {
    const formattedMessage = this.formatMessage(
      LogLevel.DEBUG,
      message,
      context,
    );
    this.logger.debug(
      formattedMessage,
      context ? JSON.stringify(context) : undefined,
    );
  }

  verbose(message: string, context?: LogContext) {
    const formattedMessage = this.formatMessage(
      LogLevel.VERBOSE,
      message,
      context,
    );
    this.logger.verbose(
      formattedMessage,
      context ? JSON.stringify(context) : undefined,
    );
  }

  // Business-specific logging methods
  logUserAction(action: string, userId: number, details?: Record<string, any>) {
    this.log(`User action: ${action}`, {
      action,
      userId,
      ...(details || {}),
    });
  }

  logApiCall(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    userId?: number,
  ) {
    this.log(`API: ${method} ${url} ${statusCode} - ${duration}ms`, {
      method,
      url,
      statusCode,
      duration,
      userId,
    });
  }

  logDatabaseQuery(query: string, duration: number, error?: string) {
    if (error) {
      this.error(`DB Query failed: ${error}`, undefined, {
        query: query.substring(0, 200),
        duration,
        error,
      });
    } else {
      this.debug(`DB Query: ${duration}ms`, {
        query: query.substring(0, 200),
        duration,
      });
    }
  }

  logWebSocketEvent(
    event: string,
    userId?: number,
    details?: Record<string, any>,
  ) {
    this.log(`WebSocket: ${event}`, {
      event,
      userId,
      ...(details || {}),
    });
  }

  logExternalServiceCall(
    service: string,
    method: string,
    duration: number,
    success: boolean,
  ) {
    const message = `External: ${service}.${method} ${success ? 'SUCCESS' : 'FAILED'} - ${duration}ms`;

    if (success) {
      this.log(message, { service, method, duration, success });
    } else {
      this.warn(message, { service, method, duration, success });
    }
  }
}
