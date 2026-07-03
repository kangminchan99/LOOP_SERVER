import {
  Body,
  Controller,
  Delete,
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
import { DeleteFcmTokenDto } from '../../dto/delete-fcm-token.dto';
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
}
