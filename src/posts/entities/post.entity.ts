import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// TypeORM 엔티티: posts 테이블과 1:1로 매핑
@Entity('posts')
export class Post {
  // Swagger 응답 문서에 표시할 필드 설명
  @ApiProperty({ example: 1, description: '게시글 ID' })
  // DB 기본 키, 자동 증가 숫자
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty({ example: '첫 게시글 제목', description: '게시글 제목' })
  // 제목은 가변 문자열이며 최대 100자로 제한
  @Column({ length: 100 })
  title!: string;

  @ApiProperty({ example: '게시글 본문입니다.', description: '게시글 내용' })
  // 본문은 길 수 있으므로 text 타입 사용
  @Column({ type: 'text' })
  content!: string;

  @ApiProperty({ example: 1, description: '작성자 유저 ID' })
  // 작성자 기준 조회(내 글 목록) 성능을 위해 인덱스 부여
  @Index()
  @Column()
  authorId!: number;

  @ApiProperty({
    example: '2026-05-19T12:00:00.000Z',
    description: '생성 시각',
  })
  // INSERT 시점에 자동 저장
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty({
    example: '2026-05-19T12:10:00.000Z',
    description: '수정 시각',
  })
  // UPDATE 시점에 자동 갱신
  @UpdateDateColumn()
  updatedAt!: Date;
}
