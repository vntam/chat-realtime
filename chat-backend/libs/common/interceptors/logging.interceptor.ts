import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  private readonly microserviceLogger = new Logger('Microservice');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Check if this is a microservice context (RabbitMQ, TCP, etc.)
    const isMicroservice = context.getType() === 'rpc';

    if (isMicroservice) {
      return this.interceptMicroservice(context, next);
    }

    return this.interceptHttp(context, next);
  }

  private interceptHttp(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, headers, ip } = request;
    const userAgent = headers['user-agent'] || '';
    const userId = request.user?.sub;

    // Generate trace ID if not exists
    const traceId = headers['x-trace-id'] || uuidv4();
    request.headers['x-trace-id'] = traceId;

    const now = Date.now();

    // Log incoming request
    this.logger.log(
      `Incoming: ${method} ${url}`,
      JSON.stringify({
        traceId,
        method,
        url,
        userId,
        ip,
        userAgent: userAgent.substring(0, 100),
        ...(method !== 'GET' && { body: this.sanitizeBody(body) }),
      }),
    );

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const { statusCode } = response;
        const responseTime = Date.now() - now;

        // Log successful response
        this.logger.log(
          `Completed: ${method} ${url} ${statusCode} - ${responseTime}ms`,
          JSON.stringify({
            traceId,
            method,
            url,
            statusCode,
            responseTime,
            userId,
          }),
        );
      }),
      catchError((error) => {
        const responseTime = Date.now() - now;

        // Log error (detailed logging is done in exception filter)
        this.logger.error(
          `Failed: ${method} ${url} - ${responseTime}ms`,
          JSON.stringify({
            traceId,
            method,
            url,
            responseTime,
            userId,
            error: error.message,
          }),
        );

        throw error;
      }),
    );
  }

  private interceptMicroservice(context: ExecutionContext, next: CallHandler): Observable<any> {
    // For microservice context, pattern and args might not be available through standard methods
    // Use reflection to get the pattern if available
    let pattern: any = {};
    let data: any = {};

    try {
      const args = context.getArgs();
      if (args && args.length > 0) {
        // For RabbitMQ events, the pattern is usually in the first argument
        data = args[0] || {};
      }

      // Try to get the pattern from the context handler
      const handler = context.getHandler();
      if (handler) {
        pattern = handler.name || 'unknown';
      }
    } catch (e) {
      // If we can't get pattern/data, just skip logging details
    }

    const now = Date.now();

    // Log incoming microservice event
    this.microserviceLogger.log(
      `Received event: ${JSON.stringify(pattern)}`,
      JSON.stringify({
        pattern,
        data: this.sanitizeBody(data),
      }),
    );

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - now;
        this.microserviceLogger.log(
          `Event processed: ${JSON.stringify(pattern)} - ${responseTime}ms`,
        );
      }),
      catchError((error) => {
        const responseTime = Date.now() - now;
        this.microserviceLogger.error(
          `Event failed: ${JSON.stringify(pattern)} - ${responseTime}ms`,
          error.message,
        );
        throw error;
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return undefined;

    const sanitized = { ...body };
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'accessToken',
      'refreshToken',
    ];

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    });

    return sanitized;
  }
}
