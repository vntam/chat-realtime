import { Controller, Logger, Inject } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ChatGateway } from '../chat/chat.gateway';

/**
 * This controller listens to RabbitMQ events from User Service
 * and broadcasts WebSocket events to connected clients
 */
@Controller()
export class UserRabbitMQController {
  private readonly logger = new Logger(UserRabbitMQController.name);

  constructor(
    private readonly chatGateway: ChatGateway,
  ) {
    this.logger.log('UserRabbitMQController initialized');
  }

  /**
   * Listen for user.profile.updated events from User Service via RabbitMQ
   * Broadcast to all connected WebSocket clients
   */
  @EventPattern('user.profile.updated')
  async handleUserUpdatedEvent(
    @Payload()
    data: {
      user_id: number;
      username: string;
      email: string;
      avatar_url?: string;
    },
  ) {
    try {
      this.logger.log(
        `[RabbitMQ] ✅ Received user.profile.updated event for user ${data.user_id} (${data.username})`,
      );

      // Broadcast to all connected WebSocket clients
      this.chatGateway.broadcastUserUpdate({
        userId: data.user_id,
        username: data.username,
        avatarUrl: data.avatar_url,
      });

      this.logger.log(
        `[Success] ✅ User update broadcasted to all WebSocket clients`,
      );
    } catch (error) {
      this.logger.error(
        `[Error] ❌ Error handling user.profile.updated event: ${error.message}`,
      );
      this.logger.error(`[Error] Stack: ${error.stack}`);
    }
  }
}
