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
  Logger,
  BadRequestException,
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
  private readonly logger = new Logger(UsersController.name);

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

  // Avatar upload - Base64 approach to avoid multipart/form-data issues
  @UseGuards(JwtGuard)
  @Post('upload-avatar')
  @HttpCode(HttpStatus.OK)
  async uploadAvatar(
    @Body() body: { fileName: string; mimeType: string; base64: string },
    @GetCurrentUser('sub') userId: number,
  ) {
    this.logger.log(`[UsersController] uploadAvatar called - userId: ${userId}`);
    this.logger.log(`[UsersController] fileName: ${body.fileName}, base64 size: ${body.base64?.length || 0}`);

    if (!body.base64 || !body.fileName) {
      this.logger.error('[UsersController] Missing required fields');
      throw new BadRequestException('Missing required fields: fileName, base64');
    }

    // Validate file size (500KB max for Base64)
    const MAX_SIZE = 500 * 1024;
    const bufferSize = Buffer.from(body.base64, 'base64').length;
    if (bufferSize > MAX_SIZE) {
      throw new BadRequestException(`File size exceeds ${MAX_SIZE / 1024}KB limit`);
    }

    // Validate mime type (only images allowed)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(body.mimeType)) {
      throw new BadRequestException(`File type ${body.mimeType} is not allowed`);
    }

    // Generate Data URL (base64) - file will be embedded in URL, no storage needed
    const dataUrl = `data:${body.mimeType};base64,${body.base64}`;
    this.logger.log(`[UsersController] Generated avatar Data URL, length: ${dataUrl.length}`);

    // Update user's avatar_url in database
    const user = await this.usersService.updateAvatarUrl(userId, dataUrl);
    this.logger.log(`[UsersController] Avatar updated for user ${userId}`);

    return { url: dataUrl, user };
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

  // ============================================
  // BLOCK USER
  // ============================================

  /**
   * Block a user (prevent them from sending messages)
   */
  @UseGuards(JwtGuard)
  @Post('block/:userId')
  @HttpCode(HttpStatus.OK)
  async blockUser(
    @Param('userId', ParseIntPipe) targetUserId: number,
    @GetCurrentUser('sub') currentUserId: number,
  ) {
    this.logger.log(`[UsersController] User ${currentUserId} blocking user ${targetUserId}`);
    return this.usersService.blockUser(currentUserId, targetUserId);
  }

  /**
   * Unblock a user
   */
  @UseGuards(JwtGuard)
  @Delete('block/:userId')
  @HttpCode(HttpStatus.OK)
  async unblockUser(
    @Param('userId', ParseIntPipe) targetUserId: number,
    @GetCurrentUser('sub') currentUserId: number,
  ) {
    this.logger.log(`[UsersController] User ${currentUserId} unblocking user ${targetUserId}`);
    return this.usersService.unblockUser(currentUserId, targetUserId);
  }

  /**
   * Get list of blocked users
   */
  @UseGuards(JwtGuard)
  @Get('blocked')
  async getBlockedUsers(@GetCurrentUser('sub') userId: number) {
    this.logger.log(`[UsersController] Getting blocked users for user ${userId}`);
    return this.usersService.getBlockedUsers(userId);
  }

  /**
   * Check if current user has blocked another user
   * Query param: targetUserId - the user to check if blocked
   */
  @UseGuards(JwtGuard)
  @Get('blocked/check')
  async checkBlocked(
    @GetCurrentUser('sub') userId: number,
    @Query('targetUserId', ParseIntPipe) targetUserId: number,
  ) {
    this.logger.log(`[UsersController] Checking if user ${userId} has blocked user ${targetUserId}`);
    const isBlocked = await this.usersService.isUserBlocked(userId, targetUserId);
    return { isBlocked };
  }

  // ============================================
  // CONVERSATION SETTINGS (per-user settings)
  // ============================================

  /**
   * Get user's conversation settings
   */
  @UseGuards(JwtGuard)
  @Get(':userId/conversation-settings')
  async getConversationSettings(
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.usersService.getConversationSettings(userId);
  }

  /**
   * Update user's conversation settings
   */
  @UseGuards(JwtGuard)
  @Patch(':userId/conversation-settings')
  @HttpCode(HttpStatus.OK)
  async updateConversationSettings(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { conversationId: string; settings: any },
  ) {
    this.logger.log(`[UsersController] Updating conversation settings for user ${userId}, conversation ${body.conversationId}`);
    return this.usersService.updateConversationSettings(userId, body.conversationId, body.settings);
  }
}
