import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ChatMessage } from './chat-message.entity';
import { ChatRoom } from './chat-room.entity';

@Entity('chat_room_participants')
@Index(['roomId', 'userId'], { unique: true })
export class ChatRoomParticipant {
  @PrimaryGeneratedColumn()
  id!: number;

  /**
   * 어떤 채팅방에 속한 참여자인지
   */
  @Column()
  roomId!: number;

  /**
   * 어떤 유저가 참여자인지
   */
  @Column()
  userId!: number;

  /**
   * 이 유저가 마지막으로 읽은 메시지 ID.
   *
   * 나중에 안 읽은 메시지 수 계산에 사용한다.
   */
  @Column({
    nullable: true,
  })
  lastReadMessageId!: number | null;

  /**
   * 채팅방별 알림 on/off.
   *
   * 실무에서는 유저가 특정 채팅방 알림만 끌 수 있게 자주 둔다.
   */
  @Column({
    default: true,
  })
  notificationEnabled!: boolean;

  /**
   * 채팅방 입장 시간.
   */
  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  joinedAt!: Date;

  /**
   * 채팅방 나간 시간.
   *
   * null이면 아직 참여 중.
   */
  @Column({
    type: 'timestamptz',
    precision: 3,
    nullable: true,
  })
  leftAt!: Date | null;

  @ManyToOne(() => ChatRoom, (room) => room.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'roomId' })
  room!: ChatRoom;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => ChatMessage, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'lastReadMessageId' })
  lastReadMessage!: ChatMessage | null;
}
