import { ApiProperty } from '@nestjs/swagger';
import { CommentResponseDto } from './comment-response.dto';

export class CommentListPageDto {
  @ApiProperty({
    type: CommentResponseDto,
    isArray: true,
    description: '현재 페이지 댓글 목록',
  })
  items!: CommentResponseDto[];

  @ApiProperty({
    example: '2026-07-20T13:30:00.000Z_15',
    type: String,
    nullable: true,
    description: '다음 페이지 조회용 커서(createdAt_commentId)',
  })
  nextCursor!: string | null;

  @ApiProperty({
    example: true,
    description: '다음 페이지 존재 여부',
  })
  hasNext!: boolean;
}
