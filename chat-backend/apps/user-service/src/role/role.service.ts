import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './role.entity';
import {
  RoleCreateDto,
  RoleUpdateDto,
  RoleQueryDto,
  PaginatedResponseDto,
} from '@app/contracts';

@Injectable()
export class RoleService {
  constructor(@InjectRepository(Role) private repo: Repository<Role>) {}

  // CREATE ROLE
  create(dto: RoleCreateDto) {
    const role = this.repo.create(dto);
    return this.repo.save(role);
  }

  // GET ALL with pagination, filtering, sorting
  async findAll(
    query: RoleQueryDto,
  ): Promise<PaginatedResponseDto<Role>> {
    const {
      search,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'ASC',
    } = query;

    const queryBuilder = this.repo.createQueryBuilder('role');

    // Filtering: Search
    if (search && search.trim() !== '') {
      queryBuilder.where('role.name ILIKE :search', {
        search: `%${search.trim()}%`,
      });
    }

    // Sorting
    const allowedSortFields = ['name', 'role_id'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'name';
    queryBuilder.orderBy(`role.${sortField}`, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Get total count and data
    const [roles, total] = await queryBuilder.getManyAndCount();

    return {
      data: roles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // FIND BY ID
  async findById(id: number) {
    const role = await this.repo.findOne({ where: { role_id: id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  // UPDATE
  async update(id: number, dto: RoleUpdateDto) {
    const role = await this.findById(id);
    Object.assign(role, dto);
    return this.repo.save(role);
  }

  // DELETE
  delete(id: number) {
    return this.repo.delete({ role_id: id });
  }
}
