import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Put,
  Query,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CouponEventResponseDto } from '../dto/coupon-event-response.dto';
import { CouponEventListPageDto } from '../dto/coupon-list-page.dto';
import { GetCouponsQueryDto } from '../dto/get-coupons-query.dto';
import { UserCouponResponseDto } from '../dto/user-coupon-response.dto';
import { CouponExceptionFilter } from '../filters/coupon-exception.filter';
import { CouponEventIdPipe } from '../pipes/coupon-event-id.pipe';
import { UserCouponsService } from '../services/user-coupons.service';

@ApiTags('coupons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseFilters(CouponExceptionFilter)
@Controller('coupon-events')
export class CouponEventsController {
  constructor(private readonly service: UserCouponsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '쿠폰 이벤트 목록 (비활성 포함, 최신순)' })
  @ApiOkResponse({ type: CouponEventListPageDto })
  list(@CurrentUser() userId: number, @Query() query: GetCouponsQueryDto) {
    return this.service.listEvents(userId, query);
  }

  @Get(':eventId')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '쿠폰 이벤트 상세·현재 잔여량 조회' })
  @ApiOkResponse({ type: CouponEventResponseDto })
  detail(
    @CurrentUser() userId: number,
    @Param('eventId', CouponEventIdPipe) eventId: number,
  ) {
    return this.service.findEvent(userId, eventId);
  }

  @Put(':eventId/my-coupon')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: '본인 쿠폰 발급 또는 기존 쿠폰 반환 (본문 없음 또는 빈 객체)',
  })
  @ApiCreatedResponse({ type: UserCouponResponseDto, description: '최초 발급' })
  @ApiOkResponse({
    type: UserCouponResponseDto,
    description: '이미 발급된 쿠폰',
  })
  @ApiConflictResponse({ description: '비활성·시작 전·종료·품절' })
  @ApiServiceUnavailableResponse({
    description: '잠금 대기 초과. GET으로 결과 확인 후 재시도',
  })
  async issue(
    @CurrentUser() userId: number,
    @Param('eventId', CouponEventIdPipe) eventId: number,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    // 발급 대상과 수량을 클라이언트가 지정하지 못하게 한다.
    if (
      body !== undefined &&
      (body === null ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).length > 0)
    ) {
      throw new BadRequestException('요청 본문은 비워주세요.');
    }
    const result = await this.service.issue(userId, eventId);
    response.status(result.created ? 201 : 200);
    return result.coupon;
  }

  @Get(':eventId/my-coupon')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: '해당 이벤트의 본인 발급 결과 조회 (발급하지 않음)',
  })
  @ApiOkResponse({ type: UserCouponResponseDto })
  mine(
    @CurrentUser() userId: number,
    @Param('eventId', CouponEventIdPipe) eventId: number,
  ) {
    return this.service.findMine(userId, eventId);
  }
}
