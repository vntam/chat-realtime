import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseBoolPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { GetCurrentUser } from '@app/common/decorators/get-current-user.decorator';
import { AuthGuard } from '@app/common/guards/auth.guard';

@ApiTags('Notification Service')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy thông báo của người dùng (dựa trên token)' })
  @ApiResponse({ status: 200, description: 'Danh sách thông báo' })
  async getNotifications(
    @GetCurrentUser('sub') userId: number,
    @Query('unreadOnly', new ParseBoolPipe({ optional: true }))
    unreadOnly?: boolean,
  ) {
    return this.notificationService.findByUser(userId, unreadOnly);
  }

  @Get('unread/count')
  @ApiOperation({ summary: 'Số lượng thông báo chưa đọc của user hiện tại' })
  @ApiResponse({ status: 200, description: 'Số lượng thông báo chưa đọc' })
  async getUnreadCount(@GetCurrentUser('sub') userId: number) {
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết thông báo' })
  @ApiResponse({ status: 200, description: 'Chi tiết thông báo' })
  @ApiResponse({ status: 404, description: 'Thông báo không tồn tại' })
  async getNotification(
    @Param('id') id: string,
    @GetCurrentUser('sub') userId: number,
  ) {
    const notification = await this.notificationService.findById(id);
    
    // Verify ownership
    if (notification.user_id !== userId) {
      throw new Error('Forbidden');
    }
    
    return notification;
  }

  @Post()
  @ApiOperation({ summary: 'Tạo thông báo mới (admin hoặc hệ thống)' })
  @ApiResponse({ status: 201, description: 'Tạo thông báo thành công' })
  async createNotification(
    @Body()
    body: {
      user_id: number;
      type: string;
      title: string;
      content: string;
      related_id?: string;
    },
  ) {
    return this.notificationService.create(body);
  }

  @Post('broadcast')
  @ApiOperation({ summary: 'Gửi thông báo broadcast toàn hệ thống' })
  @ApiResponse({
    status: 200,
    description: 'Thông báo đã được gửi đến tất cả người dùng',
  })
  async broadcastNotification(
    @Body() body: { title: string; body: string; userIds: number[] },
  ) {
    await this.notificationService.createBroadcast(
      body.title,
      body.body,
      body.userIds,
    );
    return { message: 'Broadcast notification sent successfully' };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Đánh dấu thông báo đã đọc' })
  @ApiResponse({ status: 200, description: 'Thông báo đã được đánh dấu đã đọc' })
  async markAsRead(
    @Param('id') id: string,
    @GetCurrentUser('sub') userId: number,
  ) {
    return this.notificationService.markAsRead(id, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa thông báo' })
  @ApiResponse({ status: 204, description: 'Thông báo đã được xóa' })
  async deleteNotification(
    @Param('id') id: string,
    @GetCurrentUser('sub') userId: number,
  ) {
    await this.notificationService.delete(id, userId);
  }
}
