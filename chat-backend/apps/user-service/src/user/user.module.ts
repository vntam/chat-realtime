import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { User } from './user.entity';
import { UserRole } from '../role/user-role.entity';

import { UsersService } from './user.service';
import { UsersController } from './user.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserRole]),
    EventEmitterModule.forRoot(),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UserModule {}
