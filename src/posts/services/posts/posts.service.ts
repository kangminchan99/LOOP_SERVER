import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheService } from '../../../cache/cache.service';
import { NotificationQueueService } from '../../../queues/notification-queue/services/notification-queue/notification-queue.service';
import { User } from '../../../users/entities/user.entity';
import { CreatePostDto } from '../../dto/create-dto';
import { GetPostsQueryDto } from '../../dto/get-posts-query.dto';
import { GetPostsSearchQueryDto } from '../../dto/get-posts-search-query.dto';
import { PostListItemDto } from '../../dto/post-list-item-dto';
import { PostListPageDto } from '../../dto/post-list-page.dto';
import { Post } from '../../entities/post.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly notificationQueueService: NotificationQueueService,
    private readonly cacheService: CacheService,
  ) {}

  private async invalidatePostListCache(): Promise<void> {
    await this.cacheService.deleteByPattern('posts:list:*');
  }

  async create(authorId: number, dto: CreatePostDto): Promise<Post> {
    const post = this.postsRepository.create({
      title: dto.title.trim(),
      content: dto.content.trim(),
      authorId,
    });
    const savedPost = await this.postsRepository.save(post);

    await this.invalidatePostListCache();

    void this.notificationQueueService
      .addNewPostNotificationJob({
        postId: savedPost.id,
        title: savedPost.title,
        authorId,
      })
      .catch(() => undefined);

    return savedPost;
  }

  async findOne(id: number): Promise<Post> {
    const post = await this.postsRepository.findOneBy({ id });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    return post;
  }

  // 커서 기반 게시글 목록 조회 (최신순)
  async findListItems(query: GetPostsQueryDto): Promise<PostListPageDto> {
    const { cursor, limit = 20 } = query;

    const cacheCursor = cursor ?? 'first';
    const cacheKey = `posts:list:limit:${limit}:cursor:${cacheCursor}`;

    const cachedPage =
      await this.cacheService.getJson<PostListPageDto>(cacheKey);

    if (cachedPage) {
      return cachedPage;
    }

    const qb = this.postsRepository
      .createQueryBuilder('post')
      .innerJoin(User, 'user', 'user.id = post.authorId')
      .select('post.id', 'postId')
      .addSelect('post.title', 'title')
      .addSelect('user.nickname', 'authorNickname')
      .addSelect('post.createdAt', 'createdAt')
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .take(limit + 1);

    if (cursor) {
      const [cursorCreatedAt, cursorPostId] = cursor.split('_');

      qb.where(
        '(post.createdAt < :cursorCreatedAt OR (post.createdAt = :cursorCreatedAt AND post.id < :cursorPostId))',
        {
          cursorCreatedAt: new Date(cursorCreatedAt),
          cursorPostId: Number(cursorPostId),
        },
      );
    }

    const rows = await qb.getRawMany<{
      postId: number | string;
      title: string;
      authorNickname: string;
      createdAt: Date;
    }>();

    const hasNext = rows.length > limit;
    const pageRows = hasNext ? rows.slice(0, limit) : rows;

    const items: PostListItemDto[] = pageRows.map((row) => ({
      postId: Number(row.postId),
      title: row.title,
      authorNickname: row.authorNickname,
      createdAt: row.createdAt,
    }));

    const lastItem = items[items.length - 1];

    const nextCursor =
      hasNext && lastItem
        ? `${lastItem.createdAt.toISOString()}_${lastItem.postId}`
        : null;

    const result = {
      items,
      nextCursor,
      hasNext,
    };

    await this.cacheService.setJson(cacheKey, result, 10);

    return result;
  }

  // 게시글 검색 목록 조회 (제목/본문 기준)
  async searchListItems(
    query: GetPostsSearchQueryDto,
  ): Promise<PostListPageDto> {
    const { keyword, cursor, limit = 20 } = query;

    const qb = this.postsRepository
      .createQueryBuilder('post')
      .innerJoin(User, 'user', 'user.id = post.authorId')
      .select('post.id', 'postId')
      .addSelect('post.title', 'title')
      .addSelect('user.nickname', 'authorNickname')
      .addSelect('post.createdAt', 'createdAt')
      .where('(post.title ILIKE :keyword OR post.content ILIKE :keyword)', {
        keyword: `%${keyword}%`,
      })
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .take(limit + 1);

    if (cursor) {
      const [cursorCreatedAt, cursorPostId] = cursor.split('_');

      qb.andWhere(
        '(post.createdAt < :cursorCreatedAt OR (post.createdAt = :cursorCreatedAt AND post.id < :cursorPostId))',
        {
          cursorCreatedAt: new Date(cursorCreatedAt),
          cursorPostId: Number(cursorPostId),
        },
      );
    }

    const rows = await qb.getRawMany<{
      postId: number | string;
      title: string;
      authorNickname: string;
      createdAt: Date;
    }>();

    const hasNext = rows.length > limit;
    const pageRows = hasNext ? rows.slice(0, limit) : rows;

    const items: PostListItemDto[] = pageRows.map((row) => ({
      postId: Number(row.postId),
      title: row.title,
      authorNickname: row.authorNickname,
      createdAt: row.createdAt,
    }));

    const lastItem = items[items.length - 1];

    const nextCursor =
      hasNext && lastItem
        ? `${lastItem.createdAt.toISOString()}_${lastItem.postId}`
        : null;

    return {
      items,
      nextCursor,
      hasNext,
    };
  }

  // 게시글 삭제 (작성자만 가능)
  async remove(userId: number, postId: number): Promise<Post> {
    const post = await this.postsRepository.findOneBy({ id: postId });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    if (post.authorId !== userId) {
      throw new ForbiddenException('본인의 게시글만 삭제할 수 있습니다.');
    }
    await this.postsRepository.delete(postId);

    await this.invalidatePostListCache();

    return post;
  }

  // 게시글 수정 (작성자만 가능)
  async update(
    userId: number,
    postId: number,
    dto: Partial<CreatePostDto>,
  ): Promise<Post> {
    const post = await this.postsRepository.findOneBy({ id: postId });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    if (post.authorId !== userId) {
      throw new ForbiddenException('본인의 게시글만 수정할 수 있습니다.');
    }
    if (dto.title !== undefined) {
      post.title = dto.title.trim();
    }
    if (dto.content !== undefined) {
      post.content = dto.content.trim();
    }

    const updatedPost = await this.postsRepository.save(post);

    await this.invalidatePostListCache();

    return updatedPost;
  }
}
