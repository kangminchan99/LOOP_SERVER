import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class AdminUserListPageDto {
  @ApiProperty({
    description: '현재 페이지 유저 목록',
    type: UserResponseDto,
    isArray: true,
  })
  items!: UserResponseDto[];

  @ApiProperty({
    example: 2108,
    description: '검색 조건에 맞는 전체 유저 수',
  })
  total!: number;

  @ApiProperty({
    example: 1,
    description: '현재 페이지',
  })
  page!: number;

  @ApiProperty({
    example: 20,
    description: '페이지당 유저 수',
  })
  limit!: number;

  @ApiProperty({
    example: 106,
    description: '전체 페이지 수',
  })
  totalPages!: number;
}
