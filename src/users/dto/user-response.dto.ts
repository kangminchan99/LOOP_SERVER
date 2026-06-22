import { ApiProperty } from '@nestjs/swagger';
import { User } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ example: 1, description: '유저 ID' })
  id!: number;

  @ApiProperty({ example: 'test1@example.com', description: '유저 이메일' })
  email!: string;

  @ApiProperty({ example: 'minchan', description: '유저 닉네임' })
  nickname!: string;

  @ApiProperty({
    example:
      'https://loop-bucket-dev.s3.ap-northeast-2.amazonaws.com/profiles/2026/05/example.webp',
    description: '프로필 이미지 URL',
    nullable: true,
  })
  profileImageUrl!: string | null;

  @ApiProperty({
    example: '2026-05-11T14:30:00.000Z',
    description: '생성 시각',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-05-11T14:35:00.000Z',
    description: '수정 시각',
  })
  updatedAt!: Date;

  @ApiProperty({ example: 120, description: '유저 보유 포인트' })
  point!: number;

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      profileImageUrl: user.profileImageUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      point: user.point,
    };
  }
}
