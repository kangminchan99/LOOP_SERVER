import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import type { Repository } from 'typeorm';
import { AuthModule } from '../../src/auth/auth.module';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';
import { createValidationPipe } from '../../src/common/pipes/create-validation-pipe';
import { CreateUsersForCouponTests1790654898020 } from '../../src/database/migrations/1790654898020-CreateUsersForCouponTests';
import { CreateUserBlocks1793073086784 } from '../../src/database/migrations/1793073086784-CreateUserBlocks';
import type { UserBlockListPageDto } from '../../src/user-blocks/dto/user-block-list-page.dto';
import type { UserBlockResponseDto } from '../../src/user-blocks/dto/user-block-response.dto';
import { UserBlock } from '../../src/user-blocks/entities/user-block.entity';
import { UserBlocksRepository } from '../../src/user-blocks/repositories/user-blocks-repository';
import { UserBlocksModule } from '../../src/user-blocks/user-blocks.module';
import { User } from '../../src/users/entities/user.entity';

// AppModule/.env는 읽지 않는다. 테스트 DB의 실행별 스키마만 사용한다.
const schema = `user_blocks_it_${randomUUID().replaceAll('-', '')}`;
const secret = 'user-block-http-integration-only-secret';
const jwt = new JwtService({ secret });
const basePath = '/users/me/blocks';
const auth = (id: number) =>
  `Bearer ${jwt.sign({ sub: id, type: 'access', role: 'USER' }, { expiresIn: '5m' })}`;

// 로그인 발급·S3·소셜 인증만 제외하고 실제 JWT 검증은 유지한다.
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    {
      provide: ConfigService,
      useValue: new ConfigService({ JWT_SECRET: secret }),
    },
  ],
  exports: [JwtAuthGuard],
})
class IntegrationAuthModule {}

