import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatMessageResponseDto } from '../dto/chat-message-response.dto';
import { SendChatMessageDto } from '../dto/send-chat-message.dto';
import { ChatMessagesService } from '../services/chat-messages.service';

type SocketData = {
  // 1. 연결 인증 성공 후 저장되는 로그인 유저 ID
  userId?: number;
};

// socket.data.userId를 안전하게 사용하기 위한 소켓 타입
type AuthenticatedSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>;

/**
 * 채팅 WebSocket 흐름
 * 1. 연결 시 JWT 검증
 * 2. chat:join으로 채팅방 입장
 * 3. chat:send로 메시지 저장 후 room에 전송
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection {
  // 특정 room에 이벤트를 보낼 socket.io 서버 인스턴스
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly chatMessagesService: ChatMessagesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // 1. 소켓 연결 시 accessToken 검증 후 userId 저장
  handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);

      const payload = this.jwtService.verify<{
        sub: number;
        type: string;
        role?: 'USER' | 'ADMIN';
      }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      if (payload.type !== 'access') {
        throw new WsException('Access Token이 아닙니다.');
      }

      client.data.userId = payload.sub;
    } catch {
      client.disconnect(true);
    }
  }

  // 2. 채팅방 room 입장
  @SubscribeMessage('chat:join')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: number },
  ) {
    const userId = this.getAuthenticatedUserId(client);

    await this.chatMessagesService.assertActiveParticipant(userId, body.roomId);

    const roomName = this.createRoomName(body.roomId);

    await client.join(roomName);

    return {
      event: 'chat:joined',
      data: {
        roomId: body.roomId,
      },
    };
  }

  // 3. 메시지 저장 후 같은 room에 실시간 전송
  @SubscribeMessage('chat:send')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: SendChatMessageDto,
  ) {
    const userId = this.getAuthenticatedUserId(client);

    const message = await this.chatMessagesService.createMessage(userId, body);

    const response = ChatMessageResponseDto.fromEntity(message);

    const roomName = this.createRoomName(body.roomId);

    this.server.to(roomName).emit('chat:message', response);

    return {
      event: 'chat:sent',
      data: response,
    };
  }

  // 인증된 소켓의 userId를 가져온다.
  private getAuthenticatedUserId(client: AuthenticatedSocket): number {
    const userId = client.data.userId;

    if (!userId) {
      throw new WsException('인증되지 않은 소켓입니다.');
    }

    return userId;
  }

  // handshake.auth.token에서 accessToken 추출
  private extractToken(client: AuthenticatedSocket): string {
    const auth = client.handshake.auth as unknown;

    if (!this.isSocketAuth(auth)) {
      throw new WsException('WebSocket 인증 토큰이 없습니다.');
    }

    const { token } = auth;

    if (typeof token !== 'string' || !token) {
      throw new WsException('WebSocket 인증 토큰이 없습니다.');
    }

    return token;
  }

  // 외부 입력인 handshake.auth를 안전하게 확인
  private isSocketAuth(auth: unknown): auth is { token: unknown } {
    return typeof auth === 'object' && auth !== null && 'token' in auth;
  }

  // roomId 3 → chat-room:3
  private createRoomName(roomId: number): string {
    return `chat-room:${roomId}`;
  }
}
