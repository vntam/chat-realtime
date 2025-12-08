import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  /**
   * Get list of notifications for a user
   */
  async findByUser(
    userId: number,
    unreadOnly = false,
  ): Promise<NotificationDocument[]> {
    const query = this.notificationModel.find({ user_id: userId });

    if (unreadOnly) {
      query.where('is_read').equals(false);
    }

    return query.sort({ created_at: -1 }).exec();
  }

  /**
   * Get notification by ID
   */
  async findById(notificationId: string): Promise<NotificationDocument> {
    const notification = await this.notificationModel
      .findById(notificationId)
      .exec();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  /**
   * Create new notification
   */
  async create(data: {
    user_id: number;
    type: string;
    title: string;
    content: string;
    related_id?: string;
  }): Promise<NotificationDocument> {
    const notification = new this.notificationModel(data);
    return notification.save();
  }

  /**
   * Mark notification as read
   */
  async markAsRead(
    notificationId: string,
    userId: number,
  ): Promise<NotificationDocument> {
    const notification = await this.findById(notificationId);

    // Verify ownership
    if (notification.user_id !== userId) {
      throw new ForbiddenException('You can only mark your own notifications');
    }

    notification.is_read = true;
    return notification.save();
  }

  /**
   * Delete notification
   */
  async delete(notificationId: string, userId: number): Promise<void> {
    const notification = await this.findById(notificationId);

    // Verify ownership
    if (notification.user_id !== userId) {
      throw new ForbiddenException(
        'You can only delete your own notifications',
      );
    }

    await this.notificationModel.findByIdAndDelete(notificationId).exec();
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: number): Promise<number> {
    return this.notificationModel
      .countDocuments({ user_id: userId, is_read: false })
      .exec();
  }

  /**
   * Create broadcast notification for all users
   * Note: This is a simple implementation. For production, consider using a job queue
   */
  async createBroadcast(
    title: string,
    content: string,
    userIds: number[],
  ): Promise<void> {
    const notifications = userIds.map((user_id) => ({
      user_id,
      type: 'system',
      title,
      content,
      is_read: false,
    }));

    await this.notificationModel.insertMany(notifications);
  }
}
