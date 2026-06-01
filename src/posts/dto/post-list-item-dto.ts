import { ApiProperty } from '@nestjs/swagger';

export class PostListItemDto {
  @ApiProperty({ example: 101, description: '포스트 ID' })
  postId!: number;

  @ApiProperty({ example: '오늘의 산책 기록', description: '포스트 제목' })
  title!: string;

  @ApiProperty({ example: 'minchan', description: '작성자 닉네임' })
  authorNickname!: string;

  @ApiProperty({
    example: '2026-06-01T10:30:00.000Z',
    description: '작성일시',
  })
  createdAt!: Date;
}
