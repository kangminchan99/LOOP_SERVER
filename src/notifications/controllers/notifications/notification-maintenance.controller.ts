import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { NotificationQueueService } from '../../../queues/notification-queue/services/notification-queue/notification-queue.service';

class CleanupOldReadNotificationsRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days!: number;
}

@ApiTags('notification-maintenance')
@Controller('notification-maintenance')
export class NotificationMaintenanceController {
  constructor(
    private readonly notificationQueueService: NotificationQueueService,
  ) {}

  @ApiOperation({ summary: '오래된 읽은 알림 정리 작업 등록' })
  @ApiBody({
    schema: {
      example: {
        days: 30,
      },
    },
  })
  @ApiOkResponse({
    description: '오래된 읽은 알림 정리 작업 등록 성공',
    schema: {
      example: {
        success: true,
      },
    },
  })
  @Post('cleanup-old-read')
  @HttpCode(HttpStatus.OK)
  async cleanupOldReadNotifications(
    @Body() dto: CleanupOldReadNotificationsRequestDto,
  ): Promise<{ success: true }> {
    await this.notificationQueueService.addCleanupOldReadNotificationsJob({
      days: dto.days,
    });

    return { success: true };
  }
}
