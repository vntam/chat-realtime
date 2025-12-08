import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MessageSearchDto {
  @ApiProperty({
    description: 'Từ khóa tìm kiếm trong nội dung tin nhắn',
    required: true,
    example: 'hello',
  })
  @IsString()
  query: string;

  @ApiProperty({
    description:
      'ID của conversation để tìm kiếm (tìm trong conversation cụ thể)',
    required: false,
    example: '6578a1b2c3d4e5f6a7b8c9d0',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiProperty({
    description: 'ID của người gửi để lọc',
    required: false,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  senderId?: number;

  @ApiProperty({
    description: 'Tìm tin nhắn sau ngày này (ISO 8601)',
    required: false,
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'Tìm tin nhắn trước ngày này (ISO 8601)',
    required: false,
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Số lượng kết quả tối đa',
    required: false,
    default: 50,
    minimum: 1,
    maximum: 100,
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({
    description: 'Số kết quả bỏ qua (cho pagination)',
    required: false,
    default: 0,
    minimum: 0,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}

export class MessageSearchResultDto {
  @ApiProperty({ description: 'Danh sách tin nhắn tìm được' })
  messages: any[];

  @ApiProperty({ description: 'Tổng số kết quả tìm được', example: 42 })
  total: number;

  @ApiProperty({ description: 'Số kết quả đã bỏ qua', example: 0 })
  skip: number;

  @ApiProperty({ description: 'Số kết quả trả về', example: 50 })
  limit: number;

  @ApiProperty({ description: 'Từ khóa tìm kiếm', example: 'hello' })
  query: string;
}
