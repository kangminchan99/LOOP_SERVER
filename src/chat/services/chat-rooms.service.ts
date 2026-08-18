import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ChatRoomParticipant } from '../entities/chat-room-participant.entity';
import { ChatRoom, ChatRoomType } from '../entities/chat-room.entity';

@Injectable()
export class ChatRoomsService {
  constructor(
    @InjectRepository(ChatRoom)
    private readonly chatRoomRepository: Repository<ChatRoom>,

    @InjectRepository(ChatRoomParticipant)
    private readonly participantRepository: Repository<ChatRoomParticipant>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly dataSource: DataSource,
  ) {}

  async createDirectRoom(
    currentUserId: number,
    targetUserId: number,
  ): Promise<ChatRoom> {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('자기 자신과는 채팅할 수 없습니다.');
    }

    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
      select: {
        id: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('상대 유저를 찾을 수 없습니다.');
    }

    const directKey = this.createDirectKey(currentUserId, targetUserId);

    const existingRoom = await this.chatRoomRepository.findOne({
      where: {
        directKey,
      },
      relations: {
        participants: {
          user: true,
        },
      },
    });

    if (existingRoom) {
      return existingRoom;
    }

    return this.dataSource.transaction(async (manager) => {
      const room = manager.create(ChatRoom, {
        type: ChatRoomType.DIRECT,
        directKey,
      });

      const savedRoom = await manager.save(ChatRoom, room);

      const participants = [
        manager.create(ChatRoomParticipant, {
          roomId: savedRoom.id,
          userId: currentUserId,
        }),
        manager.create(ChatRoomParticipant, {
          roomId: savedRoom.id,
          userId: targetUserId,
        }),
      ];

      await manager.save(ChatRoomParticipant, participants);

      const createdRoom = await manager.findOne(ChatRoom, {
        where: {
          id: savedRoom.id,
        },
        relations: {
          participants: {
            user: true,
          },
        },
      });

      if (!createdRoom) {
        throw new NotFoundException('생성된 채팅방을 찾을 수 없습니다.');
      }

      return createdRoom;
    });
  }

  async findMyRooms(currentUserId: number): Promise<ChatRoom[]> {
    return this.chatRoomRepository
      .createQueryBuilder('room')
      .innerJoin('room.participants', 'myParticipant')
      .leftJoinAndSelect('room.participants', 'participants')
      .leftJoinAndSelect('participants.user', 'user')
      .where('myParticipant.userId = :currentUserId', { currentUserId })
      .andWhere('myParticipant.leftAt IS NULL')
      .orderBy('room.updatedAt', 'DESC')
      .getMany();
  }

  private createDirectKey(userIdA: number, userIdB: number): string {
    const [smallerId, largerId] = [userIdA, userIdB].sort((a, b) => a - b);

    return `${smallerId}:${largerId}`;
  }
}
