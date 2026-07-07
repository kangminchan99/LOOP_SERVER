import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { BroadcastNotificationDto } from '../../dto/broadcast-notification.dto';
import { DeleteFcmTokenDto } from '../../dto/delete-fcm-token.dto';
import { NotificationResponseDto } from '../../dto/notification-response.dto';
import { RegisterFcmTokenDto } from '../../dto/register-fcm-token.dto';
import { NotificationsService } from '../../services/notifications/notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: '내 알림 목록 조회' })
  @ApiOkResponse({
    description: '내 알림 목록 조회 성공',
    type: NotificationResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  @Get()
  findMyNotifications(
    @CurrentUser() userId: number,
  ): Promise<NotificationResponseDto[]> {
    return this.notificationsService.findMyNotifications(userId);
  }

  @ApiOperation({ summary: '안 읽은 알림 개수 조회' })
  @ApiOkResponse({
    description: '안 읽은 알림 개수 조회 성공',
    schema: {
      example: {
        count: 3,
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  @Get('unread-count')
  getUnreadCount(@CurrentUser() userId: number): Promise<{ count: number }> {
    return this.notificationsService.getUnreadCount(userId);
  }

  @ApiOperation({ summary: '알림 하나 읽음 처리' })
  @ApiOkResponse({
    description: '알림 읽음 처리 성공',
    type: NotificationResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  @ApiNotFoundResponse({ description: '알림을 찾을 수 없음' })
  @Patch(':id/read')
  markAsRead(
    @CurrentUser() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markAsRead(userId, id);
  }

  @ApiOperation({ summary: '내 알림 전체 읽음 처리' })
  @ApiOkResponse({ description: '전체 읽음 처리 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(
    @CurrentUser() userId: number,
  ): Promise<{ success: true }> {
    await this.notificationsService.markAllAsRead(userId);

    return { success: true };
  }

  @ApiOperation({ summary: 'FCM 토큰 등록' })
  @ApiBody({ type: RegisterFcmTokenDto })
  @ApiOkResponse({ description: 'FCM 토큰 등록 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  @Post('fcm-token')
  @HttpCode(HttpStatus.OK)
  async registerFcmToken(
    @CurrentUser() userId: number,
    @Body() dto: RegisterFcmTokenDto,
  ): Promise<{ success: true }> {
    await this.notificationsService.registerFcmToken(userId, dto);

    return { success: true };
  }

  @ApiOperation({ summary: 'FCM 토큰 삭제' })
  @ApiBody({ type: DeleteFcmTokenDto })
  @ApiOkResponse({ description: 'FCM 토큰 삭제 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  @Delete('fcm-token')
  @HttpCode(HttpStatus.OK)
  async deleteFcmToken(
    @CurrentUser() userId: number,
    @Body() dto: DeleteFcmTokenDto,
  ): Promise<{ success: true }> {
    await this.notificationsService.deleteFcmToken(userId, dto);

    return { success: true };
  }

  @ApiOperation({ summary: '전체 푸시 발송' })
  @ApiBody({ type: BroadcastNotificationDto })
  @ApiOkResponse({ description: '전체 푸시 발송 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  async broadcast(
    @Body() dto: BroadcastNotificationDto,
  ): Promise<{ success: true }> {
    await this.notificationsService.broadcastNotification(dto);

    return { success: true };
  }
}
