import {
  IsEnum,
  IsArray,
  ArrayMinSize,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({ enum: ['private', 'group'], example: 'private' })
  @IsEnum(['private', 'group'])
  type: string;

  @ApiProperty({ type: [Number], example: [1, 2] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  participants: number[];

  @ApiProperty({
    required: false,
    example: 'Team Dev',
    description: 'Tên nhóm (chỉ cho group chat)',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    required: false,
    example: 'https://example.com/avatar.jpg',
    description: 'Ảnh đại diện nhóm',
  })
  @IsOptional()
  @IsString()
  avatar?: string;
}
