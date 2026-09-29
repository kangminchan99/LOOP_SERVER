import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// 시간대 필수, 소수점 이하 초는 최대 밀리초 3자리까지 허용
const DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export class CreateCouponEventDto {
  @ApiProperty({
    example: '오픈 기념 쿠폰 이벤트',
    description: '이벤트 이름',
    maxLength: 100,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @ApiProperty({
    example: 100,
    description: '전체 발급 가능 수량',
    minimum: 1,
    maximum: 100000,
  })
  @IsInt()
  @Min(1)
  @Max(100000)
  totalQuantity!: number;

  @ApiProperty({
    example: '2026-10-01T00:00:00.000Z',
    description: '쿠폰 발급 시작 시각',
    type: String,
    format: 'date-time',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(DATE_TIME_PATTERN, {
    message: 'startsAt은 시간대를 포함한 날짜여야 합니다.',
  })
  startsAt!: string;

  @ApiProperty({
    example: '2026-10-02T00:00:00.000Z',
    description: '쿠폰 발급 종료 시각',
    type: String,
    format: 'date-time',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(DATE_TIME_PATTERN, {
    message: 'endsAt은 시간대를 포함한 날짜여야 합니다.',
  })
  endsAt!: string;

  @ApiProperty({
    example: '2026-10-09T00:00:00.000Z',
    description: '발급받은 쿠폰의 만료 시각',
    type: String,
    format: 'date-time',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(DATE_TIME_PATTERN, {
    message: 'couponExpiresAt은 시간대를 포함한 날짜여야 합니다.',
  })
  couponExpiresAt!: string;
}
