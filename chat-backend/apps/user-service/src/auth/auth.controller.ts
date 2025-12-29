import { Controller, Post, Body, Req, UseGuards, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from '@app/contracts';
import { Public } from '@app/common';
import { JwtGuard } from './guards/jwt/jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    this.setRefreshCookie(res, result.refreshToken);
    this.setAccessCookie(res, result.accessToken);
    return {
      msg: result.msg,
      accessToken: result.accessToken,
    };
  }

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(res, result.refreshToken);
    this.setAccessCookie(res, result.accessToken);
    return {
      msg: result.msg,
      accessToken: result.accessToken,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const incomingRefreshToken = req.cookies?.refreshToken as string;
    if (!incomingRefreshToken) {
      throw new Error('Refresh token not found in cookie');
    }

    const result =
      await this.authService.rotateRefreshToken(incomingRefreshToken);
    this.setRefreshCookie(res, result.refreshToken);
    this.setAccessCookie(res, result.accessToken);

    return {
      msg: result.msg,
      accessToken: result.accessToken,
    };
  }

  @UseGuards(JwtGuard)
  @Post('logout')
  async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
    const userId = req.user?.sub as number;
    const result = await this.authService.logout(userId);
    this.clearRefreshCookie(res);
    this.clearAccessCookie(res);
    return result;
  }

  /**
   * Helper: Set httpOnly cookie cho refresh token
   */
  private setRefreshCookie(res: Response, token: string) {
    // Use COOKIE_SECURE env var (default to true in production, but can be overridden)
    const secure = process.env.COOKIE_SECURE === 'false' ? false : process.env.NODE_ENV === 'production';

    res.cookie('refreshToken', token, {
      httpOnly: true, // Không thể đọc bằng JavaScript
      secure, // Chỉ HTTPS khi COOKIE_SECURE=true (production default)
      sameSite: 'lax', // Allow cookies across ports in dev
      path: '/auth', // Chỉ gửi cho auth endpoints
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });
  }

  /**
   * Helper: Set httpOnly cookie cho access token
   */
  private setAccessCookie(res: Response, token: string) {
    // Use COOKIE_SECURE env var (default to true in production, but can be overridden)
    const secure = process.env.COOKIE_SECURE === 'false' ? false : process.env.NODE_ENV === 'production';

    res.cookie('accessToken', token, {
      httpOnly: true, // Không thể đọc bằng JavaScript
      secure, // Chỉ HTTPS khi COOKIE_SECURE=true (production default)
      sameSite: 'lax', // Allow cookies across ports in dev (strict blocks localhost:3001 -> localhost:3002)
      path: '/', // Send to all paths/services
      maxAge: 15 * 60 * 1000, // 15 phút (same as JWT expiry)
    });
  }

  /**
   * Helper: Xóa refresh token cookie
   */
  private clearRefreshCookie(res: Response) {
    res.clearCookie('refreshToken', { path: '/auth' });
  }

  /**
   * Helper: Xóa access token cookie
   */
  private clearAccessCookie(res: Response) {
    res.clearCookie('accessToken');
  }
}
