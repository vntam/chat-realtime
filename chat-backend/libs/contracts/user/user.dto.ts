import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'johndoe' })
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'John Doe' })
  @IsOptional()
  fullName?: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'strongpassword' })
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'https://example.com/avatar.png', required: false })
  @IsOptional()
  avatar_url?: string;

  @ApiProperty({ example: 'online', required: false })
  @IsOptional()
  status?: string;
}

/**
 * User Response DTO - Thông tin đầy đủ của chính mình
 * Dùng cho GET /users/me - User xem thông tin của chính mình
 * Chứa: user_id, username, email, avatar_url, status, created_at
 * KHÔNG chứa: roles, groups (thông tin nhạy cảm)
 */
export class UserResponseDto {
  @ApiProperty({
    description: 'ID duy nhất của user (chỉ trả về cho chính mình)',
    example: 123,
  })
  user_id: number;
  @ApiProperty()
  username: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ required: false })
  avatar_url?: string;

  @ApiProperty({ required: false })
  status?: string;

  @ApiProperty()
  created_at: Date;
}

/**
 * Public User Response DTO - Chỉ chứa thông tin công khai
 * Dùng cho GET /users/{id} khi user khác xem profile
 * Chứa: username, avatar_url, status, created_at
 * KHÔNG chứa: user_id, email, roles, groups (thông tin nhạy cảm)
 */
export class PublicUserResponseDto {
  @ApiProperty({ description: 'Tên đăng nhập (công khai)' })
  username: string;

  @ApiProperty({ description: 'URL avatar (công khai)', required: false })
  avatar_url?: string;

  @ApiProperty({
    description: 'Trạng thái tài khoản (công khai)',
    required: false,
  })
  status?: string;

  @ApiProperty({ description: 'Ngày tạo tài khoản', required: false })
  created_at?: Date;
}
