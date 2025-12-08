import {
  ClassSerializerInterceptor,
  UseInterceptors,
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Body,
  Post,
  UseGuards,
  Query,
  ForbiddenException,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './user.service';

import {
  CreateUserDto,
  UpdateUserDto,
  UserQueryDto,
  PublicUserResponseDto,
} from '@app/contracts';
import { GetCurrentUser, Roles, RolesGuard } from '@app/common';
import { JwtGuard } from '../auth/guards/jwt/jwt.guard';

@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtGuard)
  @Get('me')
  getCurrentUser(@GetCurrentUser('sub') userId: number) {
    return this.usersService.findById(userId);
  }

  @Get()
  findAll(@Query() query: UserQueryDto) {
    return this.usersService.findAll(query);
  }

  /**
   * Lấy thông tin user công khai (dùng khi user khác xem profile)
   * Chỉ trả về thông tin an toàn: user_id, username, avatar_url, created_at
   * KHÔNG trả về: email, status, roles, groups (thông tin nhạy cảm)
   */
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PublicUserResponseDto> {
    return this.usersService.findPublicById(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @UseGuards(JwtGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @GetCurrentUser('sub') userId: number,
  ) {
    if (userId !== id) {
      throw new ForbiddenException(
        'Bạn chỉ có thể cập nhật thông tin của chính mình',
      );
    }
    return this.usersService.updateUser(id, dto);
  }

  @UseGuards(JwtGuard)
  @Delete(':id')
  delete(
    @Param('id', ParseIntPipe) id: number,
    @GetCurrentUser('sub') userId: number,
  ) {
    if (userId !== id) {
      throw new ForbiddenException(
        'Bạn chỉ có thể xóa tài khoản của chính mình',
      );
    }
    return this.usersService.deleteUser(id);
  }

  // roles
  @UseGuards(JwtGuard)
  @Get(':id/roles')
  roles(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserRoles(id);
  }

  @UseGuards(JwtGuard)
  @Post(':id/roles')
  addRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { roleId: number },
  ) {
    return this.usersService.addRole(id, body.roleId);
  }

  @UseGuards(JwtGuard)
  @Delete(':id/roles')
  removeRole(
    @Param('id', ParseIntPipe) id: number,
    @Query('roleId', ParseIntPipe) roleId: number,
  ) {
    return this.usersService.removeRole(id, roleId);
  }
}
