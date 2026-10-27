import { ApiProperty } from '@nestjs/swagger';
import type { UserBlock } from '../entities/user-block.entity';

export class UserBlockListItemDto {
  @ApiProperty({ description: '차단 관계 ID', example: 1 })
  blockId!: number;

  @ApiProperty({ description: '차단 대상 사용자 ID', example: 10 })
  userId!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '차단 대상 닉네임',
  })
  nickname!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '차단 대상 프로필 이미지 URL',
  })
  profileImageUrl!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: '차단한 시각',
  })
  blockedAt!: string;

  // blockedUser 관계까지 조회한 엔티티를 전달한다.
  static fromEntity(block: UserBlock): UserBlockListItemDto {
    return {
      blockId: block.id,
      userId: block.blockedUserId,
      nickname: block.blockedUser.nickname ?? null,
      profileImageUrl: block.blockedUser.profileImageUrl ?? null,
      blockedAt: block.createdAt.toISOString(),
    };
  }
}
