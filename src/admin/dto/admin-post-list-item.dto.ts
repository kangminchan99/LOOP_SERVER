import { ApiProperty } from '@nestjs/swagger';

export class AdminPostListItemDto {
  @ApiProperty({
    example: 1,
    description: '게시글 ID',
  })
  id!: number;

  @ApiProperty({
    example: '첫 번째 게시글',
    description: '게시글 제목',
  })
  title!: string;

  @ApiProperty({
    example: '게시글 내용 일부입니다...',
    description: '관리자 목록에서 보여줄 게시글 내용 미리보기',
  })
  contentPreview!: string;

  @ApiProperty({
    example: 10,
    description: '작성자 유저 ID',
  })
  authorId!: number;

  @ApiProperty({
    example: 'minchan',
    description: '작성자 닉네임',
    nullable: true,
  })
  authorNickname!: string | null;

  @ApiProperty({
    example: 'COMPLETED',
    description: 'AI 요약 상태',
  })
  summaryStatus!: 'PENDING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

  @ApiProperty({
    example: '2026-08-27T12:00:00.000Z',
    description: '게시글 생성 시각',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-08-27T12:10:00.000Z',
    description: '게시글 수정 시각',
  })
  updatedAt!: Date;
}
