import { ApiProperty } from '@nestjs/swagger';
import type { CouponEvent } from '../entities/coupon-event.entity';

export class CouponEventResponseDto {
  @ApiProperty({ example: 1, description: '이벤트 ID' })
  id!: number;

  @ApiProperty({
    example: '오픈 기념 쿠폰 이벤트',
    description: '이벤트 이름',
  })
  title!: string;

  @ApiProperty({ example: 100, description: '전체 발급 수량' })
  totalQuantity!: number;

  @ApiProperty({ example: 30, description: '발급 완료 수량' })
  issuedCount!: number;

  @ApiProperty({
    example: 70,
    description: '조회한 이벤트 정보 기준 잔여 수량',
  })
  remainingQuantity!: number;

  @ApiProperty({
    example: false,
    description: '신규 발급 활성 여부',
  })
  isActive!: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: '발급 시작 시각',
  })
  startsAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: '발급 종료 시각',
  })
  endsAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: '쿠폰 만료 시각',
  })
  couponExpiresAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: '이벤트 생성 시각',
  })
  createdAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: '이벤트 수정 시각',
  })
  updatedAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: '서버에서 확인한 DB 기준 시각',
  })
  serverTime!: string;

  // DB 엔티티에서 외부에 공개할 값만 골라 응답 형식으로 변환한다.
  static fromEntity(
    event: CouponEvent,
    serverTime: Date,
  ): CouponEventResponseDto {
    return {
      id: event.id,
      title: event.title,
      totalQuantity: event.totalQuantity,
      issuedCount: event.issuedCount,
      remainingQuantity: event.totalQuantity - event.issuedCount,
      isActive: event.isActive,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      couponExpiresAt: event.couponExpiresAt.toISOString(),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      serverTime: serverTime.toISOString(),
    };
  }
}
