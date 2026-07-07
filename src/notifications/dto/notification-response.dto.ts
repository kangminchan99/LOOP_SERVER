import { ApiProperty } from '@nestjs/swagger';
import {
  Notification,
  NotificationType,
} from '../entities/notification.entity';

export class NotificationResponseDto {
  @ApiProperty({
    example: 1,
    description: '알림 ID',
  })
  id!: number;

  @ApiProperty({
    enum: NotificationType,
    example: NotificationType.NEW_POST,
    description: '알림 타입',
  })
  type!: NotificationType;

  @ApiProperty({
    example: '새 게시글이 올라왔어요',
    description: '알림 제목',
  })
  title!: string;

  @ApiProperty({
    example: '관심사가 비슷한 새 글을 확인해보세요.',
    description: '알림 본문',
  })
  body!: string;

  @ApiProperty({
    example: { postId: 12 },
    description: '화면 이동 등에 필요한 부가 데이터',
    nullable: true,
  })
  data!: Record<string, unknown> | null;

  @ApiProperty({
    example: null,
    description: '읽은 시각. null이면 안 읽음',
    nullable: true,
  })
  readAt!: Date | null;

  @ApiProperty({
    example: '2026-07-07T12:00:00.000Z',
    description: '알림 생성 시각',
  })
  createdAt!: Date;

  static fromEntity(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}
