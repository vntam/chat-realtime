import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../user/user.service';
import { TokensService } from '../token/token.service';
import { CreateUserDto, LoginDto, RegisterDto } from '@app/contracts';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokensService: TokensService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp');
    }

    const payload: CreateUserDto = {
      username: dto.username,
      fullName: dto.fullName,
      email: dto.email,
      password: dto.password,
      avatar_url: dto.avatar_url,
      status: dto.status,
    };

    const user = await this.usersService.create(payload);

    const tokens = await this.tokensService.generateAndSaveTokens(user.user_id);

    return {
      msg: 'Register successfully',
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) throw new ForbiddenException('User not found');
    if (user.status && user.status !== 'active') {
      throw new ForbiddenException('User is not active');
    }

    const pwMatch = await bcrypt.compare(dto.password, user.password_hash);
    if (!pwMatch) throw new ForbiddenException('Password incorrect');

    const tokens = await this.tokensService.generateAndSaveTokens(user.user_id);

    return {
      msg: 'Login successfully',
      ...tokens,
    };
  }

  async refreshTokens(userId: number, refreshToken: string) {
    const tokenRecord = await this.tokensService.findByUserId(userId);

    if (!tokenRecord) throw new ForbiddenException('Refresh token not found');
    if (tokenRecord.expired_at <= new Date())
      throw new ForbiddenException('Refresh token expired');

    const isMatch = await bcrypt.compare(
      refreshToken,
      tokenRecord.refresh_token,
    );

    if (!isMatch) throw new ForbiddenException('Invalid refresh token');

    const newTokens = await this.tokensService.generateAndSaveTokens(userId);

    return {
      msg: 'Tokens refreshed',
      ...newTokens,
    };
  }

  async logout(userId: number) {
    await this.tokensService.deleteByUserId(userId);
    return { msg: 'Logout successfully' };
  }

  /**
   * Rotate refresh token (one-time use)
   * Phát hiện token reuse và revoke nếu phát hiện tấn công
   */
  async rotateRefreshToken(incomingRefreshToken: string) {
    // Verify và extract userId từ refresh token
    let payload: { sub: number };
    try {
      payload = this.jwtService.verify(incomingRefreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new ForbiddenException('Invalid refresh token');
    }

    const userId = payload.sub;
    const tokenRecord = await this.tokensService.findByUserId(userId);

    if (!tokenRecord) {
      throw new ForbiddenException('Refresh token not found');
    }

    // Check expiration
    if (tokenRecord.expired_at <= new Date()) {
      throw new ForbiddenException('Refresh token expired');
    }

    // So sánh với hash trong DB
    const isMatch = await bcrypt.compare(
      incomingRefreshToken,
      tokenRecord.refresh_token,
    );

    if (!isMatch) {
      // ⚠️ Token reuse detected - có thể bị tấn công!
      // Revoke toàn bộ tokens của user này
      await this.tokensService.deleteByUserId(userId);
      throw new ForbiddenException(
        'Invalid or reused refresh token. All sessions revoked.',
      );
    }

    // ✅ Valid - tạo cặp token mới và rotate
    const newTokens = await this.tokensService.generateAndSaveTokens(userId);

    return {
      msg: 'Tokens refreshed',
      userId,
      ...newTokens,
    };
  }
}
