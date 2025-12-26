import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationService } from './notification.service';
import { MetricsService } from '@app/common';

interface AuthSocket extends Socket {
  userId?: number;
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly metricsService: MetricsService,
    private readonly jwtService: JwtService,
  ) {}

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
        secret: process.env.JWT_ACCESS_SECRET || 'supersecret_access',
      });

      client.userId = payload.sub;

      if (!client.userId) {
        throw new UnauthorizedException('Invalid user ID in token');
      }

      // Join user's personal room
      await client.join(`user:${client.userId}`);
      this.logger.log(`User ${client.userId} connected to notifications`);

      // Send current unread count
      const count = await this.notificationService.getUnreadCount(client.userId);
      client.emit('notification:count', { count });

      // Update active connections metric
      this.updateActiveConnectionsMetric();
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.emit('error', {
        code: 'AUTH_INVALID',
        message: 'Authentication failed',
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthSocket) {
    const userId = client.userId;
    this.logger.log(`User ${userId} disconnected from notifications`);

    // Update active connections metric
    this.updateActiveConnectionsMetric();
  }

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

  /**
   * Client requests list of notifications
   */
  @SubscribeMessage('notification:list')
  async handleList(
    @MessageBody() data: { unreadOnly?: boolean },
    @ConnectedSocket() client: AuthSocket,
  ) {
    try {
      const userId = client.userId as number;
      const notifications = await this.notificationService.findByUser(
        userId,
        data.unreadOnly,
      );
      return { ok: true, data: notifications };
    } catch (error) {
      return {
        ok: false,
        error: { code: 'BAD_REQUEST', message: error.message },
      };
    }
  }

  /**
   * Client requests notification detail
   */
  @SubscribeMessage('notification:get')
  async handleGet(
    @MessageBody() data: { notificationId: string },
    @ConnectedSocket() client: AuthSocket,
  ) {
    try {
      const userId = client.userId as number;
      const notification = await this.notificationService.findById(
        data.notificationId,
      );

      // Verify ownership
      if (notification.user_id !== userId) {
        return {
          ok: false,
          error: { code: 'FORBIDDEN', message: 'Not your notification' },
        };
      }

      return { ok: true, data: notification };
    } catch (error) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: error.message },
      };
    }
  }

  /**
   * Client marks notification as read
   */
  @SubscribeMessage('notification:read')
  async handleMarkAsRead(
    @MessageBody() data: { notificationId: string },
    @ConnectedSocket() client: AuthSocket,
  ) {
    try {
      const userId = client.userId as number;
      const notification = await this.notificationService.markAsRead(
        data.notificationId,
        userId,
      );

      // Broadcast to all user's devices
      this.server.to(`user:${userId}`).emit('notification:read', {
        notificationId: data.notificationId,
        is_read: true,
      });

      // Send updated count
      const count = await this.notificationService.getUnreadCount(userId);
      this.server.to(`user:${userId}`).emit('notification:count', { count });

      return { ok: true, data: notification };
    } catch (error) {
      return {
        ok: false,
        error: { code: 'FORBIDDEN', message: error.message },
      };
    }
  }

  /**
   * Client deletes notification
   */
  @SubscribeMessage('notification:delete')
  async handleDelete(
    @MessageBody() data: { notificationId: string },
    @ConnectedSocket() client: AuthSocket,
  ) {
    try {
      const userId = client.userId as number;
      await this.notificationService.delete(data.notificationId, userId);

      // Broadcast to all user's devices
      this.server.to(`user:${userId}`).emit('notification:deleted', {
        notificationId: data.notificationId,
      });

      // Send updated count
      const count = await this.notificationService.getUnreadCount(userId);
      this.server.to(`user:${userId}`).emit('notification:count', { count });

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: { code: 'FORBIDDEN', message: error.message },
      };
    }
  }

  /**
   * Heartbeat ping
   */
  @SubscribeMessage('notification:ping')
  handlePing(@ConnectedSocket() client: AuthSocket) {
    client.emit('pong', { timestamp: Date.now() });
    return { ok: true };
  }

  /**
   * Server method: Send notification to user
   * Called by other services or when creating notifications
   */
  async sendNotificationToUser(userId: number, notification: any) {
    this.server.to(`user:${userId}`).emit('notification:created', notification);

    // Also send updated count
    const count = await this.notificationService.getUnreadCount(userId);
    this.server.to(`user:${userId}`).emit('notification:count', { count });
  }

  /**
   * Server method: Broadcast notification to all users
   */
  broadcastToAll(notification: any, userIds: number[]) {
    for (const userId of userIds) {
      this.server
        .to(`user:${userId}`)
        .emit('notification:created', notification);
    }
  }
}
