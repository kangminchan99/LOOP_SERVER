import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AdminCouponEventsController } from '../../src/admin/controllers/admin-coupon-events.controller';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';
import { createValidationPipe } from '../../src/common/pipes/create-validation-pipe';
import { CouponsModule } from '../../src/coupons/coupons.module';
import type { CouponEventResponseDto } from '../../src/coupons/dto/coupon-event-response.dto';
import type {
  CouponEventListPageDto,
  UserCouponListPageDto,
} from '../../src/coupons/dto/coupon-list-page.dto';
import type { UserCouponResponseDto } from '../../src/coupons/dto/user-coupon-response.dto';
import { CouponEvent } from '../../src/coupons/entities/coupon-event.entity';
import { UserCoupon } from '../../src/coupons/entities/user-coupon.entity';
import { CouponEventsRepository } from '../../src/coupons/repositories/coupon-events.repository';
import { CreateUsersForCouponTests1790654898020 } from '../../src/database/migrations/1790654898020-CreateUsersForCouponTests';
import { CreateCouponTables1790656113575 } from '../../src/database/migrations/1790656113575-CreateCouponTables';
import { User } from '../../src/users/entities/user.entity';

// AppModule/.env를 사용하지 않는다. 테스트 DB의 실행별 스키마만 생성·정리한다.
const schema = `coupon_it_${randomUUID().replaceAll('-', '')}`;
const secret = 'coupon-http-integration-only-secret';
const basePath = '/admin/coupon-events';
const jwt = new JwtService({ secret });
const authHeader = (userId: number, role: User['role'] = 'ADMIN') =>
  `Bearer ${jwt.sign({ sub: userId, role, type: 'access' }, { expiresIn: '5m' })}`;

const validInput = () => {
  const start = Date.now() + 60_000;
  return {
    title: '통합 테스트 이벤트',
    totalQuantity: 10,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + 3_600_000).toISOString(),
    couponExpiresAt: new Date(start + 86_400_000).toISOString(),
  };
};

