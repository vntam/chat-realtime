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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './user.service';

import {
  CreateUserDto,
  UpdateUserDto,
  UserQueryDto,
  PublicUserResponseDto,
  ChangePasswordDto,
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

  @Post('batch')
  async findByIds(@Body() body: { ids: number[] }): Promise<PublicUserResponseDto[]> {
    console.log('[UsersController] findByIds called with body:', JSON.stringify(body));
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      console.log('[UsersController] No valid IDs provided, returning empty array');
      return [];
    }
    console.log('[UsersController] Fetching users for IDs:', body.ids);
    const users = await this.usersService.findByIds(body.ids);
    console.log('[UsersController] Found users:', users.length);
    return users;
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

  // Password change
  @UseGuards(JwtGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @GetCurrentUser('sub') userId: number,
  ) {
    console.log('[UsersController] changePassword called for user:', userId);
    return await this.usersService.changePassword(userId, dto.oldPassword, dto.newPassword);
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
