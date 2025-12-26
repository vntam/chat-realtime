import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'oldpassword123', description: 'Mật khẩu hiện tại' })
  @IsNotEmpty()
  @IsString()
  oldPassword: string;

  @ApiProperty({ example: 'newpassword456', description: 'Mật khẩu mới' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  newPassword: string;
}
