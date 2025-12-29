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
  ],
  controllers: [ChatController],
  providers: [ChatService, SocketService, ChatGateway],
  exports: [ChatService, SocketService],
})
export class ChatModule {}
