import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { FcmToken } from '../../entities/fcm-token.entity';
import { Notification } from '../../entities/notification.entity';
import { FcmService } from '../fcm/fcm.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const tokens = { find: jest.fn(), delete: jest.fn() };
  const notifications = {
    count: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const fcm = { sendToTokens: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(FcmToken), useValue: tokens },
        { provide: getRepositoryToken(Notification), useValue: notifications },
        { provide: FcmService, useValue: fcm },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  it('로그아웃 시 해당 사용자 소유 토큰만 삭제한다', async () => {
    await service.deleteFcmToken(1, { token: 'device-token' });
    expect(tokens.delete).toHaveBeenCalledWith({
      userId: 1,
      token: 'device-token',
    });
  });

  it('수신 기기가 없으면 알림 저장과 FCM 전송을 생략한다', async () => {
    tokens.find.mockResolvedValue([]);
    await service.sendNewPostNotification({
      postId: 10,
      title: '게시글',
      authorId: 1,
    });
    expect(notifications.save).not.toHaveBeenCalled();
    expect(fcm.sendToTokens).not.toHaveBeenCalled();
  });

  it('자신의 읽지 않은 알림만 집계한다', async () => {
    notifications.count.mockResolvedValue(3);
    await expect(service.getUnreadCount(1)).resolves.toEqual({ count: 3 });
    expect(notifications.count).toHaveBeenCalledWith({
      where: { userId: 1, readAt: IsNull() },
    });
  });

  it('자신의 알림이 아니면 읽음 처리를 거부한다', async () => {
    notifications.findOne.mockResolvedValue(null);
    await expect(service.markAsRead(1, 5)).rejects.toThrow(
      '알림을 찾을 수 없습니다.',
    );
    expect(notifications.findOne).toHaveBeenCalledWith({
      where: { id: 5, userId: 1 },
    });
    expect(notifications.save).not.toHaveBeenCalled();
  });
});
