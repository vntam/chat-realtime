import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from '@app/common';

/**
 * Metrics Interceptor - Track HTTP requests in API Gateway
 *
 * Tracks:
 * - Total HTTP requests by method, path, status
 * - Request duration
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startTime;

          // Track metrics
          this.metricsService.trackHttpRequest(
            request.method as string,
            this.sanitizePath(request.path as string),
            response.statusCode as number,
            duration,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          // Track error metrics
          this.metricsService.trackHttpRequest(
            request.method as string,
            this.sanitizePath(request.path as string),
            statusCode as number,
            duration,
          );
        },
      }),
    );
  }

  /**
   * Sanitize path to avoid high cardinality
   * Replace dynamic IDs with placeholders
   */
  private sanitizePath(path: string): string {
    return path
      .replace(/\/[0-9a-f]{24}/gi, '/:id') // MongoDB ObjectID
      .replace(/\/\d+/g, '/:id') // Numeric IDs
      .replace(/\/[0-9a-f-]{36}/gi, '/:uuid'); // UUIDs
  }
}
