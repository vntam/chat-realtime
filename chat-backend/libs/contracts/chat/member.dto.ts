import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddMemberDto {
  @ApiProperty({ example: 5 })
  @IsInt()
  userId: number;
}
