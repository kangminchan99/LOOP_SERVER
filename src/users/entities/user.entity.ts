import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

// DB에 users 테이블 생성
@Entity('users')
export class User {
  @ApiProperty({ example: 1, description: '유저 ID' })
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty({ example: 'test1@example.com', description: '유저 이메일' })
  @Column({ unique: true })
  email!: string;

  @ApiProperty({ example: '1234abcd', description: '유저 비밀번호' })
  @Column()
  password!: string;

  @ApiProperty({ example: 'minchan', description: '유저 닉네임' })
  @Column({ nullable: true })
  nickname!: string;

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
}
