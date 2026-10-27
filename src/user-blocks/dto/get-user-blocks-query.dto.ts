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
import type { UserBlockCursor } from '../types/user-block-cursor';

export class GetUserBlocksQueryDto {
  // 한 번에 조회할 개수: 기본 20개, 최대 50개
  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 50,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  // 첫 조회에서는 생략하고, 다음 조회부터 서버가 준 커서를 전달한다.
  @ApiPropertyOptional({
    example: '2026-10-27T03:00:00.000Z_10',
    description: '다음 페이지 커서(createdAt_id)',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(40)
  cursor?: string;
}

export function parseUserBlockCursor(
  value?: string,
): UserBlockCursor | undefined {
  // 첫 페이지 요청에는 커서가 없다.
  if (value === undefined) return undefined;

  // 밀리초 단위 UTC 날짜와 양의 정수 ID만 허용한다.
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

  throw new BadRequestException('잘못된 차단 목록 커서입니다.');
}