describe('관리자 쿠폰 이벤트 + PostgreSQL + JWT 통합', () => {
  let source: DataSource;
  let module: TestingModule | undefined;
  let app: INestApplication<App> | undefined;
  let events: Repository<CouponEvent>;
  let users: Repository<User>;
  let coupons: Repository<UserCoupon>;
  let repository: CouponEventsRepository;
  let adminId: number;
  let userId: number;

  const http = () => request(app!.getHttpServer());
  const createEvent = async () => {
    const response = await http()
      .post(basePath)
      .set('Authorization', authHeader(adminId))
      .send(validInput())
      .expect(201);
    return response.body as CouponEventResponseDto;
  };

  beforeAll(async () => {
    source = new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      port: 55432,
      username: 'loop_test',
      password: 'loop_test_only',
      database: 'loop_integration_test',
      schema,
      entities: [User, CouponEvent, UserCoupon],
      migrations: [
        CreateUsersForCouponTests1790654898020,
        CreateCouponTables1790656113575,
      ],
      migrationsTableName: 'coupon_migrations',
      synchronize: false,
      dropSchema: false,
      migrationsRun: false,
      extra: {
        max: 6,
        connectionTimeoutMillis: 3000,
        // 마이그레이션의 SQL도 전용 스키마로 향하게 하고 public은 제외한다.
        options: `-c search_path=${schema} -c lock_timeout=3000 -c statement_timeout=5000`,
      },
    });
    await source.initialize();
    const identity = await source.query<
      { database: string; username: string }[]
    >('SELECT current_database() AS database, current_user AS username');
    expect(identity).toEqual([
      { database: 'loop_integration_test', username: 'loop_test' },
    ]);
    await source.query(`CREATE SCHEMA "${schema}"`);
    // synchronize 대신 실제 마이그레이션으로 테이블과 제약을 검증한다.
    await source.runMigrations({ transaction: 'all' });

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useFactory: () => ({ ...source.options, retryAttempts: 1 }),
          dataSourceFactory: () => Promise.resolve(source),
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        CouponsModule,
      ],
      controllers: [AdminCouponEventsController],
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: new ConfigService({ JWT_SECRET: secret }),
        },
      ],
    }).compile();
    repository = module.get(CouponEventsRepository);
    events = source.getRepository(CouponEvent);
    users = source.getRepository(User);
    coupons = source.getRepository(UserCoupon);
    app = module.createNestApplication<INestApplication<App>>();
    app.useLogger(false);
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  beforeEach(async () => {
    await coupons.createQueryBuilder().delete().execute();
    await events.createQueryBuilder().delete().execute();
    await users.createQueryBuilder().delete().execute();
    adminId = (await users.save({ nickname: '쿠폰 관리자', role: 'ADMIN' })).id;
    userId = (await users.save({ nickname: '쿠폰 사용자', role: 'USER' })).id;
  });

  afterEach(() => jest.restoreAllMocks());

  describe('사용자 발급·조회', () => {
    const issue = (eventId: number, id = userId) =>
      http()
        .put(`/coupon-events/${eventId}/my-coupon`)
        .set('Authorization', authHeader(id, 'USER'));
    const get = (path: string, id = userId) =>
      http().get(path).set('Authorization', authHeader(id, 'USER'));
    const activeEvent = async (quantity = 10) => {
      const event = await createEvent();
      await events.update(event.id, {
        isActive: true,
        totalQuantity: quantity,
        startsAt: new Date(Date.now() - 60_000),
      });
      return event;
    };

    it('GET은 발급하지 않고 PUT은 201 → 200, 재조회는 같은 쿠폰을 반환한다', async () => {
      const event = await activeEvent(1);
      await get(`/coupon-events/${event.id}/my-coupon`)
        .expect(404)
        .expect(({ body }) =>
          expect(body).toMatchObject({ code: 'MY_COUPON_NOT_FOUND' }),
        );
      expect(await coupons.count()).toBe(0);
      const first = await issue(event.id)
        .expect(201)
        .expect('Cache-Control', 'private, no-store');
      const coupon = first.body as UserCouponResponseDto;
      expect(coupon).toMatchObject({
        eventId: event.id,
        eventTitle: event.title,
        status: 'ISSUED',
      });
      expect(coupon).not.toHaveProperty('userId');
      await events.update(event.id, { isActive: false });
      const retry = await issue(event.id).send({}).expect(200);
      const lookup = await get(`/coupon-events/${event.id}/my-coupon`).expect(
        200,
      );
      expect((retry.body as UserCouponResponseDto).id).toBe(coupon.id);
      expect((lookup.body as UserCouponResponseDto).id).toBe(coupon.id);
      expect(await coupons.count()).toBe(1);
      expect((await events.findOneByOrFail({ id: event.id })).issuedCount).toBe(
        1,
      );
      // 다른 계정은 발급 결과를 볼 수 없다.
      await get(`/coupon-events/${event.id}/my-coupon`, adminId).expect(404);
      const other = await get('/coupons/me', adminId).expect(200);
      expect((other.body as UserCouponListPageDto).items).toEqual([]);
    });

    it.each([10, 25, 50])(
      '같은 사용자 %i개 동시 요청도 한 장만 발급한다',
      async (concurrency) => {
        const event = await activeEvent();
        const results = await Promise.all(
          Array.from({ length: concurrency }, () => issue(event.id)),
        );
        expect(results.filter((r) => r.status === 201)).toHaveLength(1);
        expect(results.filter((r) => r.status === 200)).toHaveLength(
          concurrency - 1,
        );
        expect(
          new Set(results.map((r) => (r.body as UserCouponResponseDto).id))
            .size,
        ).toBe(1);
        expect(await coupons.countBy({ eventId: event.id })).toBe(1);
        expect(
          (await events.findOneByOrFail({ id: event.id })).issuedCount,
        ).toBe(1);
      },
    );

    it('25명이 7장에 동시 참여해도 정확히 7장만 발급한다', async () => {
      const event = await activeEvent(7);
      const participants = await users.save(
        Array.from({ length: 25 }, (_, i) =>
          users.create({ nickname: `참여자${i}` }),
        ),
      );
      const results = await Promise.all(
        participants.map((user) => issue(event.id, user.id)),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(7);
      expect(
        results.filter(
          (r) =>
            r.status === 409 &&
            (r.body as { code: string }).code === 'COUPON_SOLD_OUT',
        ),
      ).toHaveLength(18);
      expect(await coupons.countBy({ eventId: event.id })).toBe(7);
      expect((await events.findOneByOrFail({ id: event.id })).issuedCount).toBe(
        7,
      );
    });

    it.each([
      ['EVENT_DISABLED', 'disabled'],
      ['EVENT_NOT_STARTED', 'future'],
      ['EVENT_ENDED', 'ended'],
    ])('%s는 409이며 발급량이 변하지 않는다', async (code, state) => {
      const event = await createEvent();
      if (state === 'future') await events.update(event.id, { isActive: true });
      if (state === 'ended')
        await events.update(event.id, {
          isActive: true,
          startsAt: new Date(Date.now() - 120_000),
          endsAt: new Date(Date.now() - 60_000),
        });
      await issue(event.id)
        .expect(409)
        .expect(({ body }) => expect(body).toMatchObject({ code }));
      expect(await coupons.count()).toBe(0);
      expect((await events.findOneByOrFail({ id: event.id })).issuedCount).toBe(
        0,
      );
    });

    it('쿠폰 저장 뒤 수량 증가 실패 시 둘 다 롤백한다', async () => {
      const event = await activeEvent();
      jest
        .spyOn(repository, 'incrementIssuedCount')
        .mockResolvedValueOnce(false);
      await issue(event.id).expect(500);
      expect(await coupons.count()).toBe(0);
      expect((await events.findOneByOrFail({ id: event.id })).issuedCount).toBe(
        0,
      );
      await issue(event.id).expect(201);
    });

    it.each([
      { userId: 123 },
      { issuedCount: 1 },
      [],
      ['x'],
      { issuedAt: '2026-01-01' },
    ])('본문 주입 %j를 거부한다', async (body) => {
      const event = await activeEvent();
      await issue(event.id)
        .send(body)
        .expect(400)
        .expect(({ body: result }) =>
          expect(result).toMatchObject({ code: 'INVALID_COUPON_REQUEST' }),
        );
      expect(await coupons.count()).toBe(0);
    });

    it.each(['0', '-1', '1.5', '2147483648', 'abc'])(
      '잘못된 이벤트 ID %s를 거부한다',
      async (id) => {
        await get(`/coupon-events/${id}`).expect(400);
      },
    );

    it.each([
      'limit=0',
      'limit=51',
      'limit=1.5',
      'cursor=invalid',
      'cursor=2026-02-30T00%3A00%3A00.000Z_1',
      'userId=1',
      'limit=1&limit=2',
    ])('잘못된 목록 요청 %s를 거부한다', async (query) => {
      await get(`/coupon-events?${query}`).expect(400);
      await get(`/coupons/me?${query}`).expect(400);
    });

    it('없는 이벤트와 미발급을 구분한다', async () => {
      await get('/coupon-events/2147483647').expect(404);
      await issue(2147483647)
        .expect(404)
        .expect(({ body }) =>
          expect(body).toMatchObject({ code: 'EVENT_NOT_FOUND' }),
        );
    });

    it('모든 사용자 API는 인증과 현재 계정 존재를 확인한다', async () => {
      const event = await activeEvent();
      const paths = [
        '/coupon-events',
        `/coupon-events/${event.id}`,
        `/coupon-events/${event.id}/my-coupon`,
        '/coupons/me',
      ];
      for (const path of paths)
        await http()
          .get(path)
          .expect(401)
          .expect('Cache-Control', 'private, no-store');
      await http().put(`/coupon-events/${event.id}/my-coupon`).expect(401);
      await users.delete(userId);
      for (const path of paths) await get(path).expect(401);
      await issue(event.id).expect(401);
      expect(await coupons.count()).toBe(0);
    });

    it('동일 시각의 이벤트/쿠폰도 ID 커서로 중복·누락 없이 끝까지 조회한다', async () => {
      const all: number[] = [];
      for (let i = 0; i < 5; i++) {
        const event = await activeEvent();
        all.push(event.id);
        await issue(event.id).expect(201);
      }
      const time = new Date('2026-01-01T00:00:00.000Z');
      await events
        .createQueryBuilder()
        .update()
        .set({ createdAt: time })
        .execute();
      await coupons
        .createQueryBuilder()
        .update()
        .set({ issuedAt: time })
        .execute();
      for (const path of ['/coupon-events', '/coupons/me']) {
        const ids: number[] = [];
        let cursor: string | null = null;
        for (let page = 0; page < 3; page++) {
          const response = await get(
            `${path}?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
          ).expect(200);
          const body = response.body as
            | CouponEventListPageDto
            | UserCouponListPageDto;
          ids.push(
            ...(
              body.items as (CouponEventResponseDto | UserCouponResponseDto)[]
            ).map((item) => ('eventId' in item ? item.eventId : item.id)),
          );
          expect(body.hasNext).toBe(page < 2);
          cursor = body.nextCursor;
        }
        expect(cursor).toBeNull();
        expect(ids).toEqual([...all].reverse());
      }
    });

    it('만료된 기존 쿠폰은 EXPIRED로 반환하고 다시 발급하지 않는다', async () => {
      const event = await activeEvent();
      await issue(event.id).expect(201);
      await coupons.update(
        { eventId: event.id },
        {
          issuedAt: new Date(Date.now() - 120_000),
          expiresAt: new Date(Date.now() - 60_000),
        },
      );
      await events.update(event.id, { isActive: false });
      for (const response of [
        await issue(event.id).expect(200),
        await get(`/coupon-events/${event.id}/my-coupon`).expect(200),
      ]) {
        expect(response.body).toMatchObject({ status: 'EXPIRED' });
      }
      expect(await coupons.count()).toBe(1);
    });

    it('이벤트 잠금 대기가 길면 503, 해제 후 재요청은 정상 발급한다', async () => {
      const event = await activeEvent();
      const runner = source.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await repository.findByIdForUpdate(runner.manager, event.id);
        await issue(event.id)
          .expect(503)
          .expect('Retry-After', '1')
          .expect(({ body }) =>
            expect(body).toMatchObject({
              code: 'COUPON_TEMPORARILY_UNAVAILABLE',
            }),
          );
        expect(await coupons.count()).toBe(0);
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
      await issue(event.id).expect(201);
    });

    it('잠금 대기 중 이벤트가 종료되면 대기 후 DB 시각으로 발급을 거절한다', async () => {
      const event = await activeEvent();
      const runner = source.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      let pending: Promise<request.Response> | undefined;
      try {
        await repository.findByIdForUpdate(runner.manager, event.id);
        let signal!: () => void;
        const attempted = new Promise<void>((resolve) => {
          signal = resolve;
        });
        const original = repository.findByIdForUpdate.bind(
          repository,
        ) as CouponEventsRepository['findByIdForUpdate'];
        jest
          .spyOn(repository, 'findByIdForUpdate')
          .mockImplementationOnce((manager, id) => {
            signal();
            return original(manager, id);
          });
        pending = issue(event.id).then((response) => response);
        await attempted;
        await new Promise((resolve) => setTimeout(resolve, 50));
        const now = await repository.getDatabaseNow(runner.manager);
        await runner.manager.update(CouponEvent, event.id, { endsAt: now });
        await runner.commitTransaction();
        const response = await pending;
        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({ code: 'EVENT_ENDED' });
        expect(await coupons.count()).toBe(0);
      } finally {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await runner.release();
        await pending;
      }
    });

    it('수량 증가 SQL 실행 후 실패해도 쿠폰·수량이 모두 롤백된다', async () => {
      const event = await activeEvent();
      const original = repository.incrementIssuedCount.bind(
        repository,
      ) as CouponEventsRepository['incrementIssuedCount'];
      jest
        .spyOn(repository, 'incrementIssuedCount')
        .mockImplementationOnce(async (manager, id) => {
          await original(manager, id);
          throw new Error('테스트: 커밋 이전 실패');
        });
      await issue(event.id).expect(500);
      expect(await coupons.count()).toBe(0);
      expect((await events.findOneByOrFail({ id: event.id })).issuedCount).toBe(
        0,
      );
    });

    it('계정 삭제와 발급이 경합해도 수량과 이력은 보존한다', async () => {
      const event = await activeEvent();
      const [response] = await Promise.all([
        issue(event.id),
        users.delete(userId),
      ]);
      expect([201, 401]).toContain(response.status);
      const count = await coupons.countBy({ eventId: event.id });
      expect((await events.findOneByOrFail({ id: event.id })).issuedCount).toBe(
        count,
      );
      expect(await coupons.countBy({ userId })).toBe(0);
      await issue(event.id).expect(401);
    });
  });

  afterAll(async () => {
    try {
      if (source?.isInitialized) {
        // 실제 마이그레이션의 down(public 지정)은 실행하지 않는다.
        await source.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
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

  it('실제 마이그레이션 두 개가 전용 스키마에 적용된다', async () => {
    const rows = await source.query<{ name: string }[]>(
      `SELECT name FROM "${schema}".coupon_migrations ORDER BY id`,
    );
    expect(rows.map((row) => row.name)).toEqual([
      'CreateUsersForCouponTests1790654898020',
      'CreateCouponTables1790656113575',
    ]);
    expect(await source.runMigrations()).toEqual([]);
  });

  it('생성은 201, 수량 0·비활성 상태와 DB 시각을 반환한다', async () => {
    const response = await http()
      .post(basePath)
      .set('Authorization', authHeader(adminId))
      .send({ ...validInput(), title: '  테스트 쿠폰  ' })
      .expect(201)
      .expect('Cache-Control', 'private, no-store');
    const body = response.body as CouponEventResponseDto;
    expect(body).toMatchObject({
      title: '테스트 쿠폰',
      totalQuantity: 10,
      issuedCount: 0,
      remainingQuantity: 10,
      isActive: false,
    });
    expect(Number.isNaN(Date.parse(body.serverTime))).toBe(false);
    const event = await events.findOneByOrFail({ id: body.id });
    expect(body.startsAt).toBe(event.startsAt.toISOString());
    expect(body.updatedAt).toBe(event.updatedAt.toISOString());
    expect(await events.count()).toBe(1);
    expect(await coupons.count()).toBe(0);
  });

  it.each([
    ['빈 제목', { title: '   ' }],
    ['긴 제목', { title: '가'.repeat(101) }],
    ['0장', { totalQuantity: 0 }],
    ['음수', { totalQuantity: -1 }],
    ['소수 수량', { totalQuantity: 1.5 }],
    ['상한 초과', { totalQuantity: 100001 }],
    ['문자열 수량', { totalQuantity: '10' }],
    ['잘못된 날짜', { startsAt: 'invalid' }],
    ['시간대 누락', { startsAt: '2026-10-01T12:00:00' }],
    ['발급 수량 주입', { issuedCount: 1 }],
    ['생성 시 활성 주입', { isActive: true }],
    ['관리자 ID 주입', { adminUserId: 1 }],
  ])(
    '생성 입력 검증: %s는 400이며 저장하지 않는다',
    async (_name, override) => {
      await http()
        .post(basePath)
        .set('Authorization', authHeader(adminId))
        .send({ ...validInput(), ...override })
        .expect(400);
      expect(await events.count()).toBe(0);
    },
  );

  it.each(['same-start-end', 'reversed-start-end', 'same-end-expiry'])(
    '기간 순서 오류 %s는 400이다',
    async (condition) => {
      const input = validInput();
      if (condition === 'same-start-end') input.endsAt = input.startsAt;
      if (condition === 'reversed-start-end')
        input.startsAt = input.couponExpiresAt;
      if (condition === 'same-end-expiry') input.couponExpiresAt = input.endsAt;
      await http()
        .post(basePath)
        .set('Authorization', authHeader(adminId))
        .send(input)
        .expect(400);
      expect(await events.count()).toBe(0);
    },
  );

  it.each(['create', 'activation'])(
    '%s 인증·권한을 실제 JWT로 검증한다',
    async (operation) => {
      const event = await createEvent();
      const send = (token?: string) => {
        const req =
          operation === 'create'
            ? http().post(basePath).send(validInput())
            : http()
                .patch(`${basePath}/${event.id}/activation`)
                .send({ isActive: true });
        return token ? req.set('Authorization', token) : req;
      };
      await send().expect(401);
      await send('Bearer invalid').expect(401);
      await send(authHeader(userId, 'USER')).expect(403);
      await send(
        `Bearer ${jwt.sign({ sub: adminId, role: 'ADMIN', type: 'refresh' })}`,
      ).expect(401);
      await send(
        `Bearer ${jwt.sign({ sub: adminId, role: 'ADMIN', type: 'access' }, { expiresIn: -1 })}`,
      ).expect(401);
      // 토큰은 ADMIN이어도 DB의 현재 권한이 USER면 거부한다.
      await users.update(adminId, { role: 'USER' });
      await send(authHeader(adminId)).expect(403);
      await users.delete(adminId);
      await send(authHeader(adminId)).expect(401);
      expect(await events.count()).toBe(1);
      expect((await events.findOneByOrFail({ id: event.id })).isActive).toBe(
        false,
      );
    },
  );

  it('활성·중지 및 동일 상태 재요청은 수량·기간을 변경하지 않는다', async () => {
    const event = await createEvent();
    const original = await events.findOneByOrFail({ id: event.id });
    for (const isActive of [true, true, false, false]) {
      const before = await events.findOneByOrFail({ id: event.id });
      const response = await http()
        .patch(`${basePath}/${event.id}/activation`)
        .set('Authorization', authHeader(adminId))
        .send({ isActive })
        .expect(200)
        .expect('Cache-Control', 'private, no-store');
      const body = response.body as CouponEventResponseDto;
      const saved = await events.findOneByOrFail({ id: event.id });
      expect(body.isActive).toBe(isActive);
      expect(body.updatedAt).toBe(saved.updatedAt.toISOString());
      expect(saved.issuedCount).toBe(0);
      expect(saved.totalQuantity).toBe(original.totalQuantity);
      expect(saved.startsAt).toEqual(original.startsAt);
      expect(saved.endsAt).toEqual(original.endsAt);
      expect(saved.couponExpiresAt).toEqual(original.couponExpiresAt);
      if (before.isActive === isActive)
        expect(saved.updatedAt).toEqual(before.updatedAt);
    }
  });

  it.each([
    {},
    { isActive: 'false' },
    { isActive: null },
    { isActive: 1 },
    { isActive: true, totalQuantity: 99 },
  ])('잘못된 활성 요청 %j는 400이다', async (body) => {
    const event = await createEvent();
    await http()
      .patch(`${basePath}/${event.id}/activation`)
      .set('Authorization', authHeader(adminId))
      .send(body)
      .expect(400);
    expect((await events.findOneByOrFail({ id: event.id })).isActive).toBe(
      false,
    );
  });

  it.each(['0', '-1', '1.5', 'abc', '2147483648', '9007199254740993'])(
    '범위를 벗어난 이벤트 ID %s는 400이다',
    async (id) => {
      await http()
        .patch(`${basePath}/${id}/activation`)
        .set('Authorization', authHeader(adminId))
        .send({ isActive: true })
        .expect(400);
    },
  );

  it('존재하지 않는 유효 범위 ID는 404이다', async () => {
    await http()
      .patch(`${basePath}/2147483647/activation`)
      .set('Authorization', authHeader(adminId))
      .send({ isActive: true })
      .expect(404);
  });

  it('생성 저장 이후 오류가 나면 INSERT도 롤백된다', async () => {
    jest
      .spyOn(repository, 'getDatabaseNow')
      .mockRejectedValueOnce(new Error('테스트 장애'));
    await http()
      .post(basePath)
      .set('Authorization', authHeader(adminId))
      .send(validInput())
      .expect(500);
    expect(await events.count()).toBe(0);
    await createEvent();
    expect(await events.count()).toBe(1);
  });

  it('활성 변경 이후 오류가 나면 상태·updatedAt도 롤백된다', async () => {
    const event = await createEvent();
    const before = await events.findOneByOrFail({ id: event.id });
    jest
      .spyOn(repository, 'getDatabaseNow')
      .mockRejectedValueOnce(new Error('테스트 장애'));
    await http()
      .patch(`${basePath}/${event.id}/activation`)
      .set('Authorization', authHeader(adminId))
      .send({ isActive: true })
      .expect(500);
    const after = await events.findOneByOrFail({ id: event.id });
    expect(after.isActive).toBe(false);
    expect(after.updatedAt).toEqual(before.updatedAt);
  });

  it('동시 활성·중지 12건에도 기존 발급량·쿠폰은 보존된다 (발급 API 테스트 아님)', async () => {
    const event = await createEvent();
    // 발급 API가 아직 없으므로 일관된 발급 이력을 테스트 준비 데이터로 넣는다.
    await source.transaction(async (manager) => {
      const now = await repository.getDatabaseNow(manager);
      await manager.insert(
        UserCoupon,
        [adminId, userId].map((id) => ({
          eventId: event.id,
          userId: id,
          issuedAt: now,
          expiresAt: new Date(event.couponExpiresAt),
        })),
      );
      await manager.update(CouponEvent, event.id, { issuedCount: 2 });
    });
    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, index) => {
        const isActive = index % 2 === 0;
        return http()
          .patch(`${basePath}/${event.id}/activation`)
          .set('Authorization', authHeader(adminId))
          .send({ isActive })
          .expect(200)
          .then((response) => {
            expect(response.body as CouponEventResponseDto).toMatchObject({
              isActive,
              issuedCount: 2,
            });
            return response;
          });
      }),
    );
    expect(responses).toHaveLength(12);
    expect((await events.findOneByOrFail({ id: event.id })).issuedCount).toBe(
      2,
    );
    expect(await coupons.countBy({ eventId: event.id })).toBe(2);
  });

  it('관리자 계정 잠금은 해당 계정의 권한 수정·삭제만 대기시킨다', async () => {
    await source.transaction(async (manager) => {
      await repository.findUserForShare(manager, adminId);
      expect(await users.findOneBy({ id: adminId })).not.toBeNull();
      await users.update(userId, { nickname: '다른 계정은 수정 가능' });
      for (const action of ['update', 'delete']) {
        await expect(
          source.transaction(async (other) => {
            await other.query("SET LOCAL lock_timeout = '150ms'");
            if (action === 'update')
              await other.update(User, adminId, { role: 'USER' });
            else await other.delete(User, adminId);
          }),
        ).rejects.toMatchObject({ driverError: { code: '55P03' } });
      }
    });
    await users.update(adminId, { role: 'USER' });
    expect((await users.findOneByOrFail({ id: adminId })).role).toBe('USER');
  });

  it('이벤트 잠금은 다른 트랜잭션의 상태 변경을 대기시키고 종료 후 해제된다', async () => {
    const event = await createEvent();
    await source.transaction(async (manager) => {
      await repository.findByIdForUpdate(manager, event.id);
      await expect(
        source.transaction(async (other) => {
          await other.query("SET LOCAL lock_timeout = '150ms'");
          await other.update(CouponEvent, event.id, { isActive: true });
        }),
      ).rejects.toMatchObject({ driverError: { code: '55P03' } });
    });
    await http()
      .patch(`${basePath}/${event.id}/activation`)
      .set('Authorization', authHeader(adminId))
      .send({ isActive: true })
      .expect(200);
  });

  it.each([{ issuedCount: -1 }, { issuedCount: 11 }, { totalQuantity: 0 }])(
    'DB 수량 CHECK가 잘못된 값 %j를 거부한다',
    async (values) => {
      const event = await createEvent();
      await expect(events.update(event.id, values)).rejects.toMatchObject({
        driverError: { code: '23514' },
      });
      expect((await events.findOneByOrFail({ id: event.id })).issuedCount).toBe(
        0,
      );
    },
  );

  it('DB 중복·기간·외래키 제약과 계정 삭제 시 발급 이력 보존을 확인한다', async () => {
    const event = await createEvent();
    const values = {
      eventId: event.id,
      userId,
      issuedAt: new Date(),
      expiresAt: new Date(event.couponExpiresAt),
    };
    await source.transaction(async (manager) => {
      await manager.insert(UserCoupon, values);
      await manager.update(CouponEvent, event.id, { issuedCount: 1 });
    });
    await expect(coupons.insert(values)).rejects.toMatchObject({
      driverError: { code: '23505' },
    });
    await expect(events.delete(event.id)).rejects.toMatchObject({
      driverError: { code: '23503' },
    });
    await expect(
      events.update(event.id, { endsAt: new Date(event.startsAt) }),
    ).rejects.toMatchObject({ driverError: { code: '23514' } });
    await expect(
      coupons.update({ eventId: event.id }, { expiresAt: values.issuedAt }),
    ).rejects.toMatchObject({ driverError: { code: '23514' } });
    await users.delete(userId);
    expect(
      (await coupons.findOneByOrFail({ eventId: event.id })).userId,
    ).toBeNull();
    expect((await events.findOneByOrFail({ id: event.id })).issuedCount).toBe(
      1,
    );
    expect(await coupons.countBy({ eventId: event.id })).toBe(1);
  });
});
