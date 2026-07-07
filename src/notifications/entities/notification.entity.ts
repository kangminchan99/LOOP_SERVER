import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
  NEW_POST = 'new_post',
}

@Entity('notifications')
@Index(['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number;

  // 알림을 받을 유저 ID
  @Column()
  userId!: number;

  // 알림 종류
  // 예: 새 게시글, 댓글, 좋아요 등
  @Column({ type: 'varchar', length: 50 })
  type!: NotificationType;

  // 알림 제목
  @Column({ type: 'varchar', length: 100 })
  title!: string;

  // 알림 본문
  @Column({ type: 'varchar', length: 500 })
  body!: string;

  // 화면 이동에 필요한 부가 데이터
  // 예: { "postId": 12 }
  @Column({ type: 'jsonb', nullable: true })
  data!: Record<string, unknown> | null;

  // 읽은 시간
  // null이면 아직 읽지 않은 알림
  @Column({ type: 'timestamp', nullable: true })
  readAt!: Date | null;

  // 유저가 삭제되면 해당 유저의 알림도 같이 삭제
  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  user!: User;

  // 알림 생성 시간
  @CreateDateColumn()
  createdAt!: Date;
}
