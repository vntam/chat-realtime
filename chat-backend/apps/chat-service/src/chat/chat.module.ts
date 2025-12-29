import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Nickname.name, schema: NicknameSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'supersecret_access',
      signOptions: { expiresIn: '15m' },
    }),
    // TEMPORARILY DISABLED: RabbitMQ client for async events to Notification Service
    // This may be causing HTTP routes to timeout on Render
    // ClientsModule.register([
    //   {
    //     name: 'NOTIFICATION_SERVICE',
    //     transport: Transport.RMQ,
    //     options: {
    //       urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
    //       queue: 'notification_queue',
    //       queueOptions: {
    //         durable: true,
    //       },
    //     },
    //   },
    // ]),
    // NOTE: All service communication via HTTP through API Gateway
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, SocketService],
  exports: [ChatService, SocketService],
})
export class ChatModule {}
