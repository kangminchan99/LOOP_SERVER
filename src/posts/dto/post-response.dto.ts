import { ApiProperty } from '@nestjs/swagger';
import { Post } from '../entities/post.entity';

export class PostResponseDto {
  @ApiProperty({ example: 1, description: '게시글 ID' })
  id!: number;

  @ApiProperty({ example: '첫 게시글 제목', description: '게시글 제목' })
  title!: string;

  @ApiProperty({ example: '게시글 본문입니다.', description: '게시글 내용' })
  content!: string;

  @ApiProperty({
    example: '게시글 내용을 2문장으로 요약한 문장입니다.',
    description: 'AI 요약문',
    nullable: true,
  })
  summary!: string | null;

  @ApiProperty({
    example: 'COMPLETED',
    description: 'AI 요약 상태',
  })
  summaryStatus!: 'PENDING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

  @ApiProperty({
    example: 'OPENAI_TIMEOUT',
    description: 'AI 요약 실패 사유',
    nullable: true,
  })
  summaryError!: string | null;

  @ApiProperty({
    example: '2026-07-29T12:00:00.000Z',
    description: 'AI 요약 생성 시각',
    nullable: true,
  })
  summaryGeneratedAt!: Date | null;

  @ApiProperty({ example: 1, description: '작성자 유저 ID' })
  authorId!: number;

  @ApiProperty({
    example: '2026-05-19T12:00:00.000Z',
    description: '생성 시각',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-05-19T12:10:00.000Z',
    description: '수정 시각',
  })
  updatedAt!: Date;

  static fromEntity(post: Post): PostResponseDto {
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      summary: post.summary,
      summaryStatus: post.summaryStatus,
      summaryError: post.summaryError,
      summaryGeneratedAt: post.summaryGeneratedAt,
      authorId: post.authorId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
