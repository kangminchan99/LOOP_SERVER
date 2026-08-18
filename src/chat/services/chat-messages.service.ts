import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { GetChatMessagesQueryDto } from '../dto/get-chat-messages-query.dto';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatRoomParticipant } from '../entities/chat-room-participant.entity';

@Injectable()
export class ChatMessagesService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepository: Repository<ChatMessage>,

    @InjectRepository(ChatRoomParticipant)
    private readonly participantRepository: Repository<ChatRoomParticipant>,
  ) {}

  async findMessages(
    currentUserId: number,
    roomId: number,
    query: GetChatMessagesQueryDto,
  ): Promise<ChatMessage[]> {
    const participant = await this.participantRepository.findOne({
      where: {
        roomId,
        userId: currentUserId,
      },
      select: {
        id: true,
      },
    });

    if (!participant) {
      throw new ForbiddenException(
        '채팅방 참여자만 메시지를 조회할 수 있습니다.',
      );
    }

    const where =
      query.cursorId != null
        ? {
            roomId,
            id: LessThan(query.cursorId),
          }
        : {
            roomId,
          };

    const messages = await this.chatMessageRepository.find({
      where,
      relations: {
        sender: true,
      },
      order: {
        id: 'DESC',
      },
      take: query.limit,
    });

    return messages.reverse();
  }
}
