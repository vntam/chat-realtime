import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { Token } from './token.entity';
import { TokensService } from './token.service';

@Module({
  imports: [TypeOrmModule.forFeature([Token]), JwtModule.register({})],
  providers: [TokensService],
  exports: [TokensService, TypeOrmModule],
})
export class TokenModule {}
