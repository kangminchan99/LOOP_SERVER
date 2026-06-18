import { ApiProperty } from '@nestjs/swagger';

export class AttendanceResponseDto {
  @ApiProperty({
    example: true,
    description: '오늘 출석 여부',
  })
  checkedToday!: boolean;

  @ApiProperty({
    example: '2026-06-18',
    nullable: true,
    description: '출석한 날짜',
  })
  checkedDate!: string | null;

  @ApiProperty({
    example: 3,
    description: '연속 출석 일수',
  })
  streakCount!: number;

  @ApiProperty({
    example: 10,
    description: '이번 출석 보상 포인트',
  })
  rewardPoint!: number;

  @ApiProperty({
    example: 120,
    description: '유저의 총 포인트',
  })
  totalPoint!: number;
}
