import { ApiProperty } from '@nestjs/swagger';
import type { UserCoupon } from '../entities/user-coupon.entity';

export class UserCouponResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() eventId!: number;
  @ApiProperty() eventTitle!: string;
  @ApiProperty({ format: 'date-time' }) issuedAt!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ enum: ['ISSUED', 'EXPIRED'] }) status!: 'ISSUED' | 'EXPIRED';
  @ApiProperty({ format: 'date-time' }) serverTime!: string;

  static fromEntity(
    coupon: UserCoupon,
    eventTitle: string,
    now: Date,
  ): UserCouponResponseDto {
    return {
      id: coupon.id,
      eventId: coupon.eventId,
      eventTitle,
      issuedAt: coupon.issuedAt.toISOString(),
      expiresAt: coupon.expiresAt.toISOString(),
      status: now >= coupon.expiresAt ? 'EXPIRED' : 'ISSUED',
      serverTime: now.toISOString(),
    };
  }
}
