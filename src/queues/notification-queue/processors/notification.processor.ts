import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from '../../../notifications/services/notifications/notifications.service';
import {
  NOTIFICATION_QUEUE,
  SEND_NEW_POST_NOTIFICATION_JOB,
} from '../notification-queue.constants';
import { SendNewPostNotificationJobData } from '../services/notification-queue/notification-queue.service';

@Processor(NOTIFICATION_QUEUE)
@Injectable()
export class NotificationProcessor extends WorkerHost {
  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case SEND_NEW_POST_NOTIFICATION_JOB: {
        const data = job.data as SendNewPostNotificationJobData;

        await this.notificationsService.sendNewPostNotification({
          postId: data.postId,
          title: data.title,
          authorId: data.authorId,
        });

        return;
      }

      default:
        return;
    }
  }
}
