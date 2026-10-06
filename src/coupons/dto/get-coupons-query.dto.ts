import { BadRequestException } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import type { CouponCursor } from '../types/coupon-cursor';

export class GetCouponsQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @ApiPropertyOptional({ example: '2026-10-06T00:00:00.000Z_10' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(40)
  cursor?: string;
}

// Date.parse의 날짜 자동 보정까지 거부한다.
export function parseCouponCursor(value?: string): CouponCursor | undefined {
  if (value === undefined) return undefined;
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)_([1-9]\d{0,9})$/.exec(
      value,
    );
  if (match) {
    const date = new Date(match[1]);
    const id = Number(match[2]);
    if (
      !Number.isNaN(date.getTime()) &&
      date.toISOString() === match[1] &&
      id <= 2147483647
    ) {
      return { date, id };
    }
  }
  throw new BadRequestException('잘못된 쿠폰 커서입니다.');
}
