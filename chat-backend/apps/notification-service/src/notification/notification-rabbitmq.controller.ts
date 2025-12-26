import { Controller, Logger, Inject } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';

interface UserResponse {
  user_id: number;
  username: string;
  avatar_url?: string;
}

/**
 * This controller is dedicated to handling RabbitMQ events
 * It must be registered as a CONTROLLER (not provider) in the module
 * to ensure @EventPattern decorators are scanned by NestJS microservice context
 */
@Controller()
export class NotificationRabbitMQController {
  private readonly logger = new Logger(NotificationRabbitMQController.name);
  private readonly userServiceUrl: string;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationGateway: NotificationGateway,
    private readonly httpService: HttpService,
  ) {
    this.logger.log('NotificationRabbitMQController initialized');
    this.userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001';
  }

  /**
   * Fetch user information from User Service via HTTP
   */
  private async fetchUserById(userId: number): Promise<UserResponse | null> {
    try {
      const response = await this.httpService.axiosRef.get<UserResponse>(
        `${this.userServiceUrl}/users/${userId}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch user ${userId}: ${error.message}`);
      return null;
    }
  }

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
      conversation_name?: string;
      message_type?: 'text' | 'image' | 'file' | 'system';
    },
  ) {
    try {
      this.logger.log(
        `[RabbitMQ] ✅ Received message.created event for user ${data.user_id} from sender ${data.sender_id}`,
      );
      this.logger.debug(`[RabbitMQ] Event data: ${JSON.stringify(data)}`);

      // Fetch sender information from User Service
      let senderName = 'Người dùng';
      let senderAvatar: string | undefined;

      if (data.sender_id) {
        const sender = await this.fetchUserById(data.sender_id);
        if (sender) {
          senderName = sender.username;
          senderAvatar = sender.avatar_url;
        }
      }

      // Determine message type icon
      let messageIcon = '';
      if (data.message_type === 'image') {
        messageIcon = '📷 ';
      } else if (data.message_type === 'file') {
        messageIcon = '📎 ';
      }

      // Create enhanced notification in database
      this.logger.debug(
        `[DB] Creating notification for user ${data.user_id}...`,
      );
      const notification = await this.notificationService.create({
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        content: messageIcon + data.content,
        related_id: data.related_id,
        sender_id: data.sender_id,
        sender_name: senderName,
        sender_avatar: senderAvatar,
        conversation_name: data.conversation_name,
        message_type: data.message_type || 'text',
      });
      this.logger.debug(
        `[DB] ✅ Notification created with ID: ${notification._id}`,
      );

      // Push to user via WebSocket (multi-device)
      this.logger.debug(
        `[WebSocket] Pushing notification to user ${data.user_id}...`,
      );
      await this.notificationGateway.sendNotificationToUser(
        data.user_id,
        notification.toJSON(),
      );

      this.logger.log(
        `[Success] ✅ Notification created and pushed to user ${data.user_id}`,
      );
    } catch (error) {
      this.logger.error(
        `[Error] ❌ Error handling message.created event: ${error.message}`,
      );
      this.logger.error(`[Error] Stack: ${error.stack}`);
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
        `[RabbitMQ] ✅ Received group_invite.created event for user ${data.user_id}`,
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
      await this.notificationGateway.sendNotificationToUser(
        data.user_id,
        notification.toJSON(),
      );

      this.logger.log(
        `[Success] ✅ Group invite notification pushed to user ${data.user_id}`,
      );
    } catch (error) {
      this.logger.error(
        `[Error] ❌ Error handling group_invite.created event: ${error.message}`,
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
        `[RabbitMQ] ✅ Received system.broadcast for ${data.user_ids.length} users`,
      );

      // Create notifications in bulk
      await this.notificationService.createBroadcast(
        data.title,
        data.content,
        data.user_ids,
      );

      // Push to all users via WebSocket
      this.notificationGateway.broadcastToAll(
        {
          type: 'system',
          title: data.title,
          content: data.content,
          is_read: false,
        },
        data.user_ids,
      );

      this.logger.log(
        `[Success] ✅ System broadcast pushed to ${data.user_ids.length} users`,
      );
    } catch (error) {
      this.logger.error(
        `[Error] ❌ Error handling system.broadcast event: ${error.message}`,
      );
    }
  }
}
