import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RegisterFcmTokenDto } from '../../dto/register-fcm-token.dto';
import { NotificationsService } from '../../services/notifications/notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

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
}
