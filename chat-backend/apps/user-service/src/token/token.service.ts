import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Token } from './token.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TokensService {
  constructor(
    @InjectRepository(Token) private repo: Repository<Token>,
    private readonly jwt: JwtService,
  ) {}

  async generateTokens(userId: number) {
    const payload = { sub: userId };

    // Access token expires in 30 days (longer for better UX)
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '30d',
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '30d',
    });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    return { accessToken, refreshToken, expiresAt };
  }

  async generateAndSaveTokens(userId: number) {
    const { accessToken, refreshToken, expiresAt } =
      await this.generateTokens(userId);

    const hashedRt = await bcrypt.hash(refreshToken, 10);

    let token = await this.repo.findOne({ where: { user_id: userId } });

    if (!token) {
      token = this.repo.create({
        user_id: userId,
        access_token: accessToken,
        refresh_token: hashedRt,
        expired_at: expiresAt,
      });
    } else {
      token.access_token = accessToken;
      token.refresh_token = hashedRt;
      token.expired_at = expiresAt;
    }

    await this.repo.save(token);

    return { accessToken, refreshToken };
  }

  async findByUserId(userId: number) {
    return this.repo.findOne({ where: { user_id: userId } });
  }

  async deleteByUserId(userId: number) {
    return this.repo.delete({ user_id: userId });
  }
}
