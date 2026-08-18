import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChatMessage } from './chat-message.entity';
import { ChatRoomParticipant } from './chat-room-participant.entity';

export enum ChatRoomType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
}

@Entity('chat_rooms')
export class ChatRoom {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'enum',
    enum: ChatRoomType,
    default: ChatRoomType.DIRECT,
  })
  type!: ChatRoomType;

  @Index({ unique: true })
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  directKey!: string | null;

  @OneToMany(() => ChatRoomParticipant, (participant) => participant.room)
  participants!: ChatRoomParticipant[];

  @OneToMany(() => ChatMessage, (message) => message.room)
  messages!: ChatMessage[];

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', precision: 3 })
  updatedAt!: Date;
}
