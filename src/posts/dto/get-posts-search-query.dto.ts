import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GetPostsSearchQueryDto {
  @ApiProperty({
    example: '대용량',
    description: '검색어',
  })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  keyword!: string;

  @ApiPropertyOptional({
    example: 20,
    description: '페이지 크기 (기본 20, 최대 50)',
    type: Number,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return 20;
    }

    return Number(value);
  })
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  @ApiPropertyOptional({
    example: '2026-07-10T12:00:00.000Z_120',
    description: '다음 페이지 커서(createdAt_postId)',
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return String(value);
  })
  @IsString()
  cursor?: string;
}
