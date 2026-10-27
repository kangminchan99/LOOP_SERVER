import { ApiProperty } from '@nestjs/swagger';
import { UserBlockListItemDto } from './user-block-list-item.dto';

export class UserBlockListPageDto {
  @ApiProperty({
    type: [UserBlockListItemDto],
    description: '현재 페이지의 차단한 사용자 목록',
  })
  items!: UserBlockListItemDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    example: '2026-10-27T03:00:00.000Z_10',
    description: '다음 페이지 커서. 마지막 페이지면 null',
  })
  nextCursor!: string | null;

  @ApiProperty({
    example: true,
    description: '다음 페이지 존재 여부',
  })
  hasNext!: boolean;
}
