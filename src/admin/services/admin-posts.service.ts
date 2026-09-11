import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Post } from '../../posts/entities/post.entity';
import { User } from '../../users/entities/user.entity';
import { AdminPostListItemDto } from '../dto/admin-post-list-item.dto';
import { GetAdminPostsQueryDto } from '../dto/get-admin-posts-query.dto';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class AdminPostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    private readonly cacheService: CacheService,
  ) {}

  async findList(query: GetAdminPostsQueryDto): Promise<{
    items: AdminPostListItemDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const queryBuilder = this.postsRepository
      .createQueryBuilder('post')
      .orderBy('post.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('post.title ILIKE :search', {
            search: `%${search}%`,
          }).orWhere('post.content ILIKE :search', {
            search: `%${search}%`,
          });
        }),
      );
    }

    const [posts, total] = await queryBuilder.getManyAndCount();

    const authorIds = [...new Set(posts.map((post) => post.authorId))];

    const authors = authorIds.length
      ? await this.usersRepository.findByIds(authorIds)
      : [];

    const authorMap = new Map(
      authors.map((author) => [author.id, author.nickname]),
    );

    return {
      items: posts.map((post) => ({
        id: post.id,
        title: post.title,
        contentPreview:
          post.content.length > 80
            ? `${post.content.slice(0, 80)}...`
            : post.content,
        authorId: post.authorId,
        authorNickname: authorMap.get(post.authorId) ?? null,
        summaryStatus: post.summaryStatus,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async remove(postId: number): Promise<void> {
    // 1. 해당 게시글 삭제
    const result = await this.postsRepository.delete(postId);

    // 2. 삭제한 행이 없으면 존재하지 않는 게시글
    if (result.affected === 0) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    // 3. 이전 게시글 목록이 나오지 않도록 캐시 삭제
    await this.cacheService.deleteByPattern('posts:list:*');
  }
}
