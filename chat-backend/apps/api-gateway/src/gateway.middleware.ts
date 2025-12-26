import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RateLimiterService } from './rate-limiter.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GatewayMiddleware implements NestMiddleware {
  private readonly logger = new Logger(GatewayMiddleware.name);

  constructor(private readonly rateLimiter: RateLimiterService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // 1. Assign trace-id
    const traceId: string = (req.headers['x-trace-id'] as string) || uuidv4();
    req.id = traceId;
    res.setHeader('x-trace-id', traceId);

    // 2. Extract IP
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    // 3. Rate limit per IP
    if (!this.rateLimiter.isAllowed(ip)) {
      this.logger.warn(`[${req.id}] Rate limit exceeded for IP ${ip}`);
      const remaining = this.rateLimiter.getRemainingTime(ip);
      res.setHeader('retry-after', Math.ceil(remaining / 1000));
      throw new HttpException(
        `Rate limit exceeded. Retry after ${Math.ceil(remaining / 1000)}s`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 4. Log request
    this.logger.debug(`[${req.id}] ${req.method} ${req.path} from ${ip}`);

    // 5. Log response on finish
    res.on('finish', () => {
      this.logger.debug(
        `[${req.id}] ${res.statusCode} (${Date.now() - (req as any).startTime}ms)`,
      );
    });

    (req as any).startTime = Date.now();
    (req as any).clientIp = ip; // Use clientIp instead of ip (ip is read-only)

    next();
  }
}
