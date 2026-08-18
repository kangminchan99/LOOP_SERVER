import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChatMessageResponseDto } from '../dto/chat-message-response.dto';
import { ChatRoomResponseDto } from '../dto/chat-room-response.dto';
import { CreateDirectChatRoomDto } from '../dto/create-direct-chat-room.dto';
import { GetChatMessagesQueryDto } from '../dto/get-chat-messages-query.dto';
import { ChatMessagesService } from '../services/chat-messages.service';
import { ChatRoomsService } from '../services/chat-rooms.service';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat/rooms')
export class ChatRoomsController {
  constructor(
    private readonly chatRoomsService: ChatRoomsService,
    private readonly chatMessagesService: ChatMessagesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '1:1 채팅방 생성 또는 기존 채팅방 반환',
  })
  async createDirectRoom(
    @CurrentUser() userId: number,
    @Body() dto: CreateDirectChatRoomDto,
  ): Promise<ChatRoomResponseDto> {
    const room = await this.chatRoomsService.createDirectRoom(
      userId,
      dto.targetUserId,
    );

    return ChatRoomResponseDto.fromEntity(room);
  }

  @Get()
  @ApiOperation({
    summary: '내 채팅방 목록 조회',
  })
  async findMyRooms(
    @CurrentUser() userId: number,
  ): Promise<ChatRoomResponseDto[]> {
    const rooms = await this.chatRoomsService.findMyRooms(userId);

    return rooms.map((room) => ChatRoomResponseDto.fromEntity(room));
  }

  @ApiOperation({
    summary: '채팅방 메시지 목록 조회',
  })
  async findMessages(
    @CurrentUser() userId: number,
    @Param('roomId', ParseIntPipe) roomId: number,
    @Query() query: GetChatMessagesQueryDto,
  ): Promise<ChatMessageResponseDto[]> {
    const messages = await this.chatMessagesService.findMessages(
      userId,
      roomId,
      query,
    );

    return messages.map((message) =>
      ChatMessageResponseDto.fromEntity(message),
    );
  }
}
