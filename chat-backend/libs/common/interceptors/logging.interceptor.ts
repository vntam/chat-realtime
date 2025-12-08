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

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
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
