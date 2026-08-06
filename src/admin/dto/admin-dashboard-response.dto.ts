import { ApiProperty } from '@nestjs/swagger';

export class AdminDashboardResponseDto {
  @ApiProperty({ example: 1248, description: '전체 유저 수' })
  totalUsers!: number;

  @ApiProperty({ example: 8420, description: '전체 게시글 수' })
  totalPosts!: number;

  @ApiProperty({ example: 24918, description: '전체 댓글 수' })
  totalComments!: number;

  @ApiProperty({ example: 532, description: '전체 알림 수' })
  totalNotifications!: number;

  @ApiProperty({ example: 120, description: '읽지 않은 알림 수' })
  unreadNotifications!: number;

  @ApiProperty({ example: 12, description: '오늘 가입한 유저 수' })
  todayUsers!: number;

  @ApiProperty({ example: 38, description: '오늘 작성된 게시글 수' })
  todayPosts!: number;

  @ApiProperty({ example: 116, description: '오늘 작성된 댓글 수' })
  todayComments!: number;

  @ApiProperty({
    example: '2026-08-06T04:10:00.000Z',
    description: '대시보드 데이터 생성 시각',
  })
  generatedAt!: string;
}
