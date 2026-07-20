import { ApiProperty } from '@nestjs/swagger';
import { Comment } from '../entities/comment.entity';

export class CommentResponseDto {
  @ApiProperty({ example: 1, description: '댓글 ID' })
  id!: number;

  @ApiProperty({ example: 10, description: '게시글 ID' })
  postId!: number;

  @ApiProperty({ example: 3, description: '작성자 ID' })
  authorId!: number;

  @ApiProperty({ example: 'minchan', description: '작성자 닉네임' })
  authorNickname!: string;

  @ApiProperty({ example: '좋은 글이네요!', description: '댓글 내용' })
  content!: string;

  @ApiProperty({
    example: '2026-07-20T13:30:00.000Z',
    description: '댓글 작성 시간',
  })
  createdAt!: Date;

  static fromEntity(comment: Comment): CommentResponseDto {
    return {
      id: comment.id,
      postId: comment.postId,
      authorId: comment.authorId,
      authorNickname: comment.author?.nickname ?? '알 수 없음',
      content: comment.content,
      createdAt: comment.createdAt,
    };
  }
}
