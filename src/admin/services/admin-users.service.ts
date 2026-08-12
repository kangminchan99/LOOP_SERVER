import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { GetAdminUsersQueryDto } from '../dto/get-admin-users-query.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findList(query: GetAdminUsersQueryDto): Promise<{
    items: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .orderBy('user.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('user.email ILIKE :search', {
            search: `%${search}%`,
          }).orWhere('user.nickname ILIKE :search', {
            search: `%${search}%`,
          });
        }),
      );
    }

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
