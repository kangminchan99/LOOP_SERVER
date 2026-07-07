import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './controllers/notifications/notifications.controller';
import { FcmToken } from './entities/fcm-token.entity';
import { FcmService } from './services/fcm/fcm.service';
import { NotificationsService } from './services/notifications/notifications.service';
import { Notification } from './entities/notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FcmToken, Notification])],
  controllers: [NotificationsController],
  providers: [FcmService, NotificationsService],
  exports: [FcmService, NotificationsService],
})
export class NotificationsModule {}
