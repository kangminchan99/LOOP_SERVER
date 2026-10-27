import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import type { App } from 'supertest/types';
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
import { PostsController } from '../../src/posts/controllers/posts/posts.controller';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';
import { createValidationPipe } from '../../src/common/pipes/create-validation-pipe';
import { UserBlocksController } from '../../src/user-blocks/controllers/user-blocks.controller';
import { UserBlock } from '../../src/user-blocks/entities/user-block.entity';
import { UserBlocksRepository } from '../../src/user-blocks/repositories/user-blocks-repository';
import { UserBlocksService } from '../../src/user-blocks/services/user-blocks.service';
import type { PostListPageDto } from '../../src/posts/dto/post-list-page.dto';

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
  let app: INestApplication<App> | undefined;
  const jwt = new JwtService({ secret: 'http-integration-only-secret' });
  const authHeader = (userId: number) =>
    `Bearer ${jwt.sign({ sub: userId, type: 'access', role: 'USER' }, { expiresIn: '5m' })}`;

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
      entities: [User, Post, UserBlock],
      synchronize: false,
      extra: {
        max: 8,
        connectionTimeoutMillis: 3000,
        // 차단 Repository의 raw SQL도 실행별 테스트 스키마로 한정한다.
        options: `-c search_path=${schema}`,
      },
    });
    await source.initialize();
    // 테스트 실행마다 새로운 스키마를 사용한다. 기존 테이블을 초기화하지 않는다.
    await source.query(`CREATE SCHEMA "${schema}"`);
    await source.synchronize();
    posts = source.getRepository(Post);

    module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [PostsController, UserBlocksController],
      providers: [
        JwtStrategy,
        PostsService,
        UserBlocksService,
        UserBlocksRepository,
        CacheService,
        { provide: DataSource, useValue: source },
        { provide: getRepositoryToken(Post), useValue: posts },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            REDIS_HOST: '127.0.0.1',
            REDIS_PORT: 56379,
            JWT_SECRET: 'http-integration-only-secret',
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
    app = module.createNestApplication<INestApplication<App>>();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
    await app.listen(0, '127.0.0.1');
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
      if (app) await app.close();
      else await module?.close();
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

  it('목록·검색 모두 DB에서 limit+1개만 읽는다', async () => {
    const qb = posts.createQueryBuilder('post');
    const searchQb = posts.createQueryBuilder('post');
    const read = jest.spyOn(qb, 'getRawMany');
    const searchRead = jest.spyOn(searchQb, 'getRawMany');
    jest
      .spyOn(posts, 'createQueryBuilder')
      .mockReturnValueOnce(qb)
      .mockReturnValueOnce(searchQb);
    await service.findListItems({ limit: 20 });
    expect(qb.getSql()).toMatch(/LIMIT 21$/);
    await expect(
      read.mock.results[0].value as Promise<unknown[]>,
    ).resolves.toHaveLength(21);
    await service.searchListItems({ keyword: '테스트', limit: 5 });
    expect(searchQb.getSql()).toMatch(/LIMIT 6$/);
    await expect(
      searchRead.mock.results[0].value as Promise<unknown[]>,
    ).resolves.toHaveLength(6);
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

  describe('게시글 HTTP API', () => {
    const http = () => request(app!.getHttpServer());

    it('GET /posts는 기본 20개와 다음 커서를 반환하고 다음 페이지를 조회한다', async () => {
      const first = await http().get('/posts').expect(200);
      const body = first.body as {
        items: { postId: number }[];
        nextCursor: string;
        hasNext: boolean;
      };
      expect(body.items.map((item) => item.postId)).toEqual(
        expectedIds.slice(0, 20),
      );
      expect(body.hasNext).toBe(true);
      expect(typeof body.nextCursor).toBe('string');
      const second = await http()
        .get('/posts')
        .query({ limit: 20, cursor: body.nextCursor })
        .expect(200);
      const next = second.body as { items: { postId: number }[] };
      expect(next.items.map((item) => item.postId)).toEqual(
        expectedIds.slice(20, 40),
      );
    });

    it.each(['0', '51', '-1', '1.5', 'abc'])(
      '잘못된 limit=%s는 400',
      async (limit) => {
        await http().get('/posts').query({ limit }).expect(400);
      },
    );

    it.each([
      'invalid',
      '2026-02-30T12:00:00.000Z_1',
      '2026-09-21T12:00:00.000Z_0',
      '2026-09-21T12:00:00.000Z_2147483648',
    ])('잘못된 cursor=%s는 목록·검색 모두 400', async (cursor) => {
      await http().get('/posts').query({ cursor }).expect(400);
      await http()
        .get('/posts/search')
        .query({ keyword: '테스트', cursor })
        .expect(400);
    });

    it('알 수 없는 쿼리 필드는 400', async () => {
      await http().get('/posts').query({ unexpected: 'value' }).expect(400);
    });

    it('존재하지 않는 게시글은 404, 숫자가 아닌 경로 ID는 400', async () => {
      await http().get('/posts/2147483647').expect(404);
      await http().get('/posts/not-a-number').expect(400);
    });

    it('토큰 없는 작성·수정·삭제는 401', async () => {
      const count = await posts.count();
      await http()
        .post('/posts')
        .send({ title: '제목', content: '본문' })
        .expect(401);
      await http()
        .patch(`/posts/${expectedIds[0]}`)
        .send({ title: '수정' })
        .expect(401);
      await http().delete(`/posts/${expectedIds[0]}`).expect(401);
      expect(await posts.count()).toBe(count);
    });

    it('잘못된 서명·만료·refresh 토큰은 401', async () => {
      const tokens = [
        jwt.sign({ sub: authorId, type: 'access' }, { secret: 'wrong-secret' }),
        jwt.sign({ sub: authorId, type: 'access' }, { expiresIn: -1 }),
        jwt.sign({ sub: authorId, type: 'refresh' }),
      ];
      for (const token of tokens) {
        await http()
          .post('/posts')
          .set('Authorization', `Bearer ${token}`)
          .send({ title: '제목', content: '본문' })
          .expect(401);
      }
    });

    it('인증된 사용자도 잘못된 본문·작성자 위조 필드는 400', async () => {
      const count = await posts.count();
      for (const body of [
        { title: '', content: '본문' },
        { title: '제목' },
        { title: '제목', content: '본문', authorId: 123 },
      ]) {
        await http()
          .post('/posts')
          .set('Authorization', authHeader(authorId))
          .send(body)
          .expect(400);
      }
      expect(await posts.count()).toBe(count);
    });

    it('다른 사용자의 수정·삭제는 403이며 DB 데이터는 유지된다', async () => {
      const other = await source
        .getRepository(User)
        .save({ nickname: '다른 사용자' });
      const id = expectedIds[0];
      const before = await posts.findOneByOrFail({ id });
      await http()
        .patch(`/posts/${id}`)
        .set('Authorization', authHeader(other.id))
        .send({ title: '변경' })
        .expect(403);
      await http()
        .delete(`/posts/${id}`)
        .set('Authorization', authHeader(other.id))
        .expect(403);
      expect(await posts.findOneByOrFail({ id })).toEqual(before);
    });

    it('본인은 작성·상세 조회·수정·삭제할 수 있고 DB에도 반영된다', async () => {
      const created = await http()
        .post('/posts')
        .set('Authorization', authHeader(authorId))
        .send({ title: '새 게시글', content: '본문' })
        .expect(201);
      const body = created.body as { id: number; authorId: number };
      expect(body.authorId).toBe(authorId);
      expect((await posts.findOneByOrFail({ id: body.id })).title).toBe(
        '새 게시글',
      );
      await http().get(`/posts/${body.id}`).expect(200);
      await http()
        .patch(`/posts/${body.id}`)
        .set('Authorization', authHeader(authorId))
        .send({ title: '수정 제목' })
        .expect(200);
      expect((await posts.findOneByOrFail({ id: body.id })).title).toBe(
        '수정 제목',
      );
      await http()
        .delete(`/posts/${body.id}`)
        .set('Authorization', authHeader(authorId))
        .expect(200);
      expect(await posts.findOneBy({ id: body.id })).toBeNull();
    });
  });

  describe('게시글 차단 가시성 HTTP API', () => {
    const http = () => request(app!.getHttpServer());
    let viewerId: number;
    let otherViewerId: number;
    let visibleAuthorId: number;
    let visibleIds: number[];
    let ownPostId: number;

    const blockAuthor = (target = authorId, viewer = viewerId) =>
      http()
        .put(`/users/me/blocks/${target}`)
        .set('Authorization', authHeader(viewer))
        .expect(200);

    const get = (path: string, viewer?: number) => {
      const req = http().get(path);
      return viewer === undefined
        ? req
        : req.set('Authorization', authHeader(viewer));
    };

    beforeEach(async () => {
      const users = source.getRepository(User);
      const savedUsers = await users.save([
        { nickname: '조회자 A' },
        { nickname: '조회자 C' },
        { nickname: '보이는 작성자 D' },
      ]);
      [viewerId, otherViewerId, visibleAuthorId] = savedUsers.map(
        (user) => user.id,
      );
      // 원본 첫 페이지는 차단 대상의 글로만 채워지고, 가시 글은 그보다 오래됐다.
      const visible = await posts.save(
        Array.from({ length: 27 }, (_, index) => ({
          authorId: visibleAuthorId,
          title: `테스트 허용 게시글 ${index}`,
          content: '보이는 작성자의 본문',
          createdAt: new Date('2026-09-19T12:00:00.123Z'),
        })),
      );
      const own = await posts.save({
        authorId: viewerId,
        title: '테스트 내 게시글',
        content: '조회자 자신의 본문',
        createdAt: new Date('2026-09-18T12:00:00.123Z'),
      });
      ownPostId = own.id;
      visibleIds = [
        ...visible.map((post) => post.id).sort((a, b) => b - a),
        own.id,
      ];
    });

    it('원본 첫 20개가 모두 차단돼도 가시 글 20개와 올바른 다음 커서를 반환한다', async () => {
      await blockAuthor();
      const response = await get('/posts', viewerId)
        .query({ limit: 20 })
        .expect(200)
        .expect('Cache-Control', 'private, no-store');
      const page = response.body as PostListPageDto;
      expect(page.items.map((post) => post.postId)).toEqual(
        visibleIds.slice(0, 20),
      );
      expect(page.hasNext).toBe(true);
      const last = page.items.at(-1)!;
      expect(page.nextCursor).toBe(
        `${last.createdAt as unknown as string}_${last.postId}`,
      );
    });

    it.each(['/posts', '/posts/search'])(
      '%s는 같은 작성 시각 경계에서도 차단 제외 후 커서를 중복·누락 없이 순회한다',
      async (path) => {
        await blockAuthor();
        const ids: number[] = [];
        let cursor: string | null = null;
        for (let index = 0; index < 5; index++) {
          const response = await get(path, viewerId)
            .query({
              limit: 10,
              ...(path.endsWith('search') ? { keyword: '테스트' } : {}),
              ...(cursor ? { cursor } : {}),
            })
            .expect(200);
          const page = response.body as PostListPageDto;
          ids.push(...page.items.map((post) => post.postId));
          if (!page.hasNext) {
            expect(page.nextCursor).toBeNull();
            break;
          }
          cursor = page.nextCursor;
        }
        expect(ids).toEqual(visibleIds);
        expect(new Set(ids).size).toBe(visibleIds.length);
      },
    );

    it('차단한 작성자의 글만 검색되면 빈 마지막 페이지다', async () => {
      await blockAuthor();
      const response = await get('/posts/search', viewerId)
        .query({ keyword: '테스트 게시글', limit: 20 })
        .expect(200);
      expect(response.body).toEqual({
        items: [],
        hasNext: false,
        nextCursor: null,
      });
    });

    it('로그아웃 및 차단하지 않은 다른 계정은 공개 글을 계속 조회한다', async () => {
      await blockAuthor();
      for (const viewer of [undefined, otherViewerId, authorId]) {
        const list = (
          await get('/posts', viewer).query({ limit: 20 }).expect(200)
        ).body as PostListPageDto;
        expect(list.items.map((post) => post.postId)).toEqual(
          expectedIds.slice(0, 20),
        );
        const search = (
          await get('/posts/search', viewer)
            .query({ keyword: '테스트 게시글' })
            .expect(200)
        ).body as PostListPageDto;
        expect(search.items.map((post) => post.postId)).toEqual(
          expectedIds.slice(0, 20),
        );
        await get(`/posts/${expectedIds[0]}`, viewer).expect(200);
      }
    });

    it('상세 직접 접근은 404이며 자신의 글·미차단 작성자의 글은 유지한다', async () => {
      await blockAuthor();
      const hidden = await get(`/posts/${expectedIds[0]}`, viewerId).expect(
        404,
      );
      const absent = await get('/posts/2147483647', viewerId).expect(404);
      expect(hidden.body).toEqual(absent.body);
      expect(hidden.body).not.toHaveProperty('content');
      await get(`/posts/${ownPostId}`, viewerId).expect(200);
      await get(`/posts/${visibleIds[0]}`, viewerId).expect(200);
    });

    it('차단 방향은 단방향이며 다른 조회자의 차단 설정이 섞이지 않는다', async () => {
      await blockAuthor();
      await blockAuthor(visibleAuthorId, otherViewerId);
      const a = (await get('/posts', viewerId).query({ limit: 50 }).expect(200))
        .body as PostListPageDto;
      expect(a.items.map((post) => post.postId)).toEqual(visibleIds);
      const c = (
        await get('/posts', otherViewerId).query({ limit: 50 }).expect(200)
      ).body as PostListPageDto;
      expect(c.items.map((post) => post.postId)).toEqual([
        ...expectedIds,
        ownPostId,
      ]);
      // A가 B를 차단했다고 해서 B의 조회에서 A의 글을 숨기지는 않는다.
      await get(`/posts/${ownPostId}`, authorId).expect(200);
    });

    it('익명 캐시를 먼저 채워도 로그인 결과는 캐시를 읽거나 덮어쓰지 않는다', async () => {
      await http().get('/posts').query({ limit: 20 }).expect(200);
      const publicPage = await redis.get(firstPageKey);
      expect(publicPage).not.toBeNull();
      await blockAuthor();
      const read = jest.spyOn(cache, 'getJson');
      const write = jest.spyOn(cache, 'setJson');
      const response = await get('/posts', viewerId)
        .query({ limit: 20 })
        .expect(200);
      expect(
        (response.body as PostListPageDto).items.map((post) => post.postId),
      ).toEqual(visibleIds.slice(0, 20));
      expect(read).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
      expect(await redis.get(firstPageKey)).toBe(publicPage);
    });

    it('로그인 결과는 빈 공용 캐시에도 저장하지 않는다', async () => {
      await blockAuthor();
      const key = 'posts:list:limit:13:cursor:first';
      await get('/posts', viewerId).query({ limit: 13 }).expect(200);
      expect(await redis.get(key)).toBeNull();
      const anonymous = (await get('/posts').query({ limit: 13 }).expect(200))
        .body as PostListPageDto;
      expect(anonymous.items.map((post) => post.postId)).toEqual(
        expectedIds.slice(0, 13),
      );
    });

    it('차단 해제 직후 첫 페이지·검색·상세에서 글이 다시 보인다', async () => {
      await blockAuthor();
      await get(`/posts/${expectedIds[0]}`, viewerId).expect(404);
      await http()
        .delete(`/users/me/blocks/${authorId}`)
        .set('Authorization', authHeader(viewerId))
        .expect(204);
      const page = (await get('/posts', viewerId).expect(200))
        .body as PostListPageDto;
      expect(page.items.map((post) => post.postId)).toEqual(
        expectedIds.slice(0, 20),
      );
      const search = (
        await get('/posts/search', viewerId)
          .query({ keyword: '테스트 게시글' })
          .expect(200)
      ).body as PostListPageDto;
      expect(search.items.map((post) => post.postId)).toEqual(
        expectedIds.slice(0, 20),
      );
      await get(`/posts/${expectedIds[0]}`, viewerId).expect(200);
    });

    it('모든 작성자를 차단하면 목록은 빈 마지막 페이지다', async () => {
      // 자신의 글은 남는 것이 정상이라 이 케이스에서는 자신의 글만 먼저 삭제한다.
      await posts.delete(ownPostId);
      await blockAuthor();
      await blockAuthor(visibleAuthorId);
      const response = await get('/posts', viewerId).expect(200);
      expect(response.body).toEqual({
        items: [],
        hasNext: false,
        nextCursor: null,
      });
    });

    it.each(['wrong-signature', 'expired', 'refresh', 'malformed-header'])(
      '%s 인증을 익명 조회로 강등하지 않고 세 조회 API 모두 401로 거절한다',
      async (kind) => {
        await http().get('/posts').expect(200); // 공용 캐시 적중 경로도 인증을 우회하면 안 된다.
        const token =
          kind === 'wrong-signature'
            ? jwt.sign(
                { sub: viewerId, type: 'access' },
                { secret: 'wrong-secret' },
              )
            : jwt.sign(
                {
                  sub: viewerId,
                  type: kind === 'refresh' ? 'refresh' : 'access',
                },
                { expiresIn: kind === 'expired' ? -1 : '5m' },
              );
        const header =
          kind === 'malformed-header' ? 'Basic invalid' : `Bearer ${token}`;
        for (const path of [
          '/posts',
          '/posts/search?keyword=테스트',
          `/posts/${expectedIds[0]}`,
        ]) {
          await http()
            .get(encodeURI(path))
            .set('Authorization', header)
            .expect(401);
        }
      },
    );

    it.each([undefined, 'not-a-number', 0, -1, 2147483648])(
      '인증 결과 사용자 ID %s가 잘못되면 익명으로 처리하지 않는다',
      async (sub) => {
        const token = jwt.sign({ sub, type: 'access' }, { expiresIn: '5m' });
        await http()
          .get('/posts')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);
      },
    );
  });
});
