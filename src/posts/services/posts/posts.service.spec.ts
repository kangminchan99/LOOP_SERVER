import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OpenAiService } from '../../../ai/services/open-ai/open-ai.service';
import { CacheService } from '../../../cache/cache.service';
import { NotificationQueueService } from '../../../queues/notification-queue/services/notification-queue/notification-queue.service';
import { Post } from '../../entities/post.entity';
import { GetPostsQueryDto } from '../../dto/get-posts-query.dto';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  let service: PostsService;
  const posts = {
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const cache = {
    getJson: jest.fn(),
    setJson: jest.fn(),
    deleteByPattern: jest.fn(),
  };
  const queue = { addNewPostNotificationJob: jest.fn() };
  const ai = { summarizePost: jest.fn() };
  // DB 대신 조회 결과를 제공하되, 쿼리 조건과 페이지 계산은 실제 로직을 검증한다.
  const qb = {
    innerJoin: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    limit: jest.fn(),
    where: jest.fn(),
    getRawMany: jest.fn(),
  };
  const createdAt = new Date('2026-09-21T12:00:00.123Z');
  const makeRows = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      postId: String(100 - index),
      title: `게시글 ${index}`,
      authorNickname: 'tester',
      createdAt,
    }));

  beforeEach(async () => {
    jest.resetAllMocks();
    for (const method of [
      qb.innerJoin,
      qb.select,
      qb.addSelect,
      qb.orderBy,
      qb.addOrderBy,
      qb.limit,
      qb.where,
    ]) {
      method.mockReturnValue(qb);
    }
    posts.createQueryBuilder.mockReturnValue(qb);
    cache.getJson.mockResolvedValue(null);
    queue.addNewPostNotificationJob.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getRepositoryToken(Post), useValue: posts },
        { provide: CacheService, useValue: cache },
        { provide: NotificationQueueService, useValue: queue },
        { provide: OpenAiService, useValue: ai },
      ],
    }).compile();
    service = module.get(PostsService);
  });

  it('없는 게시글 조회는 실패한다', async () => {
    posts.findOneBy.mockResolvedValue(null);
    await expect(service.findOne(10)).rejects.toThrow(
      '게시글을 찾을 수 없습니다.',
    );
  });

  it('캐시가 있으면 DB 쿼리를 실행하지 않는다', async () => {
    const page = { items: [], nextCursor: null, hasNext: false };
    cache.getJson.mockResolvedValue(page);
    await expect(service.findListItems({ limit: 20 })).resolves.toEqual(page);
    expect(cache.getJson).toHaveBeenCalledWith(
      'posts:list:limit:20:cursor:first',
    );
    expect(posts.createQueryBuilder).not.toHaveBeenCalled();
    expect(cache.setJson).not.toHaveBeenCalled();
  });

  it('캐시가 없으면 기본 20개 기준으로 조회하고 결과를 10초간 캐시한다', async () => {
    const rows = makeRows(1);
    qb.getRawMany.mockResolvedValue(rows);

    const result = await service.findListItems(new GetPostsQueryDto());

    expect(posts.createQueryBuilder).toHaveBeenCalledWith('post');
    expect(qb.orderBy).toHaveBeenCalledWith('post.createdAt', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('post.id', 'DESC');
    expect(qb.limit).toHaveBeenCalledWith(21);
    expect(qb.where).not.toHaveBeenCalled();
    expect(qb.getRawMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      items: [{ ...rows[0], postId: 100 }],
      hasNext: false,
      nextCursor: null,
    });
    expect(cache.setJson).toHaveBeenCalledWith(
      'posts:list:limit:20:cursor:first',
      result,
      10,
    );
  });

  it('21개가 조회되면 20개만 반환하고 20번째 항목으로 커서를 만든다', async () => {
    // 같은 작성 시간이어도 ID를 포함해 다음 페이지 경계를 구분한다.
    const rows = makeRows(21);
    qb.getRawMany.mockResolvedValue(rows);

    const result = await service.findListItems({ limit: 20 });

    expect(qb.limit).toHaveBeenCalledWith(21);
    expect(result.items).toEqual(
      rows.slice(0, 20).map((row) => ({
        ...row,
        postId: Number(row.postId),
      })),
    );
    expect(result.hasNext).toBe(true);
    expect(result.nextCursor).toBe('2026-09-21T12:00:00.123Z_81');
    expect(cache.setJson).toHaveBeenCalledWith(
      'posts:list:limit:20:cursor:first',
      result,
      10,
    );
  });

  it.each([1, 19, 20])('%i개이면 마지막 페이지로 처리한다', async (count) => {
    qb.getRawMany.mockResolvedValue(makeRows(count));

    const result = await service.findListItems({ limit: 20 });

    expect(result.items).toHaveLength(count);
    expect(result.hasNext).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('커서의 시간과 ID로 조회 조건을 만들고 페이지별 캐시 키를 사용한다', async () => {
    const cursor = '2026-09-21T12:00:00.123Z_81';
    qb.getRawMany.mockResolvedValue(
      makeRows(6).map((row, index) => ({ ...row, postId: String(80 - index) })),
    );

    const result = await service.findListItems({ limit: 5, cursor });

    expect(qb.where).toHaveBeenCalledWith(
      '(post.createdAt < :cursorCreatedAt OR (post.createdAt = :cursorCreatedAt AND post.id < :cursorPostId))',
      { cursorCreatedAt: createdAt, cursorPostId: 81 },
    );
    expect(qb.limit).toHaveBeenCalledWith(6);
    expect(result.items).toHaveLength(5);
    expect(result.hasNext).toBe(true);
    expect(result.nextCursor).toBe('2026-09-21T12:00:00.123Z_76');
    expect(cache.getJson).toHaveBeenCalledWith(
      `posts:list:limit:5:cursor:${cursor}`,
    );
    expect(cache.setJson).toHaveBeenCalledWith(
      `posts:list:limit:5:cursor:${cursor}`,
      result,
      10,
    );
  });

  it('조회 결과가 없으면 빈 목록과 마지막 페이지 정보를 캐시한다', async () => {
    qb.getRawMany.mockResolvedValue([]);
    const result = await service.findListItems({ limit: 20 });
    expect(result).toEqual({ items: [], hasNext: false, nextCursor: null });
    expect(cache.setJson).toHaveBeenCalledWith(
      'posts:list:limit:20:cursor:first',
      result,
      10,
    );
  });

  it('DB 조회 실패를 빈 목록으로 숨기거나 캐시하지 않는다', async () => {
    qb.getRawMany.mockRejectedValue(new Error('database unavailable'));
    await expect(service.findListItems({ limit: 20 })).rejects.toThrow(
      'database unavailable',
    );
    expect(cache.setJson).not.toHaveBeenCalled();
  });

  it('작성 후 요약을 저장하고 캐시를 무효화하며 알림 작업을 등록한다', async () => {
    const post = Object.assign(new Post(), {
      id: 10,
      authorId: 1,
      title: '제목',
      content: '본문',
    });
    posts.create.mockReturnValue(post);
    posts.save.mockResolvedValue(post);
    ai.summarizePost.mockResolvedValue('요약');
    const result = await service.create(1, {
      title: ' 제목 ',
      content: ' 본문 ',
    });
    expect(posts.create).toHaveBeenCalledWith({
      title: '제목',
      content: '본문',
      authorId: 1,
      summaryStatus: 'PENDING',
    });
    expect(posts.save).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      summary: '요약',
      summaryStatus: 'COMPLETED',
    });
    expect(cache.deleteByPattern).toHaveBeenCalledWith('posts:list:*');
    expect(queue.addNewPostNotificationJob).toHaveBeenCalledWith({
      postId: 10,
      title: '제목',
      authorId: 1,
    });
  });

  it('다른 작성자의 게시글은 삭제하지 않고 캐시도 유지한다', async () => {
    posts.findOneBy.mockResolvedValue(
      Object.assign(new Post(), { id: 10, authorId: 2 }),
    );
    await expect(service.remove(1, 10)).rejects.toThrow(
      '본인의 게시글만 삭제할 수 있습니다.',
    );
    expect(posts.delete).not.toHaveBeenCalled();
    expect(cache.deleteByPattern).not.toHaveBeenCalled();
  });
});
