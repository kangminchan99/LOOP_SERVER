import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CouponEventResponseDto } from '../dto/coupon-event-response.dto';
import {
  CouponEventListPageDto,
  UserCouponListPageDto,
} from '../dto/coupon-list-page.dto';
import {
  GetCouponsQueryDto,
  parseCouponCursor,
} from '../dto/get-coupons-query.dto';
import { UserCouponResponseDto } from '../dto/user-coupon-response.dto';
import { CouponEventsRepository } from '../repositories/coupon-events.repository';
import { UserCouponsRepository } from '../repositories/user-coupons.repository';
import {
  CouponTransactionsService,
  postgresError,
} from './coupon-transactions.service';

@Injectable()
export class UserCouponsService {
  constructor(
    private readonly transactions: CouponTransactionsService,
    private readonly events: CouponEventsRepository,
    private readonly coupons: UserCouponsRepository,
  ) {}

  async issue(
    userId: number,
    eventId: number,
  ): Promise<{ created: boolean; coupon: UserCouponResponseDto }> {
    try {
      return await this.transactions.run(userId, async (manager) => {
        // 1. 계정 → 이벤트 순서로 잠근 후 중복 발급을 먼저 확인한다.
        const event = await this.events.findByIdForUpdate(manager, eventId);
        if (!event)
          throw new NotFoundException({
            code: 'EVENT_NOT_FOUND',
            message: '이벤트를 찾을 수 없습니다.',
          });
        const existing = await this.coupons.findByEventAndUser(
          manager,
          eventId,
          userId,
        );
        // 잠금 대기 전 시각이 아닌 DB의 실제 현재 시각으로 판단한다.
        const now = await this.events.getDatabaseNow(manager);
        if (existing)
          return {
            created: false,
            coupon: UserCouponResponseDto.fromEntity(
              existing,
              event.title,
              now,
            ),
          };

        // 2. 신규 발급에만 운영 상태·기간·재고 조건을 적용한다.
        if (!event.isActive)
          throw new ConflictException({
            code: 'EVENT_DISABLED',
            message: '중지된 이벤트입니다.',
          });
        if (now < event.startsAt)
          throw new ConflictException({
            code: 'EVENT_NOT_STARTED',
            message: '아직 시작하지 않았습니다.',
          });
        if (now >= event.endsAt)
          throw new ConflictException({
            code: 'EVENT_ENDED',
            message: '종료된 이벤트입니다.',
          });
        if (event.issuedCount >= event.totalQuantity)
          throw new ConflictException({
            code: 'COUPON_SOLD_OUT',
            message: '쿠폰이 모두 발급되었습니다.',
          });

        // 3. 쿠폰 저장과 수량 증가를 함께 커밋한다. 하나라도 실패하면 모두 롤백한다.
        const coupon = await this.coupons.create(manager, {
          eventId,
          userId,
          issuedAt: now,
          expiresAt: event.couponExpiresAt,
        });
        if (!(await this.events.incrementIssuedCount(manager, eventId)))
          throw new InternalServerErrorException();
        return {
          created: true,
          coupon: UserCouponResponseDto.fromEntity(coupon, event.title, now),
        };
      });
    } catch (error: unknown) {
      const { code, constraint } = postgresError(error);
      // 유일 제약 충돌 시 실패한 트랜잭션 밖에서 본인 발급 결과만 다시 확인한다.
      if (code === '23505' && constraint === 'UQ_user_coupons_event_user') {
        return { created: false, coupon: await this.findMine(userId, eventId) };
      }
      throw error;
    }
  }

  findMine(userId: number, eventId: number): Promise<UserCouponResponseDto> {
    return this.transactions.run(userId, async (manager) => {
      const event = await this.events.findById(manager, eventId);
      if (!event)
        throw new NotFoundException({
          code: 'EVENT_NOT_FOUND',
          message: '이벤트를 찾을 수 없습니다.',
        });
      const coupon = await this.coupons.findByEventAndUser(
        manager,
        eventId,
        userId,
      );
      if (!coupon)
        throw new NotFoundException({
          code: 'MY_COUPON_NOT_FOUND',
          message: '발급받은 쿠폰이 없습니다.',
        });
      return UserCouponResponseDto.fromEntity(
        coupon,
        event.title,
        await this.events.getDatabaseNow(manager),
      );
    });
  }

  findEvent(userId: number, eventId: number): Promise<CouponEventResponseDto> {
    return this.transactions.run(userId, async (manager) => {
      const event = await this.events.findById(manager, eventId);
      if (!event)
        throw new NotFoundException({
          code: 'EVENT_NOT_FOUND',
          message: '이벤트를 찾을 수 없습니다.',
        });
      return CouponEventResponseDto.fromEntity(
        event,
        await this.events.getDatabaseNow(manager),
      );
    });
  }

  listEvents(
    userId: number,
    query: GetCouponsQueryDto,
  ): Promise<CouponEventListPageDto> {
    const cursor = parseCouponCursor(query.cursor);
    return this.transactions.run(userId, async (manager) => {
      const rows = await this.events.findPage(manager, query.limit, cursor);
      const now = await this.events.getDatabaseNow(manager);
      const hasNext = rows.length > query.limit;
      const items = rows.slice(0, query.limit);
      const last = items.at(-1);
      return {
        items: items.map((event) =>
          CouponEventResponseDto.fromEntity(event, now),
        ),
        hasNext,
        nextCursor:
          hasNext && last ? `${last.createdAt.toISOString()}_${last.id}` : null,
        serverTime: now.toISOString(),
      };
    });
  }

  listMine(
    userId: number,
    query: GetCouponsQueryDto,
  ): Promise<UserCouponListPageDto> {
    const cursor = parseCouponCursor(query.cursor);
    return this.transactions.run(userId, async (manager) => {
      const rows = await this.coupons.findPage(
        manager,
        userId,
        query.limit,
        cursor,
      );
      const now = await this.events.getDatabaseNow(manager);
      const hasNext = rows.length > query.limit;
      const items = rows.slice(0, query.limit);
      const last = items.at(-1);
      return {
        items: items.map((coupon) =>
          UserCouponResponseDto.fromEntity(coupon, coupon.event.title, now),
        ),
        hasNext,
        nextCursor:
          hasNext && last ? `${last.issuedAt.toISOString()}_${last.id}` : null,
        serverTime: now.toISOString(),
      };
    });
  }
}
