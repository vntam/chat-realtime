import { ApiProperty } from '@nestjs/swagger';
import { MinLength } from 'class-validator';
import { CreateUserDto } from '../user/user.dto';

export class RegisterDto extends CreateUserDto {
  @ApiProperty({ example: '123456' })
  @MinLength(6)
  confirmPassword: string;
}
