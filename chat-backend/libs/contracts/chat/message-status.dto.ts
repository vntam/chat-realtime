import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsString,
  IsArray,
  IsOptional,
} from 'class-validator';

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export class UpdateMessageStatusDto {
  @ApiProperty({
    description: 'Trạng thái tin nhắn',
    enum: MessageStatus,
    example: MessageStatus.DELIVERED,
  })
  @IsEnum(MessageStatus)
  status: MessageStatus;

  @ApiProperty({
    description: 'ID của user cập nhật trạng thái',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  userId?: number;
}

export class MarkMessagesAsReadDto {
  @ApiProperty({
    description: 'Danh sách message IDs cần đánh dấu đã đọc',
    type: [String],
    example: ['6578a1b2c3d4e5f6a7b8c9d1', '6578a1b2c3d4e5f6a7b8c9d2'],
  })
  @IsArray()
  @IsString({ each: true })
  messageIds: string[];
}

export class MarkConversationAsReadDto {
  @ApiProperty({
    description: 'ID của conversation cần đánh dấu tất cả tin nhắn đã đọc',
    example: '6578a1b2c3d4e5f6a7b8c9d0',
  })
  @IsString()
  conversationId: string;
}

export class DeliveryInfoDto {
  @ApiProperty({
    description: 'ID của user',
    example: 1,
  })
  user_id: number;

  @ApiProperty({
    description: 'Trạng thái của tin nhắn đối với user này',
    enum: MessageStatus,
    example: MessageStatus.READ,
  })
  status: MessageStatus;

  @ApiProperty({
    description: 'Thời điểm cập nhật trạng thái',
    example: '2024-12-06T10:30:00Z',
  })
  timestamp: Date;
}

export class MessageStatusResponseDto {
  @ApiProperty({
    description: 'ID của tin nhắn',
    example: '6578a1b2c3d4e5f6a7b8c9d1',
  })
  message_id: string;

  @ApiProperty({
    description: 'Trạng thái chung của tin nhắn',
    enum: MessageStatus,
    example: MessageStatus.READ,
  })
  status: MessageStatus;

  @ApiProperty({
    description: 'Thông tin delivery chi tiết cho từng user',
    type: [DeliveryInfoDto],
  })
  delivery_info: DeliveryInfoDto[];

  @ApiProperty({
    description: 'Thời điểm tin nhắn được gửi',
    example: '2024-12-06T10:00:00Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Thời điểm tin nhắn được delivered (tất cả recipients)',
    example: '2024-12-06T10:01:00Z',
    required: false,
  })
  delivered_at?: Date;

  @ApiProperty({
    description: 'Thời điểm tin nhắn được đọc (tất cả recipients)',
    example: '2024-12-06T10:05:00Z',
    required: false,
  })
  read_at?: Date;
}
