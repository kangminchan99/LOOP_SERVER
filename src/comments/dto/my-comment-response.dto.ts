import { ApiProperty } from '@nestjs/swagger';
import { Comment } from '../entities/comment.entity';

export class MyCommentResponseDto {
  @ApiProperty({ example: 1, description: '댓글 ID' })
  id!: number;

  @ApiProperty({ example: 10, description: '게시글 ID' })
  postId!: number;

  @ApiProperty({ example: '오늘의 기록', description: '게시글 제목' })
  postTitle!: string;

  @ApiProperty({ example: '좋은 글이네요!', description: '댓글 내용' })
  content!: string;

  @ApiProperty({
    example: '2026-07-23T10:20:00.000Z',
    description: '댓글 작성 시간',
  })
  createdAt!: Date;

  static fromEntity(comment: Comment): MyCommentResponseDto {
    return {
      id: comment.id,
      postId: comment.postId,
      postTitle: comment.post?.title ?? '삭제된 게시글',
      content: comment.content,
      createdAt: comment.createdAt,
    };
  }
}
