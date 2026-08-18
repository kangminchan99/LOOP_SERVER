import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetChatMessagesQueryDto {
  @ApiPropertyOptional({
    example: 30,
    description: '가져올 메시지 개수',
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 30;

  @ApiPropertyOptional({
    example: 100,
    description: '이 ID보다 오래된 메시지를 조회한다. 첫 요청에서는 생략한다.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cursorId?: number;
}
