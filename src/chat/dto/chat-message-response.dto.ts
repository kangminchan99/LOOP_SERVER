import { ApiProperty } from '@nestjs/swagger';
import { ChatMessage, ChatMessageType } from '../entities/chat-message.entity';

export class ChatMessageResponseDto {
  @ApiProperty({
    example: 1,
    description: '메시지 ID',
  })
  id!: number;

  @ApiProperty({
    example: 3,
    description: '채팅방 ID',
  })
  roomId!: number;

  @ApiProperty({
    example: 1,
    nullable: true,
    description: '메시지를 보낸 유저 ID',
  })
  senderId!: number | null;

  @ApiProperty({
    example: '민찬',
    nullable: true,
    description: '메시지를 보낸 유저 닉네임',
  })
  senderNickname!: string | null;

  @ApiProperty({
    example: '안녕하세요',
    description: '메시지 내용',
  })
  content!: string;

  @ApiProperty({
    enum: ChatMessageType,
    example: ChatMessageType.TEXT,
    description: '메시지 타입',
  })
  type!: ChatMessageType;

  @ApiProperty({
    example: false,
    description: '삭제된 메시지 여부',
  })
  isDeleted!: boolean;

  @ApiProperty({
    example: '2026-08-18T10:20:00.000Z',
    description: '메시지 생성일',
  })
  createdAt!: Date;

  static fromEntity(message: ChatMessage): ChatMessageResponseDto {
    const dto = new ChatMessageResponseDto();

    dto.id = message.id;
    dto.roomId = message.roomId;
    dto.senderId = message.senderId;
    dto.senderNickname = message.sender?.nickname ?? null;
    dto.content = message.deletedAt ? '삭제된 메시지입니다.' : message.content;
    dto.type = message.type;
    dto.isDeleted = message.deletedAt !== null;
    dto.createdAt = message.createdAt;

    return dto;
  }
}
