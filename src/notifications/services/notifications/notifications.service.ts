import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BroadcastNotificationDto } from '../../dto/broadcast-notification.dto';
import { DeleteFcmTokenDto } from '../../dto/delete-fcm-token.dto';
import { RegisterFcmTokenDto } from '../../dto/register-fcm-token.dto';
import { FcmToken } from '../../entities/fcm-token.entity';
import { FcmService } from '../fcm/fcm.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(FcmToken)
    private readonly fcmTokensRepository: Repository<FcmToken>,
    private readonly fcmService: FcmService,
  ) {}

  async registerFcmToken(
    userId: number,
    dto: RegisterFcmTokenDto,
  ): Promise<void> {
    const existingToken = await this.fcmTokensRepository.findOne({
      where: { token: dto.token },
    });

    if (existingToken) {
      existingToken.userId = userId;
      existingToken.platform = dto.platform;
      existingToken.lastUsedAt = new Date();

      await this.fcmTokensRepository.save(existingToken);
      return;
    }

    const fcmToken = this.fcmTokensRepository.create({
      userId,
      token: dto.token,
      platform: dto.platform,
      lastUsedAt: new Date(),
    });

    await this.fcmTokensRepository.save(fcmToken);
  }

  async deleteFcmToken(userId: number, dto: DeleteFcmTokenDto): Promise<void> {
    await this.fcmTokensRepository.delete({
      userId,
      token: dto.token,
    });
  }

  // 새로운 글 작성 시 FCM 푸시 알림을 보내는 메서드
  async sendNewPostNotification(params: {
    postId: number;
    title: string;
    authorId: number;
  }): Promise<void> {
    const fcmTokens = await this.fcmTokensRepository.find({
      select: {
        token: true,
      },
    });

    const tokens = fcmTokens.map((fcmToken) => fcmToken.token);

    // FCM 토큰이 없으면 알림을 보내지 않는다.
    if (tokens.length === 0) {
      return;
    }

    await this.fcmService.sendToTokens({
      tokens,
      title: '새 게시글이 올라왔어요',
      body: params.title,
      data: {
        type: 'new_post',
        postId: String(params.postId),
        authorId: String(params.authorId),
      },
    });
  }

  async broadcastNotification(dto: BroadcastNotificationDto): Promise<void> {
    const fcmTokens = await this.fcmTokensRepository.find({
      select: {
        token: true,
      },
    });

    const tokens = fcmTokens.map((item) => item.token);

    if (tokens.length === 0) {
      return;
    }

    await this.fcmService.sendToTokens({
      tokens,
      title: dto.title,
      body: dto.body,
      data: {
        type: dto.type ?? 'broadcast',
      },
    });
  }
}
