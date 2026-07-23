import { ApiProperty } from '@nestjs/swagger';
import { MyCommentResponseDto } from './my-comment-response.dto';

export class MyCommentListPageDto {
  @ApiProperty({
    type: MyCommentResponseDto,
    isArray: true,
    description: '내가 작성한 댓글 목록',
  })
  items!: MyCommentResponseDto[];

  @ApiProperty({
    example: '2026-07-23T10:20:00.000Z_12',
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
