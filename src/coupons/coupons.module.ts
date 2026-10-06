import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { CouponEvent } from './entities/coupon-event.entity';
import { UserCoupon } from './entities/user-coupon.entity';
import { CouponEventsRepository } from './repositories/coupon-events.repository';
import { CouponEventsService } from './services/coupon-events.service';
import { CouponEventsController } from './controllers/coupon-events.controller';
import { UserCouponsController } from './controllers/user-coupons.controller';
import { UserCouponsRepository } from './repositories/user-coupons.repository';
import { CouponTransactionsService } from './services/coupon-transactions.service';
import { UserCouponsService } from './services/user-coupons.service';

@Module({
  // 이 모듈에서 사용할 TypeORM 기본 Repository 등록
  imports: [TypeOrmModule.forFeature([CouponEvent, UserCoupon, User])],

  // NestJS가 생성하고 주입할 클래스 등록
  controllers: [CouponEventsController, UserCouponsController],
  providers: [
    CouponEventsRepository,
    CouponEventsService,
    UserCouponsRepository,
    CouponTransactionsService,
    UserCouponsService,
  ],

  // 다른 모듈에서 이벤트 관리 Service를 사용할 수 있도록 공개
  exports: [CouponEventsService],
})
export class CouponsModule {}
