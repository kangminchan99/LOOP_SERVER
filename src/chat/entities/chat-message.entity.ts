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
import { ChatRoom } from './chat-room.entity';

export enum ChatMessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  SYSTEM = 'SYSTEM',
}

@Entity('chat_messages')
@Index(['roomId', 'createdAt', 'id'])
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  /**
   * 어떤 채팅방의 메시지인지
   */
  @Column()
  roomId!: number;

  /**
   * 누가 보낸 메시지인지
   *
   * SYSTEM 메시지는 senderId가 null일 수 있다.
   */
  @Column({
    nullable: true,
  })
  senderId!: number | null;

  /**
   * 메시지 내용.
   *
   * TEXT: 텍스트
   * IMAGE: 이미지 URL 또는 이미지 key
   * SYSTEM: 시스템 안내 문구
   */
  @Column({
    type: 'text',
  })
  content!: string;

  /**
   * 메시지 타입.
   */
  @Column({
    type: 'enum',
    enum: ChatMessageType,
    default: ChatMessageType.TEXT,
  })
  type!: ChatMessageType;

  /**
   * 사용자 화면에서는 삭제된 메시지로 표시하거나 숨길 수 있다.
   */
  @Column({
    type: 'timestamptz',
    precision: 3,
    nullable: true,
  })
  deletedAt!: Date | null;

  @ManyToOne(() => ChatRoom, (room) => room.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'roomId' })
  room!: ChatRoom;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'senderId' })
  sender!: User | null;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  createdAt!: Date;
}
