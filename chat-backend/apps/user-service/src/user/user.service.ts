import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  PublicUserResponseDto,
  UserQueryDto,
  PaginatedResponseDto,
} from '@app/contracts';
import { User } from './user.entity';
import { UserRole } from '../role/user-role.entity';
import * as bcrypt from 'bcrypt';
import { UserBlockedEvent } from './events/user-blocked.event';
import { UserUnblockedEvent } from './events/user-unblocked.event';

@Injectable()
export class UsersService {
  private readonly defaultPageSize: number;
  private readonly maxPageSize: number;

  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    @InjectRepository(UserRole) private userRoleRepo: Repository<UserRole>,
    @Inject(EventEmitter2) private eventEmitter: EventEmitter2,
  ) {
    // Load pagination settings from environment variables
    this.defaultPageSize = parseInt(process.env.DEFAULT_PAGE_SIZE || '50', 10);
    this.maxPageSize = parseInt(process.env.MAX_PAGE_SIZE || '100', 10);
  }

  // ==================================================
  // CREATE USER
  // ==================================================
  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    await this.ensureUniqueCredentials(dto.username, dto.email);
    const hash = await bcrypt.hash(dto.password, 10);

    const user = this.repo.create({
      username: dto.username,
      email: dto.email,
      password_hash: hash,
      avatar_url: dto.avatar_url ?? undefined,
      status: dto.status ?? 'active',
    });

    const saved = await this.repo.save(user);
    return this.toResponse(saved);
  }

  // ==================================================
  // FIND USER
  // ==================================================
  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findById(id: number): Promise<UserResponseDto> {
    const user = await this.repo.findOne({
      where: { user_id: id },
    });

    if (!user) throw new NotFoundException('User not found');

    return this.toResponse(user);
  }

  /**
   * Lấy thông tin user công khai (dùng cho GET /users/{id})
   * Chỉ trả về thông tin an toàn, không có email, status, roles, groups
   */
  async findPublicById(id: number): Promise<PublicUserResponseDto> {
    const user = await this.repo.findOne({
      where: { user_id: id },
    });

    if (!user) throw new NotFoundException('User not found');

    return this.toPublicResponse(user);
  }

  /**
   * Batch fetch users by IDs (optimized for fetching multiple users at once)
   */
  async findByIds(ids: number[]): Promise<PublicUserResponseDto[]> {
    if (ids.length === 0) return [];

    const users = await this.repo
      .createQueryBuilder('user')
      .where('user.user_id IN (:...ids)', { ids })
      .getMany();

    return users.map((user) => this.toPublicResponse(user));
  }

  async findAll(
    query: UserQueryDto,
  ): Promise<PaginatedResponseDto<PublicUserResponseDto>> {
    const search = query.search;
    const status = query.status;
    const role = query.role;
    const page = query.page ?? 1;
    
    // Apply pagination limits from environment variables
    let limit = query.limit ?? this.defaultPageSize;
    if (limit > this.maxPageSize) {
      limit = this.maxPageSize;
    }
    
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'DESC';

    const queryBuilder = this.repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'userRole')
      .leftJoinAndSelect('userRole.role', 'role');

    // Filtering: Search
    if (search && search.trim() !== '') {
      queryBuilder.where(
        '(user.username ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    // Filtering: Status
    if (status) {
      if (search && search.trim() !== '') {
        queryBuilder.andWhere('user.status = :status', { status });
      } else {
        queryBuilder.where('user.status = :status', { status });
      }
    }

    // Filtering: Role
    if (role) {
      if ((search && search.trim() !== '') || status) {
        queryBuilder.andWhere('role.name = :role', { role });
      } else {
        queryBuilder.where('role.name = :role', { role });
      }
    }

    // Sorting
    const allowedSortFields: string[] = [
      'username',
      'email',
      'created_at',
      'status',
    ];
    const sortField: string = allowedSortFields.includes(sortBy ?? '')
      ? sortBy
      : 'created_at';
    queryBuilder.orderBy(`user.${sortField}`, sortOrder ?? 'DESC');

    // Pagination
    const skip: number = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Get total count and data
    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      data: users.map((u) => this.toPublicResponse(u)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==================================================
  // UPDATE USER
  // ==================================================
  async updateUser(id: number, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.repo.findOne({ where: { user_id: id } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.username && dto.username !== user.username) {
      await this.ensureUniqueCredentials(dto.username, undefined);
    }

    if (dto.email && dto.email !== user.email) {
      await this.ensureUniqueCredentials(undefined, dto.email);
    }

    Object.assign(user, {
      username: dto.username ?? user.username,
      email: dto.email ?? user.email,
      avatar_url: dto.avatar_url ?? user.avatar_url,
      status: dto.status ?? user.status,
    });

    const saved = await this.repo.save(user);
    return this.toResponse(saved);
  }

  // ==================================================
  // CHANGE PASSWORD
  // ==================================================
  async changePassword(id: number, oldPw: string, newPw: string) {
    const user = await this.repo.findOne({ where: { user_id: id } });
    if (!user) throw new NotFoundException('User not found');

    const match = await bcrypt.compare(oldPw, user.password_hash);
    if (!match) throw new ForbiddenException('Old password incorrect');

    user.password_hash = await bcrypt.hash(newPw, 10);
    await this.repo.save(user);
    return { message: 'Password updated' };
  }

  // ==================================================
  // AVATAR UPLOAD
  // ==================================================
  /**
   * Update user's avatar URL
   * Called from uploadAvatar endpoint after file is uploaded
   */
  async updateAvatarUrl(id: number, avatarUrl: string): Promise<UserResponseDto> {
    const user = await this.repo.findOne({ where: { user_id: id } });
    if (!user) throw new NotFoundException('User not found');

    user.avatar_url = avatarUrl;
    const saved = await this.repo.save(user);
    return this.toResponse(saved);
  }

  // ==================================================
  // ROLE MANAGEMENT
  // ==================================================
  async addRole(userId: number, roleId: number) {
    const exist = await this.userRoleRepo.findOne({
      where: { user_id: userId, role_id: roleId },
    });

    if (exist) return exist;

    const record = this.userRoleRepo.create({
      user_id: userId,
      role_id: roleId,
    });
    return this.userRoleRepo.save(record);
  }

  async removeRole(userId: number, roleId: number) {
    return this.userRoleRepo.delete({ user_id: userId, role_id: roleId });
  }

  async getUserRoles(userId: number) {
    return this.userRoleRepo.find({
      where: { user_id: userId },
      relations: ['role'],
    });
  }

  // ==================================================
  // ROLE MANAGEMENT
  // ==================================================
  // DELETE USER
  // ==================================================
  async deleteUser(id: number) {
    return this.repo.delete({ user_id: id });
  }

  // ==================================================
  // BLOCK USER
  // ==================================================
  /**
   * Block a user - adds targetUserId to current user's blocked_users list
   * Emits event for WebSocket to notify users
   */
  async blockUser(currentUserId: number, targetUserId: number): Promise<UserResponseDto> {
    if (currentUserId === targetUserId) {
      throw new ForbiddenException('Bạn không thể chặn chính mình');
    }

    const user = await this.repo.findOne({ where: { user_id: currentUserId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already blocked
    if (user.blocked_users && user.blocked_users.includes(targetUserId)) {
      return this.toResponse(user);
    }

    // Add to blocked_users array
    user.blocked_users = [...(user.blocked_users || []), targetUserId];
    const saved = await this.repo.save(user);

    // Emit event for WebSocket gateway to notify both users
    this.eventEmitter.emit(
      'user.blocked',
      new UserBlockedEvent(currentUserId, targetUserId),
    );

    return this.toResponse(saved);
  }

  /**
   * Unblock a user - removes targetUserId from current user's blocked_users list
   * Emits event for WebSocket to notify users
   */
  async unblockUser(currentUserId: number, targetUserId: number): Promise<UserResponseDto> {
    const user = await this.repo.findOne({ where: { user_id: currentUserId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove from blocked_users array
    user.blocked_users = (user.blocked_users || []).filter((id) => id !== targetUserId);
    const saved = await this.repo.save(user);

    // Emit event for WebSocket gateway to notify both users
    this.eventEmitter.emit(
      'user.unblocked',
      new UserUnblockedEvent(currentUserId, targetUserId),
    );

    return this.toResponse(saved);
  }

  /**
   * Get list of blocked users with their details
   */
  async getBlockedUsers(userId: number): Promise<PublicUserResponseDto[]> {
    const user = await this.repo.findOne({ where: { user_id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const blockedIds = user.blocked_users || [];
    if (blockedIds.length === 0) {
      return [];
    }

    // Fetch user details for all blocked IDs
    const blockedUsers = await this.repo
      .createQueryBuilder('user')
      .where('user.user_id IN (:...ids)', { ids: blockedIds })
      .getMany();

    return blockedUsers.map((u) => this.toPublicResponse(u));
  }

  /**
   * Check if a user has blocked another user
   * Returns true if userId has blocked targetUserId
   */
  async isUserBlocked(userId: number, targetUserId: number): Promise<boolean> {
    const user = await this.repo.findOne({
      where: { user_id: userId },
      select: ['user_id', 'blocked_users'],
    });

    if (!user || !user.blocked_users || user.blocked_users.length === 0) {
      return false;
    }

    return user.blocked_users.includes(targetUserId);
  }

  /**
   * Get blocked_users list for a user (internal use)
   * Returns array of blocked user IDs
   */
  async getBlockedUserIds(userId: number): Promise<number[]> {
    const user = await this.repo.findOne({
      where: { user_id: userId },
      select: ['user_id', 'blocked_users'],
    });

    return user?.blocked_users || [];
  }

  // ==================================================
  // CONVERSATION SETTINGS
  // ==================================================
  /**
   * Get user's conversation settings for all conversations
   */
  async getConversationSettings(userId: number): Promise<Record<string, any>> {
    const user = await this.repo.findOne({ where: { user_id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.conversation_settings || {};
  }

  /**
   * Update user's settings for a specific conversation
   * Merges the new settings with existing settings for that conversation
   */
  async updateConversationSettings(
    userId: number,
    conversationId: string,
    settings: any,
  ): Promise<Record<string, any>> {
    const user = await this.repo.findOne({ where: { user_id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Initialize conversation_settings if not exists
    if (!user.conversation_settings) {
      user.conversation_settings = {};
    }

    // Merge new settings with existing settings for this conversation
    const currentSettings = user.conversation_settings[conversationId] || {};
    user.conversation_settings[conversationId] = {
      ...currentSettings,
      ...settings,
    };

    await this.repo.save(user);

    return user.conversation_settings;
  }

  // ==================================================
  // MAPPER — ENTITY → DTO
  // ==================================================
  /**
   * Mapper cho thông tin đầy đủ của chính mình
   * Chứa: user_id, username, email, avatar_url, status, created_at
   * KHÔNG chứa: roles, groups (thông tin nhạy cảm)
   */
  private toResponse(user: User): UserResponseDto {
    return {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      avatar_url: user.avatar_url,
      status: user.status,
      created_at: user.created_at,
    };
  }

  /**
   * Mapper cho thông tin user công khai
   * Chứa: user_id, username, avatar_url, status, created_at
   * KHÔNG chứa: email, roles, groups (thông tin nhạy cảm)
   */
  private toPublicResponse(user: User): PublicUserResponseDto {
    return {
      user_id: user.user_id,
      username: user.username,
      avatar_url: user.avatar_url,
      status: user.status,
      created_at: user.created_at,
    };
  }

  private async ensureUniqueCredentials(
    username?: string,
    email?: string,
  ): Promise<void> {
    if (!username && !email) return;

    const existing = await this.repo.findOne({
      where: [
        ...(username ? [{ username }] : []),
        ...(email ? [{ email }] : []),
      ],
    });

    if (existing)
      throw new ConflictException(
        'Username hoặc email đã tồn tại trong hệ thống',
      );
  }
}
