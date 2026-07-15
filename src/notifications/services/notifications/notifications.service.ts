import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BroadcastNotificationDto } from '../../dto/broadcast-notification.dto';
import { DeleteFcmTokenDto } from '../../dto/delete-fcm-token.dto';
import { NotificationResponseDto } from '../../dto/notification-response.dto';
import { RegisterFcmTokenDto } from '../../dto/register-fcm-token.dto';
import { FcmToken } from '../../entities/fcm-token.entity';
import {
  Notification,
  NotificationType,
} from '../../entities/notification.entity';
import { FcmService } from '../fcm/fcm.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(FcmToken)
    private readonly fcmTokensRepository: Repository<FcmToken>,

    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,

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
        userId: true,
        token: true,
      },
    });

    const uniqueUserIds = [...new Set(fcmTokens.map((item) => item.userId))];

    if (uniqueUserIds.length > 0) {
      const notifications = uniqueUserIds.map((userId) =>
        this.notificationsRepository.create({
          userId,
          type: NotificationType.NEW_POST,
          title: '새 게시글이 올라왔어요',
          body: params.title,
          data: {
            postId: params.postId,
            authorId: params.authorId,
          },
        }),
      );

      await this.notificationsRepository.save(notifications);
    }

    const tokens = fcmTokens.map((fcmToken) => fcmToken.token);

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

  // 내가 받은 알림 목록을 가져오는 메서드
  async findMyNotifications(
    userId: number,
  ): Promise<NotificationResponseDto[]> {
    const notifications = await this.notificationsRepository.find({
      where: { userId },
      order: {
        createdAt: 'DESC',
      },
      take: 50,
    });

    return notifications.map((notification) =>
      NotificationResponseDto.fromEntity(notification),
    );
  }

  // 내가 받은 알림 중 특정 알림을 읽음 처리하는 메서드
  async markAsRead(
    userId: number,
    notificationId: number,
  ): Promise<NotificationResponseDto> {
    const notification = await this.notificationsRepository.findOne({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('알림을 찾을 수 없습니다.');
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationsRepository.save(notification);
    }

    return NotificationResponseDto.fromEntity(notification);
  }

  // 알림 전체 읽음 처리
  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationsRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('readAt IS NULL')
      .execute();
  }

  // 안 읽은 개수 조회
  async getUnreadCount(userId: number): Promise<{ count: number }> {
    const count = await this.notificationsRepository.count({
      where: {
        userId,
        readAt: IsNull(),
      },
    });

    return { count };
  }

  // 오래된 읽은 알림 삭제
  async cleanupOldReadNotifications(
    days: number,
  ): Promise<{ deletedCount: number }> {
    const cutoffDate = new Date();

    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.notificationsRepository
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('readAt IS NOT NULL')
      .andWhere('readAt < :cutoffDate', { cutoffDate })
      .execute();

    return {
      deletedCount: result.affected ?? 0,
    };
  }
}
