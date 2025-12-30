import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';

import { User } from './user.entity';
import { UserRole } from '../role/user-role.entity';

import { UsersService } from './user.service';
import { UsersController } from './user.controller';

// RabbitMQ Client provider factory for emitting user update events
const userEventClientFactory = {
  provide: 'USER_EVENT_CLIENT',
  useFactory: () => {
    return ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
        queue: 'user_events_queue',
        queueOptions: {
          durable: true,
        },
      },
    });
  },
};

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRole])],
  controllers: [UsersController],
  providers: [UsersService, userEventClientFactory],
  exports: [UsersService, TypeOrmModule],
})
export class UserModule {}
