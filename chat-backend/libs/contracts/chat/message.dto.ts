import { IsString, IsArray, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: 'Hello, how are you?' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ type: [String], example: ['https://example.com/image.png'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export class UpdateMessageDto {
  @ApiProperty({ example: 'Updated message content' })
  @IsString()
  content: string;
}
