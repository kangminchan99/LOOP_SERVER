import { ApiProperty } from '@nestjs/swagger';
import { CouponEventResponseDto } from './coupon-event-response.dto';
import { UserCouponResponseDto } from './user-coupon-response.dto';

class CouponPageDto {
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
  @ApiProperty() hasNext!: boolean;
  @ApiProperty({ format: 'date-time' }) serverTime!: string;
}

export class CouponEventListPageDto extends CouponPageDto {
  @ApiProperty({ type: [CouponEventResponseDto] })
  items!: CouponEventResponseDto[];
}

export class UserCouponListPageDto extends CouponPageDto {
  @ApiProperty({ type: [UserCouponResponseDto] })
  items!: UserCouponResponseDto[];
}
