import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import { ChatService } from './chat.service';
import { SocketService } from './socket.service';
import {
  CreateConversationDto,
  SendMessageDto,
  UpdateMessageDto,
  AddMemberDto,
  MessageSearchDto,
  UpdateMessageStatusDto,
  MarkMessagesAsReadDto,
} from '@app/contracts';
import { MessageStatus } from './schemas/message.schema';
import { MetricsService } from '@app/common';

interface AuthSocket extends Socket {
  userId?: number;
}

interface WsAck {
  ok: boolean;
  data?: any;
  error?: { code: string; message: string };
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly metricsService: MetricsService,
    private readonly socketService: SocketService,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  afterInit(server: Server) {
    // Set the server instance on SocketService so controllers can use it
    this.socketService.setServer(server);
    this.logger.log('WebSocket server initialized and set on SocketService');
  }

  // ============ CONNECTION LIFECYCLE ============

  async handleConnection(client: AuthSocket) {
    try {
      // Extract token from auth or handshake
      const token =
        client.handshake.auth?.token?.replace('Bearer ', '') ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      // Verify JWT and extract user_id
      const payload = await this.jwtService.verifyAsync(token as string, {
        secret: process.env.JWT_ACCESS_SECRET || 'access-secret',
      });

      client.userId = payload.sub;

      // Join user's personal room
      await client.join(`user:${client.userId}`);

      this.logger.log(`Client connected: ${client.id}, user: ${client.userId}`);
    } catch (error) {
      this.logger.error(`Connection failed: ${error.message}`);
      client.emit('error', {
        code: 'AUTH_INVALID',
        message: 'Authentication failed',
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthSocket) {
    this.logger.log(
      `Client disconnected: ${client.id}, user: ${client.userId}`,
    );

    // Update active connections metric
    this.updateActiveConnectionsMetric();
  }

  // ============ HELPER METHODS ============

  /**
   * Update active connections count metric
   */
  private updateActiveConnectionsMetric() {
    if (!this.server?.sockets?.sockets) {
      return;
    }
    const sockets = this.server.sockets.sockets;
    const activeConnections = sockets.size;
    this.metricsService.setActiveConnections(activeConnections);
  }

  private ack(
    ok: boolean,
    data?: any,
    error?: { code: string; message: string },
  ): WsAck {
    return ok ? { ok: true, data } : { ok: false, error };
  }

  private async verifyMembership(
    conversationId: string,
    userId: number,
  ): Promise<boolean> {
    return this.chatService.isParticipant(conversationId, userId);
  }

  // ============ CONVERSATION EVENTS ============

  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<WsAck> {
    try {
      const roomName = `conversation:${payload.conversationId}`
      this.logger.log(`User ${client.userId} attempting to join room: ${roomName}`)

      const isMember = await this.verifyMembership(
        payload.conversationId,
        client.userId!,
      );
      if (!isMember) {
        this.logger.warn(`User ${client.userId} NOT a member of conversation ${payload.conversationId}`)
        return this.ack(false, null, {
          code: 'FORBIDDEN',
          message: 'Not a participant',
        });
      }

      await client.join(roomName);
      this.logger.log(
        `User ${client.userId} joined conversation ${payload.conversationId}, socket room: ${roomName}`,
      );

      return this.ack(true);
    } catch (error) {
      this.logger.error(`Join conversation error: ${error.message}`);
      return this.ack(false, null, {
        code: 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('conversation:leave')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<WsAck> {
    await client.leave(`conversation:${payload.conversationId}`);
    this.logger.log(
      `User ${client.userId} left conversation ${payload.conversationId}`,
    );
    return this.ack(true);
  }

  @SubscribeMessage('conversation:list')
  async handleListConversations(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody()
    payload: {
      limit?: number;
      skip?: number;
    },
  ): Promise<WsAck> {
    try {
      const conversations = await this.chatService.findConversationsByUser(
        client.userId!,
        payload?.limit,
        payload?.skip,
      );
      return this.ack(true, conversations);
    } catch (error) {
      this.logger.error(`List conversations error: ${error.message}`);
      return this.ack(false, null, {
        code: 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('conversation:get')
  async handleGetConversation(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<WsAck> {
    try {
      const conversation = await this.chatService.findConversationById(
        payload.conversationId,
      );
      const isMember = conversation.participants.includes(client.userId!);
      if (!isMember) {
        return this.ack(false, null, {
          code: 'FORBIDDEN',
          message: 'Not a participant',
        });
      }
      return this.ack(true, conversation);
    } catch (error) {
      this.logger.error(`Get conversation error: ${error.message}`);
      return this.ack(false, null, {
        code: error.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('conversation:create')
  async handleCreateConversation(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() dto: CreateConversationDto,
  ): Promise<WsAck> {
    try {
      const conversation = await this.chatService.createConversation(
        dto,
        client.userId!,
      );

      // Join creator to room
      await client.join(`conversation:${conversation._id.toString()}`);

      // Notify all participants
      conversation.participants.forEach((participantId) => {
        this.server.to(`user:${participantId}`).emit('conversation:created', {
          conversationId: conversation._id.toString(),
          conversation,
        });
      });

      return this.ack(true, conversation);
    } catch (error) {
      this.logger.error(`Create conversation error: ${error.message}`);
      return this.ack(false, null, {
        code: 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('conversation:delete')
  async handleDeleteConversation(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<WsAck> {
    try {
      await this.chatService.deleteConversation(
        payload.conversationId,
        client.userId!,
      );

      this.server
        .to(`conversation:${payload.conversationId}`)
        .emit('conversation:deleted', {
          conversationId: payload.conversationId,
        });

      return this.ack(true);
    } catch (error) {
      this.logger.error(`Delete conversation error: ${error.message}`);
      return this.ack(false, null, {
        code: error.status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('conversation:members')
  async handleGetMembers(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<WsAck> {
    try {
      const members = await this.chatService.getConversationMembers(
        payload.conversationId,
        client.userId!,
      );
      return this.ack(true, members);
    } catch (error) {
      this.logger.error(`Get members error: ${error.message}`);
      return this.ack(false, null, {
        code: error.status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('conversation:add-member')
  async handleAddMember(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody()
    payload: { conversationId: string; userId: number; userName?: string; actorName?: string },
  ): Promise<WsAck> {
    try {
      const dto: AddMemberDto = { userId: payload.userId } as AddMemberDto;
      const result = await this.chatService.addMember(
        payload.conversationId,
        dto.userId,
        client.userId!,
        payload.userName,
        payload.actorName,
      );

      // Get conversation details for notification
      const conversation = await this.chatService.findConversationById(
        payload.conversationId,
      );

      // Broadcast system message to all members in the conversation
      if (result.systemMessage) {
        const sysMsg = result.systemMessage;
        this.server
          .to(`conversation:${payload.conversationId}`)
          .emit('message:created', {
            _id: sysMsg._id.toString(),
            sender_id: sysMsg.sender_id,
            content: sysMsg.content,
            type: sysMsg.type,
            system_data: sysMsg.system_data,
            created_at: sysMsg.created_at,
          });
      }

      // Notify all members and the new member via WebSocket
      this.server
        .to(`conversation:${payload.conversationId}`)
        .emit('conversation:member-added', {
          conversationId: payload.conversationId,
          userId: payload.userId,
        });

      this.server.to(`user:${payload.userId}`).emit('conversation:invited', {
        conversationId: payload.conversationId,
        conversation: result.conversation,
      });

      // Send notification via RabbitMQ for offline users
      this.notificationClient.emit('group_invite.created', {
        user_id: payload.userId,
        title: `Lời mời tham gia nhóm`,
        content: `Bạn được thêm vào nhóm "${conversation.name || 'Nhóm chat'}"`,
        related_id: payload.conversationId,
      });

      this.logger.log(
        `Group invite notification sent for user ${payload.userId} to conversation ${payload.conversationId}`,
      );

      return this.ack(true, result.conversation);
    } catch (error) {
      this.logger.error(`Add member error: ${error.message}`);
      return this.ack(false, null, {
        code: error.status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('conversation:remove-member')
  async handleRemoveMember(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody()
    payload: { conversationId: string; userId: number; userName?: string },
  ): Promise<WsAck> {
    try {
      const result = await this.chatService.removeMember(
        payload.conversationId,
        payload.userId,
        client.userId!,
        payload.userName,
      );

      // Broadcast system message to all members in the conversation
      if (result.systemMessage) {
        const sysMsg = result.systemMessage;
        this.server
          .to(`conversation:${payload.conversationId}`)
          .emit('message:created', {
            _id: sysMsg._id.toString(),
            sender_id: sysMsg.sender_id,
            content: sysMsg.content,
            type: sysMsg.type,
            system_data: sysMsg.system_data,
            created_at: sysMsg.created_at,
          });
      }

      this.server
        .to(`conversation:${payload.conversationId}`)
        .emit('conversation:member-removed', {
          conversationId: payload.conversationId,
          userId: payload.userId,
        });

      return this.ack(true, result.conversation);
    } catch (error) {
      this.logger.error(`Remove member error: ${error.message}`);
      return this.ack(false, null, {
        code: error.status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('conversation:promote-moderator')
  async handlePromoteModerator(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody()
    payload: { conversationId: string; userId: number; userName?: string },
  ): Promise<WsAck> {
    try {
      const result = await this.chatService.promoteToModerator(
        payload.conversationId,
        client.userId!,
        payload.userId,
      );

      // Broadcast to all members in the conversation
      this.server
        .to(`conversation:${payload.conversationId}`)
        .emit('conversation:moderator-updated', {
          conversationId: payload.conversationId,
          userId: payload.userId,
          promoted: true,
          actorId: client.userId!,
        });

      return this.ack(true, result);
    } catch (error) {
      this.logger.error(`Promote moderator error: ${error.message}`);
      return this.ack(false, null, {
        code: error.status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('conversation:demote-moderator')
  async handleDemoteModerator(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody()
    payload: { conversationId: string; userId: number },
  ): Promise<WsAck> {
    try {
      const result = await this.chatService.demoteModerator(
        payload.conversationId,
        client.userId!,
        payload.userId,
      );

      // Broadcast to all members in the conversation
      this.server
        .to(`conversation:${payload.conversationId}`)
        .emit('conversation:moderator-updated', {
          conversationId: payload.conversationId,
          userId: payload.userId,
          promoted: false,
          actorId: client.userId!,
        });

      return this.ack(true, result);
    } catch (error) {
      this.logger.error(`Demote moderator error: ${error.message}`);
      return this.ack(false, null, {
        code: error.status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  // ============ MESSAGE EVENTS ============

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody()
    payload: {
      conversationId: string;
      content: string;
      attachments?: string[];
      clientId?: string;
    },
  ): Promise<WsAck> {
    try {
      const dto: SendMessageDto = {
        content: payload.content,
        attachments: payload.attachments,
      };

      const message = await this.chatService.sendMessage(
        payload.conversationId,
        dto,
        client.userId!,
      );

      // Broadcast to all participants in the conversation room AND to all participants' personal rooms
      // This ensures conversation list updates for users who haven't opened the conversation yet
      const roomName = `conversation:${payload.conversationId}`
      this.logger.log(`Broadcasting message:created to room: ${roomName}`)

      // Get conversation to find all participants
      const conversation = await this.chatService.findConversationById(
        payload.conversationId,
      );

      const messageData = {
        _id: message._id.toString(),
        sender_id: message.sender_id,
        conversation_id: message.conversation_id.toString(),
        content: message.content,
        attachments: message.attachments,
        seen_by: message.seen_by,
        created_at: message.created_at,
        clientId: payload.clientId, // Echo back for client deduplication
      };

      // Broadcast to conversation room (for users who have joined)
      this.server.to(roomName).emit('message:created', messageData);

      // Broadcast to all participants' personal rooms (for conversation list updates)
      for (const participantId of conversation.participants) {
        this.server.to(`user:${participantId}`).emit('message:created', messageData);
      }

      this.logger.log(`Message broadcasted: ${message._id} from user ${message.sender_id} to ${conversation.participants.length} participants`)

      // Send notifications to other participants (async, fire and forget)
      this.sendMessageNotifications(
        payload.conversationId,
        message.sender_id,
        message.content,
        message.attachments,
      );

      // Track message sent metric (conversation already fetched above)
      this.metricsService.trackMessageSent(
        conversation.type === 'private' ? 'private' : 'group',
      );

      return this.ack(true, message);
    } catch (error) {
      this.logger.error(`Send message error: ${error.message}`);
      return this.ack(false, null, {
        code: error.status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { messageId: string; content: string },
  ): Promise<WsAck> {
    try {
      const dto: UpdateMessageDto = { content: payload.content };
      const message = await this.chatService.updateMessage(
        payload.messageId,
        dto,
        client.userId!,
      );

      // Broadcast update to conversation room
      this.server
        .to(`conversation:${message.conversation_id.toString()}`)
        .emit('message:updated', {
          _id: message._id.toString(),
          sender_id: message.sender_id,
          content: message.content,
          attachments: message.attachments,
          seen_by: message.seen_by,
          created_at: message.created_at,
        });

      return this.ack(true, message);
    } catch (error) {
      this.logger.error(`Edit message error: ${error.message}`);
      return this.ack(false, null, {
        code: error.status === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('message:list')
  async handleListMessages(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody()
    payload: { conversationId: string; limit?: number; before?: string },
  ): Promise<WsAck> {
    try {
      const messages = await this.chatService.getMessages(
        payload.conversationId,
        client.userId!,
        payload.limit,
        payload.before ? new Date(payload.before) : undefined,
      );
      return this.ack(true, messages);
    } catch (error) {
      this.logger.error(`List messages error: ${error.message}`);
      return this.ack(false, null, {
        code: error.status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('message:search')
  async handleSearchMessages(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: MessageSearchDto,
  ): Promise<WsAck> {
    try {
      const result = await this.chatService.searchMessages(
        payload,
        client.userId!,
      );
      return this.ack(true, result);
    } catch (error) {
      this.logger.error(`Search messages error: ${error.message}`);
      return this.ack(false, null, {
        code: 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('message:status:update')
  async handleUpdateMessageStatus(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody()
    payload: { messageId: string; status: UpdateMessageStatusDto },
  ): Promise<WsAck> {
    try {
      const result = await this.chatService.updateMessageStatus(
        payload.messageId,
        payload.status,
        client.userId!,
      );
      return this.ack(true, result);
    } catch (error) {
      this.logger.error(`Update message status error: ${error.message}`);
      return this.ack(false, null, {
        code: error.status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('message:status:get')
  async handleGetMessageStatus(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { messageId: string },
  ): Promise<WsAck> {
    try {
      const status = await this.chatService.getMessageStatus(
        payload.messageId,
        client.userId!,
      );
      return this.ack(true, status);
    } catch (error) {
      this.logger.error(`Get message status error: ${error.message}`);
      return this.ack(false, null, {
        code: error.status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('message:unread-count')
  async handleUnreadCount(
    @ConnectedSocket() client: AuthSocket,
  ): Promise<WsAck> {
    try {
      const count = await this.chatService.getUnreadCount(client.userId!);
      return this.ack(true, { count });
    } catch (error) {
      this.logger.error(`Unread count error: ${error.message}`);
      return this.ack(false, null, {
        code: 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { messageId: string },
  ): Promise<WsAck> {
    try {
      const message = await this.chatService.findMessageById(payload.messageId);
      const conversationId = message.conversation_id.toString();

      await this.chatService.deleteMessage(payload.messageId, client.userId!);

      // Broadcast deletion
      this.server
        .to(`conversation:${conversationId}`)
        .emit('message:deleted', { messageId: payload.messageId });

      return this.ack(true);
    } catch (error) {
      this.logger.error(`Delete message error: ${error.message}`);
      return this.ack(false, null, {
        code: error.status === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('message:read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { messageId: string },
  ): Promise<WsAck> {
    try {
      const message = await this.chatService.markMessageAsRead(
        payload.messageId,
        client.userId!,
      );

      // Broadcast read receipt with full delivery info
      this.server
        .to(`conversation:${message.conversation_id.toString()}`)
        .emit('message:status', {
          messageId: payload.messageId,
          userId: client.userId!,
          status: MessageStatus.READ,
          timestamp: new Date().toISOString(),
          deliveryInfo: message.delivery_info,
        });

      return this.ack(true);
    } catch (error) {
      this.logger.error(`Mark read error: ${error.message}`);
      return this.ack(false, null, {
        code: 'NOT_FOUND',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('message:delivered')
  async handleMessageDelivered(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { messageId: string },
  ): Promise<WsAck> {
    try {
      const message = await this.chatService.updateMessageStatus(
        payload.messageId,
        { status: MessageStatus.DELIVERED },
        client.userId!,
      );

      // Broadcast delivery status to sender
      this.server.to(`user:${message.sender_id}`).emit('message:status', {
        messageId: payload.messageId,
        userId: client.userId!,
        status: MessageStatus.DELIVERED,
        timestamp: new Date().toISOString(),
        deliveryInfo: message.delivery_info,
      });

      return this.ack(true);
    } catch (error) {
      this.logger.error(`Mark delivered error: ${error.message}`);
      return this.ack(false, null, {
        code: 'UPDATE_FAILED',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('messages:mark-read')
  async handleMarkMultipleRead(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: MarkMessagesAsReadDto,
  ): Promise<WsAck> {
    try {
      await this.chatService.markMessagesAsRead(payload, client.userId!);

      // Broadcast to all conversations affected
      for (const messageId of payload.messageIds) {
        try {
          const message = await this.chatService.findMessageById(messageId);
          this.server
            .to(`conversation:${message.conversation_id.toString()}`)
            .emit('message:status', {
              messageId,
              userId: client.userId!,
              status: MessageStatus.READ,
              timestamp: new Date().toISOString(),
            });
        } catch {
          // Skip invalid message IDs
          continue;
        }
      }

      return this.ack(true);
    } catch (error) {
      this.logger.error(`Mark multiple read error: ${error.message}`);
      return this.ack(false, null, {
        code: 'UPDATE_FAILED',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('conversation:mark-read')
  async handleMarkConversationRead(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<WsAck> {
    try {
      await this.chatService.markConversationAsRead(
        payload.conversationId,
        client.userId!,
      );

      // Broadcast to conversation that all messages are read
      this.server
        .to(`conversation:${payload.conversationId}`)
        .emit('conversation:read', {
          conversationId: payload.conversationId,
          userId: client.userId!,
          timestamp: new Date().toISOString(),
        });

      return this.ack(true);
    } catch (error) {
      this.logger.error(`Mark conversation read error: ${error.message}`);
      return this.ack(false, null, {
        code: 'UPDATE_FAILED',
        message: error.message,
      });
    }
  }

  // ============ TYPING INDICATOR ============

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { conversationId: string; isTyping: boolean },
  ): Promise<WsAck> {
    try {
      const isMember = await this.verifyMembership(
        payload.conversationId,
        client.userId!,
      );
      if (!isMember) {
        return this.ack(false, null, {
          code: 'FORBIDDEN',
          message: 'Not a participant',
        });
      }

      // Broadcast typing indicator to others in conversation (exclude sender)
      client.to(`conversation:${payload.conversationId}`).emit('typing', {
        conversationId: payload.conversationId,
        userId: client.userId!,
        isTyping: payload.isTyping,
      });

      return this.ack(true);
    } catch (error) {
      return this.ack(false, null, {
        code: 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  // ============ MESSAGE REQUEST EVENTS ============

  @SubscribeMessage('conversation:accept')
  async handleAcceptRequest(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<WsAck> {
    try {
      const conversation = await this.chatService.acceptMessageRequest(
        payload.conversationId,
        client.userId!,
      );

      // Join the conversation room now that it's accepted
      await client.join(`conversation:${payload.conversationId}`);

      // Notify the initiator that request was accepted
      this.server
        .to(`user:${conversation.initiator_id}`)
        .emit('request:accepted', {
          conversationId: payload.conversationId,
          acceptedBy: client.userId,
        });

      return this.ack(true, { conversation });
    } catch (error) {
      this.logger.error(`Accept request error: ${error.message}`);
      return this.ack(false, null, {
        code: error.status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('conversation:decline')
  async handleDeclineRequest(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<WsAck> {
    try {
      const conversation = await this.chatService.declineMessageRequest(
        payload.conversationId,
        client.userId!,
      );

      // Notify the initiator that request was declined
      this.server
        .to(`user:${conversation.initiator_id}`)
        .emit('request:declined', {
          conversationId: payload.conversationId,
          declinedBy: client.userId,
        });

      return this.ack(true);
    } catch (error) {
      this.logger.error(`Decline request error: ${error.message}`);
      return this.ack(false, null, {
        code: error.status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
        message: error.message,
      });
    }
  }

  // ============ NOTIFICATION HELPER ============

  /**
   * Send notification to all participants except sender via RabbitMQ
   */
  private sendMessageNotifications(
    conversationId: string,
    senderId: number,
    content: string,
    attachments?: string[],
  ): void {
    try {
      this.logger.debug(
        `[Notification] Starting to send notifications for conversation ${conversationId}, sender ${senderId}`,
      );

      // Get conversation to find participants
      this.chatService
        .findConversationById(conversationId)
        .then((conversation) => {
          // Get recipient IDs (exclude sender)
          const recipientIds = conversation.participants.filter(
            (id) => id !== senderId,
          );

          this.logger.debug(
            `[Notification] Found ${recipientIds.length} recipients: ${recipientIds.join(', ')}`,
          );

          if (recipientIds.length === 0) {
            this.logger.debug('[Notification] No recipients to notify');
            return; // No one to notify
          }

          // Determine conversation name/type
          const isGroup = conversation.participants.length > 2;
          const notificationTitle = isGroup
            ? `Tin nhắn mới trong nhóm "${conversation.name || 'Nhóm'}"`
            : `Tin nhắn mới`;

          // Determine message type
          let messageType: 'text' | 'image' | 'file' | 'system' = 'text';
          if (attachments && attachments.length > 0) {
            // Check if attachment is an image
            if (attachments.some(a => a.match(/\.(jpg|jpeg|png|gif|webp)$/i))) {
              messageType = 'image';
            } else {
              messageType = 'file';
            }
          }

          this.logger.debug(
            `[Notification] Notification title: ${notificationTitle}, type: ${messageType}`,
          );

          // Emit event to RabbitMQ for each recipient
          for (const recipientId of recipientIds) {
            this.logger.debug(
              `[Notification] Emitting message.created event to RabbitMQ for user ${recipientId}`,
            );

            this.notificationClient.emit('message.created', {
              user_id: recipientId,
              type: 'message',
              title: notificationTitle,
              content: content.substring(0, 100), // Preview only
              related_id: conversationId,
              sender_id: senderId,
              conversation_name: conversation.name || (isGroup ? 'Nhóm' : undefined),
              message_type: messageType,
            });

            this.logger.log(
              `[Notification] ✅ Sent notification event to user ${recipientId}`,
            );
          }

          this.logger.log(
            `[Notification] ✅ Sent ${recipientIds.length} notification events for conversation ${conversationId}`,
          );
        })
        .catch((err: any) => {
          this.logger.error(
            `[Notification] ❌ Failed to send notifications: ${err.message}`,
          );
          this.logger.error(`[Notification] Error stack: ${err.stack}`);
        });
    } catch (error) {
      // Don't throw - notification failure shouldn't break message sending
      this.logger.error(`[Notification] ❌ Notification error: ${error.message}`);
      this.logger.error(`[Notification] Error stack: ${error.stack}`);
    }
  }
}
