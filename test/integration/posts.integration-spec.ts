import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { DataSource, Repository } from 'typeorm';
import { OpenAiService } from '../../src/ai/services/open-ai/open-ai.service';
import { CacheService } from '../../src/cache/cache.service';
import { Post } from '../../src/posts/entities/post.entity';
import { PostsService } from '../../src/posts/services/posts/posts.service';
import { NotificationQueueService } from '../../src/queues/notification-queue/services/notification-queue/notification-queue.service';
import { User } from '../../src/users/entities/user.entity';

// AppModule과 .env를 읽지 않는다. 개발 DB/Redis로 연결되는 것을 방지한다.
const schema = `integration_${randomUUID().replaceAll('-', '')}`;
const firstPageKey = 'posts:list:limit:20:cursor:first';

describe('게시글 조회 + PostgreSQL + Redis 통합', () => {
  let module: TestingModule | undefined;
  let source: DataSource;
  let redis: Redis;
  let cache: CacheService;
  let service: PostsService;
  let posts: Repository<Post>;
  let authorId: number;
  let expectedIds: number[];

  beforeAll(async () => {
    // 먼저 빠르게 연결 확인. 실패하면 CacheService의 자동 재연결을 시작하지 않는다.
    redis = new Redis({
      host: '127.0.0.1',
      port: 56379,
      lazyConnect: true,
      connectTimeout: 3000,
      retryStrategy: () => null,
      maxRetriesPerRequest: 0,
    });
    redis.on('error', () => undefined);
    await redis.connect();
    await redis.ping();

    source = new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      port: 55432,
      username: 'loop_test',
      password: 'loop_test_only',
      database: 'loop_integration_test',
      schema,
      entities: [User, Post],
      synchronize: false,
      extra: { connectionTimeoutMillis: 3000 },
    });
    await source.initialize();
    // 테스트 실행마다 새로운 스키마를 사용한다. 기존 테이블을 초기화하지 않는다.
    await source.query(`CREATE SCHEMA "${schema}"`);
    await source.synchronize();
    posts = source.getRepository(Post);

    module = await Test.createTestingModule({
      providers: [
        PostsService,
        CacheService,
        { provide: getRepositoryToken(Post), useValue: posts },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            REDIS_HOST: '127.0.0.1',
            REDIS_PORT: 56379,
          }),
        },
        // 이번 대상이 아닌 유료 API와 알림 큐만 mock으로 분리한다.
        { provide: OpenAiService, useValue: { summarizePost: jest.fn() } },
        {
          provide: NotificationQueueService,
          useValue: {
            addNewPostNotificationJob: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();
    cache = module.get(CacheService);
    service = module.get(PostsService);
  });

  beforeEach(async () => {
    await cache.deleteByPattern('posts:list:*');
    await posts.createQueryBuilder().delete().execute();
    await source.getRepository(User).createQueryBuilder().delete().execute();
    const user = await source
      .getRepository(User)
      .save({ nickname: '통합테스터' });
    authorId = user.id;
    // 동일 시각 경계와 서로 다른 시각을 함께 검증한다.
    const saved = await posts.save(
      Array.from({ length: 45 }, (_, index) =>
        posts.create({
          authorId,
          title: `테스트 게시글 ${index}`,
          content: '통합 테스트 본문',
          createdAt: new Date(
            index < 25
              ? '2026-09-20T12:00:00.123Z'
              : '2026-09-21T12:00:00.456Z',
          ),
        }),
      ),
    );
    expectedIds = saved
      .sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id,
      )
      .map((post) => post.id);
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    try {
      await module?.close();
    } finally {
      try {
        if (source?.isInitialized) {
          try {
            await source.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
          } finally {
            await source.destroy();
          }
        }
      } finally {
        redis?.disconnect();
      }
    }
  });

  it('캐시 미적중 시 실제 조회 결과와 10초 TTL을 저장한다', async () => {
    expect(await redis.get(firstPageKey)).toBeNull();
    const page = await service.findListItems({ limit: 20 });
    expect(page.items.map((item) => item.postId)).toEqual(
      expectedIds.slice(0, 20),
    );
    expect(page.items[0].authorNickname).toBe('통합테스터');
    expect(await redis.get(firstPageKey)).toBe(JSON.stringify(page));
    const ttl = await redis.ttl(firstPageKey);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(10);
  });

  it('실제 캐시 적중 시 SQL 조회를 생략하고 같은 JSON 응답을 반환한다', async () => {
    const first = await service.findListItems({ limit: 20 });
    const query = jest.spyOn(posts, 'createQueryBuilder');
    const cached = await service.findListItems({ limit: 20 });
    expect(JSON.stringify(cached)).toBe(JSON.stringify(first));
    expect(query).not.toHaveBeenCalled();
  });

  it('동일 작성 시각을 포함한 45개를 중복·누락 없이 세 페이지로 조회한다', async () => {
    const first = await service.findListItems({ limit: 20 });
    expect(first.hasNext).toBe(true);
    expect(first.nextCursor).not.toBeNull();
    const second = await service.findListItems({
      limit: 20,
      cursor: first.nextCursor!,
    });
    expect(second.hasNext).toBe(true);
    const third = await service.findListItems({
      limit: 20,
      cursor: second.nextCursor!,
    });
    expect(third.items).toHaveLength(5);
    expect(third.hasNext).toBe(false);
    expect(third.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items, ...third.items].map(
      (item) => item.postId,
    );
    expect(ids).toEqual(expectedIds);
    expect(new Set(ids).size).toBe(45);
  });

  it('빈 테이블은 빈 마지막 페이지를 반환한다', async () => {
    await posts.createQueryBuilder().delete().execute();
    await expect(service.findListItems({ limit: 20 })).resolves.toEqual({
      items: [],
      nextCursor: null,
      hasNext: false,
    });
  });

  it('수정 후 목록 캐시를 지우고 최신 제목을 다시 조회한다', async () => {
    await service.findListItems({ limit: 20 });
    await service.update(authorId, expectedIds[0], { title: '수정된 제목' });
    expect(await redis.get(firstPageKey)).toBeNull();
    const page = await service.findListItems({ limit: 20 });
    expect(page.items[0].title).toBe('수정된 제목');
  });

  it('Redis TTL 경과 후 실제로 캐시가 만료된다', async () => {
    const key = `posts:list:ttl:${schema}`;
    await cache.setJson(key, { value: 1 }, 1);
    await expect(cache.getJson(key)).resolves.toEqual({ value: 1 });
    const deadline = Date.now() + 5000;
    while (await redis.exists(key)) {
      if (Date.now() >= deadline)
        throw new Error('TTL 이후 캐시가 만료되지 않았습니다.');
      await delay(100);
    }
    await expect(cache.getJson(key)).resolves.toBeNull();
  });
});
