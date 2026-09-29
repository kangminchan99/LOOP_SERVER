import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('coupon_events')
@Index('IDX_coupon_events_created_at_id', ['createdAt', 'id'])
// 발급량이 잘못 저장되지 않도록 DB에서도 검사한다.
@Check('CHK_coupon_events_total_positive', '"totalQuantity" > 0')
@Check('CHK_coupon_events_issued_nonnegative', '"issuedCount" >= 0')
@Check(
  'CHK_coupon_events_issued_within_total',
  '"issuedCount" <= "totalQuantity"',
)
// 발급 기간과 쿠폰 만료일의 순서를 검사한다.
@Check('CHK_coupon_events_period', '"startsAt" < "endsAt"')
@Check('CHK_coupon_events_expiration', '"endsAt" < "couponExpiresAt"')
export class CouponEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  // 이벤트 이름
  @Column({ type: 'varchar', length: 100 })
  title!: string;

  // 발급 가능한 전체 수량
  @Column({ type: 'integer' })
  totalQuantity!: number;

  // 발급 완료된 누적 수량
  @Column({ type: 'integer', default: 0 })
  issuedCount!: number;

  // 신규 쿠폰 발급 시작 시각
  @Column({ type: 'timestamptz', precision: 3 })
  startsAt!: Date;

  // 신규 쿠폰 발급 종료 시각
  @Column({ type: 'timestamptz', precision: 3 })
  endsAt!: Date;

  // 발급받은 쿠폰 자체의 만료 시각
  @Column({ type: 'timestamptz', precision: 3 })
  couponExpiresAt!: Date;

  // 관리자가 활성화하기 전에는 발급하지 않는다.
  @Column({ type: 'boolean', default: false })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', precision: 3 })
  updatedAt!: Date;
}
