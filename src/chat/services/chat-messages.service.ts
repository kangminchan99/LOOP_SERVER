import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { GetChatMessagesQueryDto } from '../dto/get-chat-messages-query.dto';
import { SendChatMessageDto } from '../dto/send-chat-message.dto';
import { ChatMessage, ChatMessageType } from '../entities/chat-message.entity';
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
    await this.assertActiveParticipant(currentUserId, roomId);

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

  async createMessage(
    currentUserId: number,
    dto: SendChatMessageDto,
  ): Promise<ChatMessage> {
    await this.assertActiveParticipant(currentUserId, dto.roomId);

    const content = dto.content.trim();

    if (!content) {
      throw new BadRequestException('메시지 내용을 입력해주세요.');
    }

    const message = this.chatMessageRepository.create({
      roomId: dto.roomId,
      senderId: currentUserId,
      content,
      type: ChatMessageType.TEXT,
    });

    const savedMessage = await this.chatMessageRepository.save(message);

    const messageWithSender = await this.chatMessageRepository.findOne({
      where: {
        id: savedMessage.id,
      },
      relations: {
        sender: true,
      },
    });

    if (!messageWithSender) {
      throw new NotFoundException('저장된 메시지를 찾을 수 없습니다.');
    }

    return messageWithSender;
  }

  async assertActiveParticipant(
    currentUserId: number,
    roomId: number,
  ): Promise<void> {
    const participant = await this.participantRepository.findOne({
      where: {
        roomId,
        userId: currentUserId,
        leftAt: IsNull(),
      },
      select: {
        id: true,
      },
    });

    if (!participant) {
      throw new ForbiddenException('채팅방 참여자만 사용할 수 있습니다.');
    }
  }
}