describe('사용자 차단 API + PostgreSQL + JWT 통합', () => {
  let source: DataSource;
  let module: TestingModule | undefined;
  let app: INestApplication<App> | undefined;
  let users: Repository<User>;
  let blocks: Repository<UserBlock>;
  let repository: UserBlocksRepository;
  let viewerId: number;
  let targetId: number;
  let otherId: number;
  let schemaCreated = false;

  const http = () => request(app!.getHttpServer());
  const block = (target = targetId, viewer = viewerId) =>
    http().put(`${basePath}/${target}`).set('Authorization', auth(viewer));
  const unblock = (target = targetId, viewer = viewerId) =>
    http().delete(`${basePath}/${target}`).set('Authorization', auth(viewer));
  const list = (viewer = viewerId) =>
    http().get(basePath).set('Authorization', auth(viewer));

  beforeAll(async () => {
    source = new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      port: 55432,
      username: 'loop_test',
      password: 'loop_test_only',
      database: 'loop_integration_test',
      schema,
      entities: [User, UserBlock],
      migrations: [
        CreateUsersForCouponTests1790654898020,
        CreateUserBlocks1793073086784,
      ],
      migrationsTableName: 'user_block_test_migrations',
      synchronize: false,
      dropSchema: false,
      migrationsRun: false,
      extra: {
        max: 8,
        connectionTimeoutMillis: 3000,
        options: `-c search_path=${schema} -c lock_timeout=3000 -c statement_timeout=5000`,
      },
    });
    await source.initialize();
    expect(
      await source.query(
        'SELECT current_database() AS database, current_user AS username',
      ),
    ).toEqual([{ database: 'loop_integration_test', username: 'loop_test' }]);
    await source.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    await source.runMigrations({ transaction: 'all' });

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useFactory: () => ({ ...source.options, retryAttempts: 1 }),
          dataSourceFactory: () => Promise.resolve(source),
        }),
        UserBlocksModule,
      ],
    })
      .overrideModule(AuthModule)
      .useModule(IntegrationAuthModule)
      .compile();
    repository = module.get(UserBlocksRepository);
    users = source.getRepository(User);
    blocks = source.getRepository(UserBlock);
    app = module.createNestApplication<INestApplication<App>>();
    app.useLogger(false);
    app.useGlobalPipes(createValidationPipe());
    await app.init();
    // 동시 요청마다 Supertest가 서버를 열고 닫지 않도록 테스트 전용 포트를 유지한다.
    await app.listen(0, '127.0.0.1');
  });

  beforeEach(async () => {
    await blocks.createQueryBuilder().delete().execute();
    await users.createQueryBuilder().delete().execute();
    const saved = await users.save([
      { nickname: '차단 요청자', role: 'USER' },
      { nickname: '차단 대상', role: 'USER' },
      { nickname: '다른 사용자', role: 'USER' },
    ]);
    [viewerId, targetId, otherId] = saved.map((user) => user.id);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    try {
      if (source?.isInitialized && schemaCreated) {
        await source.query(`DROP SCHEMA "${schema}" CASCADE`);
      }
    } finally {
      try {
        if (app) await app.close();
        else await module?.close();
      } finally {
        if (source?.isInitialized) await source.destroy();
      }
    }
  });

  it('일반 사용자도 차단하며 반복 PUT은 관계와 최초 차단 시각을 유지한다', async () => {
    const first = await block()
      .expect(200)
      .expect('Cache-Control', 'private, no-store');
    const second = await block().send({}).expect(200);
    const body = first.body as UserBlockResponseDto;
    expect(body.blockedUserId).toBe(targetId);
    expect(new Date(body.blockedAt).toISOString()).toBe(body.blockedAt);
    expect(second.body).toEqual(body);
    expect(Object.keys(body).sort()).toEqual(['blockedAt', 'blockedUserId']);
    expect(await blocks.count()).toBe(1);
  });

  it('동일 대상 20개 동시 PUT도 한 관계와 같은 시각을 반환한다', async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => block()),
    );
    expect(responses.map((response) => response.status)).toEqual(
      Array(20).fill(200),
    );
    expect(
      new Set(
        responses.map(
          (response) => (response.body as UserBlockResponseDto).blockedAt,
        ),
      ).size,
    ).toBe(1);
    expect(await blocks.count()).toBe(1);
  });

  it('본인 목록만 반환하고 프로필의 null 및 최소 공개 필드를 유지한다', async () => {
    await users.update(targetId, {
      nickname: null as unknown as string,
      profileImageUrl: null,
    });
    await block().expect(200);
    await block(viewerId, otherId).expect(200);
    const response = await list()
      .expect(200)
      .expect('Cache-Control', 'private, no-store');
    const page = response.body as UserBlockListPageDto;
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      userId: targetId,
      nickname: null,
      profileImageUrl: null,
    });
    expect(Object.keys(page.items[0]).sort()).toEqual([
      'blockId',
      'blockedAt',
      'nickname',
      'profileImageUrl',
      'userId',
    ]);
    expect((await list(targetId).expect(200)).body).toEqual({
      items: [],
      hasNext: false,
      nextCursor: null,
    });
  });

  it('같은 차단 시각 23개도 커서 순회에 중복·누락이 없고 다른 계정 관계를 제외한다', async () => {
    const targets = await users.save(
      Array.from({ length: 23 }, (_, i) => ({ nickname: `목록대상${i}` })),
    );
    const saved = await blocks.save(
      targets.map((user) => ({
        blockerId: viewerId,
        blockedUserId: user.id,
        createdAt: new Date('2026-10-27T03:00:00.123Z'),
      })),
    );
    await blocks.save({ blockerId: otherId, blockedUserId: targetId });
    const expected = saved.map((item) => item.id).sort((a, b) => b - a);
    const seen: number[] = [];
    let cursor: string | null = null;
    for (let index = 0; index < 4; index++) {
      const response = await list()
        .query({ limit: 10, ...(cursor ? { cursor } : {}) })
        .expect(200);
      const page = response.body as UserBlockListPageDto;
      seen.push(...page.items.map((item) => item.blockId));
      if (!page.hasNext) {
        expect(page.nextCursor).toBeNull();
        break;
      }
      const last = page.items.at(-1)!;
      expect(page.nextCursor).toBe(`${last.blockedAt}_${last.blockId}`);
      cursor = page.nextCursor;
    }
    expect(seen).toEqual(expected);
  });

  it('limit 생략은 기본 20개, 최대 50개도 정상 조회한다', async () => {
    const targets = await users.save(
      Array.from({ length: 21 }, (_, i) => ({ nickname: `기본대상${i}` })),
    );
    await blocks.save(
      targets.map((user) => ({ blockerId: viewerId, blockedUserId: user.id })),
    );
    const page = (await list().expect(200)).body as UserBlockListPageDto;
    expect(page.items).toHaveLength(20);
    expect(page.hasNext).toBe(true);
    expect(
      (
        (await list().query({ limit: 50 }).expect(200))
          .body as UserBlockListPageDto
      ).items,
    ).toHaveLength(21);
  });

  it('DELETE는 반복해도 204이며 반대 방향과 타인의 관계는 유지한다', async () => {
    await block().expect(200);
    await block(viewerId, targetId).expect(200);
    await block(targetId, otherId).expect(200);
    const response = await unblock().expect(204);
    expect(response.text).toBe('');
    await unblock().expect(204);
    expect(await blocks.count()).toBe(2);
    expect(
      await blocks.existsBy({ blockerId: targetId, blockedUserId: viewerId }),
    ).toBe(true);
    expect(
      await blocks.existsBy({ blockerId: otherId, blockedUserId: targetId }),
    ).toBe(true);
    expect(await users.count()).toBe(3);
  });

  it('다른 계정은 내 차단 관계를 해제할 수 없다', async () => {
    await block().expect(200);
    await unblock(targetId, otherId).expect(204);
    expect(
      await blocks.countBy({ blockerId: viewerId, blockedUserId: targetId }),
    ).toBe(1);
  });

  it('자기 차단은 400, 없는 대상 차단은 404, 없는 대상 해제는 204다', async () => {
    await block(viewerId).expect(400);
    await block(2147483647).expect(404);
    await unblock(2147483647).expect(204);
    expect(await blocks.count()).toBe(0);
  });

  it.each(['0', '-1', 'abc', '1.5', '1e2', '2147483648', '001'])(
    '잘못된 대상 ID %s는 PUT·DELETE 모두 400이다',
    async (id) => {
      await http()
        .put(`${basePath}/${id}`)
        .set('Authorization', auth(viewerId))
        .expect(400);
      await http()
        .delete(`${basePath}/${id}`)
        .set('Authorization', auth(viewerId))
        .expect(400);
    },
  );

  it.each(['0', '51', 'abc', '1.5', ''])(
    '잘못된 limit %s는 400이다',
    async (limit) => {
      await list().query({ limit }).expect(400);
    },
  );

  it.each([
    '',
    'abc',
    '2026-02-30T00:00:00.000Z_1',
    '2026-10-27T00:00:00.000Z_0',
    '2026-10-27T00:00:00.000Z_2147483648',
  ])('잘못된 커서 %s는 400이다', async (cursor) => {
    await list().query({ cursor }).expect(400);
  });

  it('추가 query 및 위조 본문은 거부한다', async () => {
    await list().query({ blockerId: otherId }).expect(400);
    await block().send({ blockerId: otherId }).expect(400);
    await unblock().send({ blockerId: otherId }).expect(400);
    expect(await blocks.count()).toBe(0);
  });

  it('세 API 모두 토큰이 없으면 401이다', async () => {
    await http().put(`${basePath}/${targetId}`).expect(401);
    await http().delete(`${basePath}/${targetId}`).expect(401);
    await http().get(basePath).expect(401);
  });

  it.each(['wrong-signature', 'expired', 'refresh'])(
    '유효하지 않은 %s 토큰을 거부한다',
    async (kind) => {
      const token =
        kind === 'wrong-signature'
          ? new JwtService({ secret: 'wrong-secret' }).sign({
              sub: viewerId,
              type: 'access',
            })
          : jwt.sign(
              {
                sub: viewerId,
                type: kind === 'refresh' ? 'refresh' : 'access',
              },
              { expiresIn: kind === 'expired' ? -1 : '5m' },
            );
      for (const req of [
        http().get(basePath),
        http().put(`${basePath}/${targetId}`),
        http().delete(`${basePath}/${targetId}`),
      ]) {
        await req.set('Authorization', `Bearer ${token}`).expect(401);
      }
    },
  );

  it('서명은 맞아도 삭제된 본인 계정이면 세 API 모두 401이다', async () => {
    await users.delete(viewerId);
    await block().expect(401);
    await unblock().expect(401);
    await list().expect(401);
  });

  it('계정 삭제는 차단 관계만 CASCADE 정리한다', async () => {
    await block().expect(200);
    await block(viewerId, targetId).expect(200);
    await block(targetId, otherId).expect(200);
    await users.delete(targetId);
    expect(await blocks.count()).toBe(0);
    expect(await users.count()).toBe(2);
    await unblock().expect(204);
  });

  it('DB 제약도 자기 차단·중복·존재하지 않는 계정을 거부한다', async () => {
    await expect(
      blocks.insert({ blockerId: viewerId, blockedUserId: viewerId }),
    ).rejects.toMatchObject({ driverError: { code: '23514' } });
    await block().expect(200);
    await expect(
      blocks.insert({ blockerId: viewerId, blockedUserId: targetId }),
    ).rejects.toMatchObject({ driverError: { code: '23505' } });
    await expect(
      blocks.insert({ blockerId: viewerId, blockedUserId: 2147483647 }),
    ).rejects.toMatchObject({ driverError: { code: '23503' } });
  });

  it('실제 잠금 대기가 503으로 종료되고 해제 후 재요청이 성공한다', async () => {
    const runner = source.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await repository.lockPair(runner.manager, targetId, viewerId);
      const response = await block().expect(503);
      expect(response.body).toMatchObject({ code: 'USER_BLOCKS_BUSY' });
      expect(await blocks.count()).toBe(0);
      // 목록은 사용자 쌍 잠금을 기다리지 않는다.
      await list().expect(200);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
    await block().expect(200);
    // 트랜잭션 로컬 설정이 풀 커넥션에 남지 않는다.
    const settings = await source.query<
      { lock_timeout: string; statement_timeout: string }[]
    >(
      "SELECT current_setting('lock_timeout') AS lock_timeout, current_setting('statement_timeout') AS statement_timeout",
    );
    expect(settings[0]).toEqual({
      lock_timeout: '3s',
      statement_timeout: '5s',
    });
  });

  it('실제 장시간 SQL은 statement_timeout으로 취소되고 503으로 변환된다', async () => {
    jest
      .spyOn(repository, 'findPage')
      .mockImplementationOnce(async (manager) => {
        await manager.query('SELECT pg_sleep(4)');
        return [];
      });
    await list()
      .expect(503)
      .expect(({ body }) =>
        expect(body).toMatchObject({ code: 'USER_BLOCKS_BUSY' }),
      );
    await list().expect(200);
  });

  it('사용자 KEY SHARE 잠금은 계정 삭제를 대기시키고 종료 후 해제된다', async () => {
    await source.transaction(async (manager) => {
      await repository.findUserForKeyShare(manager, targetId);
      await expect(
        source.transaction(async (other) => {
          await other.query("SET LOCAL lock_timeout = '150ms'");
          await other.delete(User, targetId);
        }),
      ).rejects.toMatchObject({ driverError: { code: '55P03' } });
    });
    await users.delete(targetId);
    expect(await users.existsBy({ id: targetId })).toBe(false);
  });

  it('차단·해제 혼합 동시 요청도 500 없이 처리되며 마지막 명시적 요청으로 수렴한다', async () => {
    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, i) => (i % 2 ? block() : unblock())),
    );
    expect(
      responses.every((response) => [200, 204].includes(response.status)),
    ).toBe(true);
    await block().expect(200);
    expect(
      await blocks.countBy({ blockerId: viewerId, blockedUserId: targetId }),
    ).toBe(1);
    await unblock().expect(204);
    expect(await blocks.count()).toBe(0);
  });
});
