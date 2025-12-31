import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { SocketService } from './socket.service';
import {
  Conversation,
  ConversationSchema,
} from './schemas/conversation.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { Nickname, NicknameSchema } from './schemas/nickname.schema';
import {
  ConversationSettings,
  ConversationSettingsSchema,
} from './schemas/conversation-settings.schema';

// RabbitMQ Client provider factory
const notificationClientFactory = {
  provide: 'NOTIFICATION_SERVICE',
  useFactory: () => {
    return ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
        queue: 'notification_queue',
        queueOptions: {
          durable: true,
        },
      },
    });
  },
};

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Nickname.name, schema: NicknameSchema },
      { name: ConversationSettings.name, schema: ConversationSettingsSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'supersecret_access',
      signOptions: { expiresIn: '15m' },
    }),
    HttpModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    SocketService,
    ChatGateway,
    notificationClientFactory, // RabbitMQ Client for notifications
  ],
  exports: [ChatService, SocketService],
})
export class ChatModule {}
