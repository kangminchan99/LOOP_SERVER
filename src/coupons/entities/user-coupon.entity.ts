import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CouponEvent } from './coupon-event.entity';

@Entity('user_coupons')
// 같은 계정은 같은 이벤트에서 한 장만 발급받는다.
@Unique('UQ_user_coupons_event_user', ['eventId', 'userId'])
// 내 쿠폰을 발급 시각과 ID 기준으로 조회한다.
@Index('IDX_user_coupons_user_issued_id', ['userId', 'issuedAt', 'id'])
// 만료 시각은 발급 시각보다 뒤여야 한다.
@Check('CHK_user_coupons_expiration', '"expiresAt" > "issuedAt"')
export class UserCoupon {
  @PrimaryGeneratedColumn()
  id!: number;

  // 쿠폰이 발급된 이벤트
  @Column({ type: 'integer' })
  eventId!: number;

  // 쿠폰 소유자. 계정 삭제 시 NULL로 바뀐다.
  @Column({ type: 'integer', nullable: true })
  userId!: number | null;

  // 발급 처리 시 서버가 DB 기준 시각을 넣는다.
  @Column({ type: 'timestamptz', precision: 3 })
  issuedAt!: Date;

  // 이벤트의 쿠폰 만료 시각을 발급 시 복사한다.
  @Column({ type: 'timestamptz', precision: 3 })
  expiresAt!: Date;

  // 발급 이력이 있는 이벤트는 삭제하지 못하게 한다.
  @ManyToOne(() => CouponEvent, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'eventId' })
  event!: CouponEvent;

  // 사용자가 삭제돼도 발급 이력 자체는 보존한다.
  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'userId' })
  user!: User | null;
}
