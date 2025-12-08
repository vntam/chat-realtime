// file: libs/common/src/guards/auth.guard.ts

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, Observable, tap, of, switchMap } from 'rxjs';

// 1. Import cái Key bí mật từ file decorator bạn vừa tạo
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector, // <-- Dùng để đọc @Public
    @Inject('USER_SERVICE') private readonly userService: ClientProxy, // <-- Gọi sang User Service
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // --- BƯỚC 1: CHECK PUBLIC ---
    // Kiểm tra xem Handler (hàm) hoặc Class (controller) có gắn @Public không
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Nếu có @Public -> Cho qua luôn (return true)
    if (isPublic) {
      return true;
    }

    // --- BƯỚC 2: CHECK TOKEN (Nếu không Public) ---
    const request = context.switchToHttp().getRequest();
    // Try to get token from Authorization header first, then from cookie
    const token =
      this.extractTokenFromHeader(request) ||
      this.extractTokenFromCookie(request);

    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    // --- BƯỚC 3: GỌI SANG USER-SERVICE ---
    // Gửi message 'validate_token' sang User Service để check
    return this.userService.send({ cmd: 'validate_token' }, { token }).pipe(
      tap((userData) => {
        // Nếu token đúng, User Service trả về thông tin user
        // Ta gắn user vào request để các controller sau dùng được
        context.switchToHttp().getRequest().user = userData;
      }),
      switchMap(() => of(true)), // Hợp lệ -> return true
      catchError(() => {
        throw new UnauthorizedException('Invalid Token'); // Lỗi -> return false/Throw
      }),
    );
  }

  // Hàm phụ: Lấy token từ header "Authorization: Bearer ..."
  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader: string | undefined = request.headers.authorization;
    if (!authHeader) return undefined;

    const parts: string[] = authHeader.split(' ');
    if (parts[0] !== 'Bearer' || !parts[1]) return undefined;

    return parts[1];
  }

  // Hàm phụ: Lấy token từ cookie "accessToken"
  private extractTokenFromCookie(request: any): string | undefined {
    return request.cookies?.accessToken as string | undefined;
  }
}
