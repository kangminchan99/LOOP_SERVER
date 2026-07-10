import { ApiProperty } from '@nestjs/swagger';
import { PostListItemDto } from './post-list-item-dto';

export class PostListPageDto {
  @ApiProperty({
    type: PostListItemDto,
    isArray: true,
    description: '현재 페이지 게시글 목록',
  })
  items!: PostListItemDto[];

  @ApiProperty({
    example: '2026-07-10T12:00:00.000Z_95',
    type: String,
    nullable: true,
    description: '다음 페이지 조회용 커서(createdAt_postId)',
  })
  nextCursor!: string | null;

  @ApiProperty({
    example: true,
    description: '다음 페이지 존재 여부',
  })
  hasNext!: boolean;
}
