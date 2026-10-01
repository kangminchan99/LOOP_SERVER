import {
  BadRequestException,
  Body,
  Controller,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CouponEventResponseDto } from '../../coupons/dto/coupon-event-response.dto';
import { CreateCouponEventDto } from '../../coupons/dto/create-coupon-event.dto';
import { UpdateCouponEventActivationDto } from '../../coupons/dto/update-coupon-event-activation.dto';
import { CouponEventsService } from '../../coupons/services/coupon-events.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/coupon-events')
export class AdminCouponEventsController {
  constructor(private readonly couponEventsService: CouponEventsService) {}

  @Post()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '관리자 쿠폰 이벤트 생성' })
  @ApiCreatedResponse({
    description: '기본 비활성 상태로 이벤트 생성',
    type: CouponEventResponseDto,
  })
  @ApiBadRequestResponse({ description: '잘못된 입력값입니다.' })
  @ApiUnauthorizedResponse({ description: '유효한 인증이 필요합니다.' })
  @ApiForbiddenResponse({ description: '관리자 권한이 필요합니다.' })
  create(
    @CurrentUser() adminUserId: number,
    @Body() dto: CreateCouponEventDto,
  ): Promise<CouponEventResponseDto> {
    // 인증된 사용자 ID와 검증된 요청을 Service에 전달한다.
    return this.couponEventsService.create(adminUserId, dto);
  }

  @Patch(':eventId/activation')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '관리자 쿠폰 이벤트 활성·중지' })
  @ApiOkResponse({
    description: '이벤트 상태 변경 성공',
    type: CouponEventResponseDto,
  })
  @ApiBadRequestResponse({
    description: '잘못된 이벤트 ID 또는 요청입니다.',
  })
  @ApiUnauthorizedResponse({ description: '유효한 인증이 필요합니다.' })
  @ApiForbiddenResponse({ description: '관리자 권한이 필요합니다.' })
  @ApiNotFoundResponse({ description: '이벤트를 찾을 수 없습니다.' })
  updateActivation(
    @CurrentUser() adminUserId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: UpdateCouponEventActivationDto,
  ): Promise<CouponEventResponseDto> {
    // PostgreSQL integer ID의 유효 범위를 검사한다.
    if (
      !Number.isSafeInteger(eventId) ||
      eventId <= 0 ||
      eventId > 2147483647
    ) {
      throw new BadRequestException('잘못된 이벤트 ID입니다.');
    }

    // 인증된 관리자 ID와 변경할 상태를 Service에 전달한다.
    return this.couponEventsService.updateActivation(adminUserId, eventId, dto);
  }
}
