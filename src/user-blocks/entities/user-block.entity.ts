import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_blocks')
// 동일한 사용자를 중복 차단하지 못하게 한다.
@Unique('UQ_user_blocks_blocker_target', ['blockerId', 'blockedUserId'])
// 내 차단 목록을 차단 시각·ID 순서로 조회할 때 사용한다.
@Index('IDX_user_blocks_blocker_created_id', ['blockerId', 'createdAt', 'id'])
// DB에서도 자기 자신 차단을 막는다.
@Check('CHK_user_blocks_not_self', '"blockerId" <> "blockedUserId"')
export class UserBlock {
  @PrimaryGeneratedColumn()
  id!: number;

  // 차단을 실행한 사용자
  @Column({ type: 'integer' })
  blockerId!: number;

  // 차단당한 사용자
  @Column({ type: 'integer' })
  blockedUserId!: number;

  // 차단 관계가 생성된 시각. 밀리초 정밀도를 사용한다.
  @CreateDateColumn({
    type: 'timestamptz',
    precision: 3,
  })
  createdAt!: Date;

  // 차단한 계정이 삭제되면 해당 차단 관계도 정리한다.
  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'blockerId' })
  blocker!: User;

  // 차단 대상 계정이 삭제돼도 해당 차단 관계를 정리한다.
  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'blockedUserId' })
  blockedUser!: User;
}
