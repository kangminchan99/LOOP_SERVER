import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { ChatRoomsController } from './controllers/chat-rooms.controller';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatRoomParticipant } from './entities/chat-room-participant.entity';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatMessagesService } from './services/chat-messages.service';
import { ChatRoomsService } from './services/chat-rooms.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatRoom,
      ChatRoomParticipant,
      ChatMessage,
      User,
    ]),
  ],
  providers: [ChatRoomsService, ChatMessagesService],
  controllers: [ChatRoomsController],
})
export class ChatModule {}
