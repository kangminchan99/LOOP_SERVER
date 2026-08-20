import { ApiProperty } from '@nestjs/swagger';
import { ChatRoom, ChatRoomType } from '../entities/chat-room.entity';

class ChatRoomParticipantResponseDto {
  @ApiProperty({
    example: 1,
    description: '참여자 유저 ID',
  })
  userId!: number;

  @ApiProperty({
    example: '민찬',
    description: '참여자 닉네임',
  })
  nickname!: string;

  @ApiProperty({
    example: 'https://example.com/profile.png',
    nullable: true,
    description: '참여자 프로필 이미지 URL',
  })
  profileImageUrl!: string | null;
}

export class ChatRoomResponseDto {
  @ApiProperty({
    example: 1,
    description: '채팅방 ID',
  })
  id!: number;

  @ApiProperty({
    enum: ChatRoomType,
    example: ChatRoomType.DIRECT,
    description: '채팅방 타입',
  })
  type!: ChatRoomType;

  @ApiProperty({
    type: [ChatRoomParticipantResponseDto],
    description: '채팅방 참여자 목록',
  })
  participants!: ChatRoomParticipantResponseDto[];

  @ApiProperty({
    example: null,
    nullable: true,
    description: '마지막 메시지 내용',
  })
  lastMessage!: string | null;

  @ApiProperty({
    example: 0,
    description: '안 읽은 메시지 수',
  })
  unreadCount!: number;

  @ApiProperty({
    example: '2026-08-18T10:00:00.000Z',
    description: '채팅방 생성일',
  })
  createdAt!: Date;

  static fromEntity(room: ChatRoom): ChatRoomResponseDto {
    const dto = new ChatRoomResponseDto();

    dto.id = room.id;
    dto.type = room.type;
    dto.participants =
      room.participants?.map((participant) => ({
        userId: participant.userId,
        nickname: participant.user?.nickname ?? '알 수 없음',
        profileImageUrl: participant.user?.profileImageUrl ?? null,
      })) ?? [];
    dto.lastMessage = room.messages?.[0]?.content ?? null;
    dto.unreadCount = 0;
    dto.createdAt = room.createdAt;

    return dto;
  }
}
