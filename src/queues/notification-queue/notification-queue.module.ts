import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NOTIFICATION_QUEUE } from './notification-queue.constants';
import { NotificationQueueService } from './services/notification-queue/notification-queue.service';
import { NotificationProcessor } from './processors/notification.processor';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
    }),
    NotificationsModule,
  ],
  providers: [NotificationQueueService, NotificationProcessor],
  exports: [NotificationQueueService],
})
export class NotificationQueueModule {}
