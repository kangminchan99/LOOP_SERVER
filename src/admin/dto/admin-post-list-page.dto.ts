import { ApiProperty } from '@nestjs/swagger';
import { AdminPostListItemDto } from './admin-post-list-item.dto';

export class AdminPostListPageDto {
  @ApiProperty({
    description: '현재 페이지 게시글 목록',
    type: AdminPostListItemDto,
    isArray: true,
  })
  items!: AdminPostListItemDto[];

  @ApiProperty({
    example: 120,
    description: '검색 조건에 맞는 전체 게시글 수',
  })
  total!: number;

  @ApiProperty({
    example: 1,
    description: '현재 페이지',
  })
  page!: number;

  @ApiProperty({
    example: 20,
    description: '페이지당 게시글 수',
  })
  limit!: number;

  @ApiProperty({
    example: 6,
    description: '전체 페이지 수',
  })
  totalPages!: number;
}
