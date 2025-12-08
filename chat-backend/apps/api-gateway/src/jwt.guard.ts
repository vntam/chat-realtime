import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: number;
  email: string;
  roles?: string[];
  iat: number;
  exp: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      id?: string; // trace-id
    }
  }
}

@Injectable()
export class JwtGuard implements CanActivate {
  private readonly logger = new Logger(JwtGuard.name);
  private readonly publicPaths = [
    '/auth/register',
    '/auth/login',
    '/auth/refresh',
    '/health',
  ];

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;

    // Check public paths
    if (this.publicPaths.some((p) => path.startsWith(p))) {
      return true;
    }

    const token = this.extractToken(request);
    if (!token) {
      this.logger.warn(
        `[${request.id}] No token provided for ${request.method} ${path}`,
      );
      throw new UnauthorizedException('Missing authorization token');
    }

    try {
      const secret = process.env.JWT_ACCESS_SECRET || 'your-secret-key';
      const payload = jwt.verify(token, secret) as unknown as JwtPayload;
      request.user = payload;
      this.logger.debug(`[${request.id}] JWT verified for user ${payload.sub}`);
      return true;
    } catch (error) {
      this.logger.warn(
        `[${request.id}] JWT verification failed: ${error?.message}`,
      );
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;

    const [scheme, token] = authHeader.split(' ');
    return scheme?.toLowerCase() === 'bearer' ? token : null;
  }
}
