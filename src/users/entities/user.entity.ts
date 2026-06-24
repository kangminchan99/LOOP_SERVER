import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// DB에 users 테이블 생성
@Entity('users')
export class User {
  @ApiProperty({ example: 1, description: '유저 ID' })
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty({ example: 'test1@example.com', description: '유저 이메일' })
  @Column({ type: 'varchar', unique: true, nullable: true })
  email!: string | null;

  @ApiProperty({ example: '1234abcd', description: '유저 비밀번호' })
  @Column({ type: 'varchar', nullable: true })
  password!: string | null;

  @ApiProperty({ example: 'minchan', description: '유저 닉네임' })
  @Column({ nullable: true })
  nickname!: string;

  @ApiProperty({
    example:
      'https://loop-bucket-dev.s3.ap-northeast-2.amazonaws.com/profiles/2026/05/example.webp',
    description: '프로필 이미지 URL',
    nullable: true,
  })
  @Column({ type: 'varchar', nullable: true })
  profileImageUrl!: string | null;

  @ApiProperty({
    example: '2026-05-11T14:30:00.000Z',
    description: '생성 시각',
  })
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty({
    example: '2026-05-11T14:35:00.000Z',
    description: '수정 시각',
  })
  @UpdateDateColumn()
  updatedAt!: Date;

  @ApiProperty({
    example: 120,
    description: '유저 보유 포인트',
  })
  @Column({ default: 0 })
  point!: number;
}
