import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class UsersService {
  private readonly defaultPageSize: number;
  private readonly maxPageSize: number;

  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    @InjectRepository(UserRole) private userRoleRepo: Repository<UserRole>,
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
      relations: ['roles', 'groups'],
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
      .leftJoinAndSelect('userRole.role', 'role')
      .leftJoinAndSelect('user.groups', 'userGroup')
      .leftJoinAndSelect('userGroup.group', 'group');

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
   * Chứa: username, avatar_url, status, created_at
   * KHÔNG chứa: user_id, email, roles, groups (thông tin nhạy cảm)
   */
  private toPublicResponse(user: User): PublicUserResponseDto {
    return {
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
