import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SocketService } from './socket.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly socketService: SocketService,
  ) {}

  @Get()
  async getConversations(@Request() req) {
    try {
      const userId = req.user?.sub || req.user?.userId;
      if (!userId) {
        throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
      }
      return await this.chatService.findConversationsByUser(userId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch conversations',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getConversationById(@Param('id') id: string, @Request() req) {
    try {
      return await this.chatService.findConversationById(id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Conversation not found',
        error.status || HttpStatus.NOT_FOUND,
      );
    }
  }

  @Post()
  async createConversation(@Body() body: any, @Request() req) {
    try {
      const userId = req.user?.sub || req.user?.userId;
      if (!userId) {
        throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
      }

      const { participantIds, isGroup, name, avatar } = body;

      // Validate input
      if (!Array.isArray(participantIds) || participantIds.length === 0) {
        throw new HttpException(
          'participantIds must be a non-empty array',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Convert to numbers
      const participants = participantIds.map((id) => Number(id));

      const dto = {
        type: isGroup ? 'group' : 'private',
        participants,
        name: name || undefined,
        avatar: avatar || undefined,
      };

      const conversation = await this.chatService.createConversation(dto, userId);

      // Emit WebSocket event to all participants for realtime update
      this.socketService.emitConversationCreated(conversation);

      return conversation;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create conversation',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/messages')
  async getMessages(@Param('id') conversationId: string, @Request() req) {
    try {
      console.log('[ChatController] getMessages endpoint called - conversationId:', conversationId);
      const userId = req.user?.sub || req.user?.userId;
      console.log('[ChatController] userId from token:', userId);
      const messages = await this.chatService.getMessages(conversationId, userId);
      console.log('[ChatController] Returning messages to frontend - count:', messages.length);
      return messages;
    } catch (error) {
      console.error('[ChatController] getMessages error:', error);
      throw new HttpException(
        error.message || 'Failed to fetch messages',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('messages')
  async sendMessage(@Body() body: any, @Request() req) {
    try {
      const userId = req.user?.sub || req.user?.userId;
      const { conversationId, content, attachments } = body;

      if (!conversationId || !content) {
        throw new HttpException(
          'conversationId and content are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const dto = {
        content,
        attachments: attachments || [],
      };

      return await this.chatService.sendMessage(conversationId, dto, userId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to send message',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async deleteConversation(@Param('id') id: string, @Request() req) {
    try {
      const userId = req.user?.sub || req.user?.userId;
      await this.chatService.deleteConversation(id, userId);
      return { message: 'Conversation deleted successfully' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete conversation',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/accept')
  async acceptConversation(@Param('id') id: string, @Request() req) {
    try {
      const userId = req.user?.sub || req.user?.userId;
      if (!userId) {
        throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
      }
      return await this.chatService.acceptMessageRequest(id, userId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to accept conversation',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Nickname endpoints
  @Post(':id/nicknames')
  async setNickname(
    @Param('id') conversationId: string,
    @Body() body: { targetUserId: number; nickname: string },
    @Request() req,
  ) {
    try {
      const userId = req.user?.sub || req.user?.userId;
      if (!userId) {
        throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
      }
      const result = await this.chatService.setNickname(
        conversationId,
        userId,
        body.targetUserId,
        body.nickname,
      );

      // Get conversation to find all participants
      const conversation = await this.chatService.findConversationById(conversationId);

      // Emit WebSocket event to all conversation members AND the owner's personal room
      // This ensures all users in the conversation see the updated nickname
      const server = this.socketService.getServer();
      if (server) {
        // Emit to conversation room (for all members currently viewing this conversation)
        server.to(`conversation:${conversationId}`).emit('nickname:updated', {
          conversationId,
          targetUserId: body.targetUserId,
          nickname: body.nickname,
          userId,
        });

        // Also emit to owner's personal room (for real-time update even if not viewing conversation)
        server.to(`user:${userId}`).emit('nickname:updated', {
          conversationId,
          targetUserId: body.targetUserId,
          nickname: body.nickname,
          userId,
        });
      }

      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to set nickname',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id/nicknames/:targetUserId')
  async removeNickname(
    @Param('id') conversationId: string,
    @Param('targetUserId') targetUserId: string,
    @Request() req,
  ) {
    try {
      const userId = req.user?.sub || req.user?.userId;
      if (!userId) {
        throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
      }
      const targetUserIdNum = parseInt(targetUserId);
      await this.chatService.removeNickname(conversationId, userId, targetUserIdNum);

      // Get conversation to find all participants
      const conversation = await this.chatService.findConversationById(conversationId);

      // Emit WebSocket event to all conversation members AND the owner's personal room
      const server = this.socketService.getServer();
      if (server) {
        // Emit to conversation room
        server.to(`conversation:${conversationId}`).emit('nickname:updated', {
          conversationId,
          targetUserId: targetUserIdNum,
          nickname: null, // null indicates nickname removed
          userId,
        });

        // Also emit to owner's personal room
        server.to(`user:${userId}`).emit('nickname:updated', {
          conversationId,
          targetUserId: targetUserIdNum,
          nickname: null,
          userId,
        });
      }

      return { message: 'Nickname removed successfully' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to remove nickname',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/nicknames')
  async getNicknames(@Param('id') conversationId: string, @Request() req) {
    try {
      const userId = req.user?.sub || req.user?.userId;
      if (!userId) {
        throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
      }
      return await this.chatService.getNicknames(conversationId, userId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get nicknames',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
