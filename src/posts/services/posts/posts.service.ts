import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAiService } from '../../../ai/services/open-ai/open-ai.service';
import { CacheService } from '../../../cache/cache.service';
import { NotificationQueueService } from '../../../queues/notification-queue/services/notification-queue/notification-queue.service';
import { UserBlock } from '../../../user-blocks/entities/user-block.entity';
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
    private readonly openAiService: OpenAiService,
  ) {}

  private async invalidatePostListCache(): Promise<void> {
    await this.cacheService.deleteByPattern('posts:list:*');
  }

  async create(authorId: number, dto: CreatePostDto): Promise<Post> {
    const post = this.postsRepository.create({
      title: dto.title.trim(),
      content: dto.content.trim(),
      authorId,
      summaryStatus: 'PENDING',
    });

    const savedPost = await this.postsRepository.save(post);

    const summary = await this.openAiService.summarizePost({
      title: savedPost.title,
      content: savedPost.content,
    });

    if (summary) {
      savedPost.summary = summary;
      savedPost.summaryStatus = 'COMPLETED';
      savedPost.summaryError = null;
      savedPost.summaryGeneratedAt = new Date();
    } else {
      savedPost.summary = null;
      savedPost.summaryStatus =
        savedPost.content.length < 100 ? 'SKIPPED' : 'FAILED';
      savedPost.summaryError =
        savedPost.content.length < 100 ? null : 'AI_SUMMARY_FAILED';
      savedPost.summaryGeneratedAt = null;
    }

    const postWithSummary = await this.postsRepository.save(savedPost);

    await this.invalidatePostListCache();

    void this.notificationQueueService
      .addNewPostNotificationJob({
        postId: postWithSummary.id,
        title: postWithSummary.title,
        authorId,
      })
      .catch(() => undefined);

    return postWithSummary;
  }

  async findOne(id: number, viewerId?: number): Promise<Post> {
    const qb = this.postsRepository
      .createQueryBuilder('post')
      .where('post.id = :postId', { postId: id });

    // 로그인한 사용자가 차단한 작성자의 글은 조회에서 제외한다.
    if (viewerId !== undefined) {
      qb.andWhere(
        (queryBuilder) => {
          const blockedAuthor = queryBuilder
            .subQuery()
            .select('1')
            .from(UserBlock, 'userBlock')
            .where('userBlock.blockerId = :viewerId')
            .andWhere('userBlock.blockedUserId = post.authorId')
            .getQuery();

          return `NOT EXISTS ${blockedAuthor}`;
        },
        { viewerId },
      );
    }

    const post = await qb.getOne();

    // 없는 글과 차단으로 숨겨진 글에 같은 응답을 사용한다.
    if (!post) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    return post;
  }

  // 커서 기반 게시글 목록 조회 (최신순)
  async findListItems(
    query: GetPostsQueryDto,
    viewerId?: number,
  ): Promise<PostListPageDto> {
    const { cursor, limit = 20 } = query;

    const cacheCursor = cursor ?? 'first';
    const cacheKey = `posts:list:limit:${limit}:cursor:${cacheCursor}`;

    // 비로그인 조회만 공용 캐시를 사용한다.
    if (viewerId === undefined) {
      const cachedPage =
        await this.cacheService.getJson<PostListPageDto>(cacheKey);

      if (cachedPage) {
        return cachedPage;
      }
    }

    // 사용자 1명과의 JOIN은 행을 늘리지 않는다. raw 조회에는 take 대신 SQL LIMIT 사용.
    const qb = this.postsRepository
      .createQueryBuilder('post')
      .innerJoin(User, 'user', 'user.id = post.authorId')
      .select('post.id', 'postId')
      .addSelect('post.title', 'title')
      .addSelect('user.nickname', 'authorNickname')
      .addSelect('post.createdAt', 'createdAt')
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .limit(limit + 1);

    // 로그인한 경우 본인이 차단한 작성자의 글을 제외한다.
    if (viewerId !== undefined) {
      qb.andWhere(
        (queryBuilder) => {
          const blockedAuthor = queryBuilder
            .subQuery()
            .select('1')
            .from(UserBlock, 'userBlock')
            .where('userBlock.blockerId = :viewerId')
            .andWhere('userBlock.blockedUserId = post.authorId')
            .getQuery();

          return `NOT EXISTS ${blockedAuthor}`;
        },
        { viewerId },
      );
    }

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

    const result = {
      items,
      nextCursor,
      hasNext,
    };

    // 개인별 조회 결과가 공용 캐시에 섞이지 않도록 한다.
    if (viewerId === undefined) {
      await this.cacheService.setJson(cacheKey, result, 10);
    }

    return result;
  }

  // 게시글 검색 목록 조회 (제목/본문 기준)
  async searchListItems(
    query: GetPostsSearchQueryDto,
    viewerId?: number,
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
      .limit(limit + 1);

    if (viewerId !== undefined) {
      qb.andWhere(
        (queryBuilder) => {
          const blockedAuthor = queryBuilder
            .subQuery()
            .select('1')
            .from(UserBlock, 'userBlock')
            .where('userBlock.blockerId = :viewerId')
            .andWhere('userBlock.blockedUserId = post.authorId')
            .getQuery();

          return `NOT EXISTS ${blockedAuthor}`;
        },
        { viewerId },
      );
    }

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
