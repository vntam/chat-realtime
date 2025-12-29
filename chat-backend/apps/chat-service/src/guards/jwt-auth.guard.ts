import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    this.logger.log('[JwtAuthGuard] canActivate called');
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    this.logger.log('[JwtAuthGuard] Token extracted: ' + (token ? 'yes' : 'no'));
    this.logger.log('[JwtAuthGuard] Authorization header: ' + (request.headers?.authorization ? 'present' : 'missing'));
    this.logger.log('[JwtAuthGuard] Cookies: ' + (request.cookies ? JSON.stringify(Object.keys(request.cookies)) : 'none'));

    if (!token) {
      this.logger.warn('[JwtAuthGuard] No token provided, throwing UnauthorizedException');
      throw new UnauthorizedException('No token provided');
    }

    try {
      this.logger.log('[JwtAuthGuard] Verifying token...');
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'supersecret_access',
      });

      this.logger.log('[JwtAuthGuard] Token verified, user_id: ' + payload.sub);

      // Attach user to request
      request.user = payload;
      return true;
    } catch (error) {
      this.logger.error('[JwtAuthGuard] Token verification failed: ' + error.message);
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractToken(request: any): string | undefined {
    // Try to extract from Authorization header first
    const authorization = request.headers?.authorization;
    if (authorization) {
      const [type, token] = authorization.split(' ');
      if (type === 'Bearer' && token) return token;
    }

    // Fallback to cookie (httpOnly cookie)
    const cookieToken = request.cookies?.accessToken;
    if (cookieToken) return cookieToken;

    return undefined;
  }
}
