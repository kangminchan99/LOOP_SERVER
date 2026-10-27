import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UserBlockTargetParamDto {
  @ApiProperty({
    type: Number,
    example: 10,
    minimum: 1,
    maximum: 2147483647,
    description: '차단 또는 해제할 대상 사용자 ID',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^[1-9]\d*$/.test(value)
      ? Number(value)
      : value,
  )
  @IsInt()
  @Min(1)
  @Max(2147483647)
  targetUserId!: number;
}
