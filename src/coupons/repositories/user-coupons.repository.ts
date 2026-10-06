import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { UserCoupon } from '../entities/user-coupon.entity';
import type { CouponCursor } from '../types/coupon-cursor';

// Service에서 결정한 발급 정보만 전달받는다.
export type CreateUserCouponInput = {
  eventId: number;
  userId: number;
  issuedAt: Date;
  expiresAt: Date;
};

@Injectable()
export class UserCouponsRepository {
  create(
    manager: EntityManager,
    input: CreateUserCouponInput,
  ): Promise<UserCoupon> {
    return manager.save(UserCoupon, manager.create(UserCoupon, input));
  }

  findPage(
    manager: EntityManager,
    userId: number,
    limit: number,
    cursor?: CouponCursor,
  ): Promise<UserCoupon[]> {
    const query = manager
      .createQueryBuilder(UserCoupon, 'coupon')
      .innerJoinAndSelect('coupon.event', 'event')
      .where('coupon.userId = :userId', { userId })
      .orderBy('coupon.issuedAt', 'DESC')
      .addOrderBy('coupon.id', 'DESC')
      .take(limit + 1);
    if (cursor)
      query.andWhere('(coupon.issuedAt, coupon.id) < (:date, :id)', cursor);
    return query.getMany();
  }

  // 특정 이벤트에서 해당 사용자가 발급받은 쿠폰을 조회한다.
  async findByEventAndUser(
    manager: EntityManager,
    eventId: number,
    userId: number,
  ): Promise<UserCoupon | null> {
    return manager.findOne(UserCoupon, {
      where: {
        eventId,
        userId,
      },
    });
  }
}
