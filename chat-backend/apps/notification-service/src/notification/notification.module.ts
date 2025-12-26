import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { NotificationController } from './notification.controller';
import { NotificationRabbitMQController } from './notification-rabbitmq.controller';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'supersecret_access',
      signOptions: { expiresIn: '15m' },
    }),
    HttpModule,
  ],
  controllers: [NotificationController, NotificationRabbitMQController],
  providers: [NotificationService, NotificationGateway],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationModule {}
