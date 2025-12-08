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
import { Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import { MetricsService } from '@app/common';

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
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Extract user_id from socket auth (set by AuthGuard middleware)
      const userId = client.data.userId as number;

      if (!userId) {
        this.logger.warn(`Client ${client.id} disconnected: No user_id`);
        client.disconnect();
        return;
      }

      // Join user's personal room
      await client.join(`user:${userId}`);
      this.logger.log(`User ${userId} connected to notifications`);

      // Send current unread count
      const count = await this.notificationService.getUnreadCount(userId);
      client.emit('notification:count', { count });

      // Update active connections metric
      this.updateActiveConnectionsMetric();
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    this.logger.log(`User ${userId} disconnected from notifications`);

    // Update active connections metric
    this.updateActiveConnectionsMetric();
  }

  /**
   * Update active connections count metric
   */
  private updateActiveConnectionsMetric() {
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
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId as number;
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
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId as number;
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
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId as number;
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
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId as number;
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
  handlePing(@ConnectedSocket() client: Socket) {
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

  // ============ RABBITMQ EVENT LISTENERS ============

  /**
   * Listen for message.created events from Chat Service via RabbitMQ
   * Create notification and push to user via WebSocket
   */
  @EventPattern('message.created')
  async handleMessageCreatedEvent(
    @Payload()
    data: {
      user_id: number;
      type: string;
      title: string;
      content: string;
      related_id: string;
      sender_id: number;
    },
  ) {
    try {
      this.logger.log(
        `Received message.created event for user ${data.user_id}`,
      );

      // Create notification in database
      const notification = await this.notificationService.create({
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        content: data.content,
        related_id: data.related_id,
      });

      // Push to user via WebSocket (multi-device)
      await this.sendNotificationToUser(data.user_id, notification.toJSON());

      this.logger.log(
        `Notification created and pushed to user ${data.user_id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling message.created event: ${error.message}`,
      );
    }
  }

  /**
   * Listen for group_invite.created events from Chat Service via RabbitMQ
   */
  @EventPattern('group_invite.created')
  async handleGroupInviteCreatedEvent(
    @Payload()
    data: {
      user_id: number;
      title: string;
      content: string;
      related_id: string;
    },
  ) {
    try {
      this.logger.log(
        `Received group_invite.created event for user ${data.user_id}`,
      );

      // Create notification in database
      const notification = await this.notificationService.create({
        user_id: data.user_id,
        type: 'group_invite',
        title: data.title,
        content: data.content,
        related_id: data.related_id,
      });

      // Push to user via WebSocket
      await this.sendNotificationToUser(data.user_id, notification.toJSON());

      this.logger.log(
        `Group invite notification pushed to user ${data.user_id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling group_invite.created event: ${error.message}`,
      );
    }
  }

  /**
   * Listen for system.broadcast events (admin notifications)
   */
  @EventPattern('system.broadcast')
  async handleSystemBroadcastEvent(
    @Payload()
    data: {
      user_ids: number[];
      title: string;
      content: string;
    },
  ) {
    try {
      this.logger.log(
        `Received system.broadcast for ${data.user_ids.length} users`,
      );

      // Create notifications in bulk
      await this.notificationService.createBroadcast(
        data.title,
        data.content,
        data.user_ids,
      );

      // Push to all users via WebSocket
      this.broadcastToAll(
        {
          type: 'system',
          title: data.title,
          content: data.content,
          is_read: false,
        },
        data.user_ids,
      );

      this.logger.log(
        `System broadcast pushed to ${data.user_ids.length} users`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling system.broadcast event: ${error.message}`,
      );
    }
  }
}
