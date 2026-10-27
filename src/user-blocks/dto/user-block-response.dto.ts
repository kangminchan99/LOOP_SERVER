import { ApiProperty } from '@nestjs/swagger';
import type { UserBlock } from '../entities/user-block.entity';

export class UserBlockResponseDto {
  @ApiProperty({
    example: 10,
    description: '차단한 대상 사용자 ID',
  })
  blockedUserId!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: '차단한 시각',
  })
  blockedAt!: string;

  // DB 엔티티에서 응답에 필요한 값만 꺼낸다.
  static fromEntity(block: UserBlock): UserBlockResponseDto {
    return {
      blockedUserId: block.blockedUserId,
      blockedAt: block.createdAt.toISOString(),
    };
  }
}
