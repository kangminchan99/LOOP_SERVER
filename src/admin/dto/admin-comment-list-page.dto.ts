import { ApiProperty } from '@nestjs/swagger';
import { AdminCommentListItemDto } from './admin-comment-list-item.dto';

export class AdminCommentListPageDto {
  @ApiProperty({
    description: '현재 페이지 댓글 목록',
    type: AdminCommentListItemDto,
    isArray: true,
  })
  items!: AdminCommentListItemDto[];

  @ApiProperty({
    example: 120,
    description: '검색 조건에 맞는 전체 댓글 수',
  })
  total!: number;

  @ApiProperty({
    example: 1,
    description: '현재 페이지',
  })
  page!: number;

  @ApiProperty({
    example: 20,
    description: '페이지당 댓글 수',
  })
  limit!: number;

  @ApiProperty({
    example: 6,
    description: '전체 페이지 수',
  })
  totalPages!: number;
}
