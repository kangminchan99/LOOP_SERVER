import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  NOTIFICATION_QUEUE,
  SEND_NEW_POST_NOTIFICATION_JOB,
  CLEANUP_OLD_READ_NOTIFICATIONS_JOB,
} from '../../notification-queue.constants';

export interface SendNewPostNotificationJobData {
  postId: number;
  title: string;
  authorId: number;
}

export interface CleanupOldReadNotificationsJobData {
  days: number;
}

@Injectable()
export class NotificationQueueService {
  constructor(
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {}

  async addNewPostNotificationJob(
    data: SendNewPostNotificationJobData,
  ): Promise<void> {
    await this.notificationQueue.add(SEND_NEW_POST_NOTIFICATION_JOB, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async addCleanupOldReadNotificationsJob(
    data: CleanupOldReadNotificationsJobData,
  ): Promise<void> {
    await this.notificationQueue.add(CLEANUP_OLD_READ_NOTIFICATIONS_JOB, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
