import { ApiProperty } from '@nestjs/swagger';

export class AdminCommentListItemDto {
  @ApiProperty({
    example: 1,
    description: '댓글 ID',
  })
  id!: number;

  @ApiProperty({
    example: 10,
    description: '게시글 ID',
  })
  postId!: number;

  @ApiProperty({
    example: '오늘의 기록',
    description: '게시글 제목',
    nullable: true,
  })
  postTitle!: string | null;

  @ApiProperty({
    example: 3,
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
    example: '좋은 글이네요!',
    description: '댓글 내용',
  })
  content!: string;

  @ApiProperty({
    example: '2026-08-31T12:00:00.000Z',
    description: '댓글 생성 시각',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-08-31T12:10:00.000Z',
    description: '댓글 수정 시각',
  })
  updatedAt!: Date;
}
