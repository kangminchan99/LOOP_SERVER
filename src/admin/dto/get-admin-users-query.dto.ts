import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetAdminUsersQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: '페이지 번호',
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: '페이지당 유저 수',
    default: 20,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 20;

  @ApiPropertyOptional({
    example: 'admin',
    description: '이메일 또는 닉네임 검색어',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
