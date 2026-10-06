import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CouponEvent } from '../entities/coupon-event.entity';
import type { CouponCursor } from '../types/coupon-cursor';

// 이벤트 생성 시 저장할 값만 지정한다.
// 날짜는 Service에서 검증하고 Date로 변환해서 전달한다.
export type CreateCouponEventInput = Pick<
  CouponEvent,
  'title' | 'totalQuantity' | 'startsAt' | 'endsAt' | 'couponExpiresAt'
>;

@Injectable()
export class CouponEventsRepository {
  findById(manager: EntityManager, id: number): Promise<CouponEvent | null> {
    return manager.findOneBy(CouponEvent, { id });
  }

  findPage(
    manager: EntityManager,
    limit: number,
    cursor?: CouponCursor,
  ): Promise<CouponEvent[]> {
    const query = manager
      .createQueryBuilder(CouponEvent, 'event')
      .orderBy('event.createdAt', 'DESC')
      .addOrderBy('event.id', 'DESC')
      .take(limit + 1);
    if (cursor)
      query.where('(event.createdAt, event.id) < (:date, :id)', cursor);
    return query.getMany();
  }

  // 계정 삭제만 대기시킨다. 다른 사용자의 계정이나 일반 프로필 수정은 막지 않는다.
  findUserForKeyShare(
    manager: EntityManager,
    id: number,
  ): Promise<User | null> {
    return manager.findOne(User, {
      where: { id },
      select: { id: true },
      lock: { mode: 'for_key_share' },
    });
  }

  async incrementIssuedCount(
    manager: EntityManager,
    id: number,
  ): Promise<boolean> {
    const result = await manager
      .createQueryBuilder()
      .update(CouponEvent)
      .set({ issuedCount: () => '"issuedCount" + 1' })
      .where('id = :id AND "issuedCount" < "totalQuantity"', { id })
      .execute();
    return result.affected === 1;
  }

  async create(
    manager: EntityManager,
    input: CreateCouponEventInput,
  ): Promise<CouponEvent> {
    // 1. 저장할 엔티티 객체 생성. 아직 SQL은 실행되지 않는다.
    const event = manager.create(CouponEvent, {
      title: input.title,
      totalQuantity: input.totalQuantity,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      couponExpiresAt: input.couponExpiresAt,

      // 발급량과 활성 여부는 서버가 결정한다.
      issuedCount: 0,
      isActive: false,
    });

    // 2. 전달받은 manager로 DB에 저장한다.
    return manager.save(CouponEvent, event);
  }

  // 트랜잭션 안에서 호출: 이벤트 조회와 함께 해당 행을 잠근다.
  async findByIdForUpdate(
    manager: EntityManager,
    eventId: number,
  ): Promise<CouponEvent | null> {
    return manager.findOne(CouponEvent, {
      where: {
        id: eventId,
      },
      lock: {
        mode: 'pessimistic_write',
      },
    });
  }

  // DB의 현재 시각을 밀리초 단위로 조회한다.
  async getDatabaseNow(manager: EntityManager): Promise<Date> {
    const rows = await manager.query<{ now: unknown }[]>(
      `SELECT date_trunc('milliseconds', clock_timestamp()) AS "now"`,
    );

    const now = rows[0]?.now;

    // 잘못된 시각으로 발급 여부를 판단하지 않도록 검증한다.
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
      throw new Error('DB 현재 시각을 조회하지 못했습니다.');
    }

    return now;
  }

  // 같은 트랜잭션에서 이벤트를 잠근 뒤 활성 여부만 변경한다.
  async updateActivation(
    manager: EntityManager,
    eventId: number,
    isActive: boolean,
  ): Promise<boolean> {
    const result = await manager.update(
      CouponEvent,
      { id: eventId },
      { isActive },
    );

    // 해당 이벤트 행이 업데이트되었는지 반환한다.
    return result.affected === 1;
  }

  // 관리자 작업 중 계정 삭제·권한 변경을 막기 위해 잠근다.
  async findUserForShare(
    manager: EntityManager,
    userId: number,
  ): Promise<Pick<User, 'id' | 'role'> | null> {
    return manager.findOne(User, {
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
      },
      lock: {
        mode: 'pessimistic_read',
      },
    });
  }
}
