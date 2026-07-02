import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './controllers/notifications/notifications.controller';
import { FcmToken } from './entities/fcm-token.entity';
import { FcmService } from './services/fcm/fcm.service';
import { NotificationsService } from './services/notifications/notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([FcmToken])],
  controllers: [NotificationsController],
  providers: [FcmService, NotificationsService],
  exports: [FcmService, NotificationsService],
})
export class NotificationsModule {}
