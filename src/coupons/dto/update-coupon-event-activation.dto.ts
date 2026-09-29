import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateCouponEventActivationDto {
  @ApiProperty({
    example: true,
    description: '신규 쿠폰 발급 활성 여부',
    type: Boolean,
  })
  @IsBoolean({
    message: 'isActive는 true 또는 false여야 합니다.',
  })
  isActive!: boolean;
}
