import {
  Controller,
  Get,
  Header,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserCouponListPageDto } from '../dto/coupon-list-page.dto';
import { GetCouponsQueryDto } from '../dto/get-coupons-query.dto';
import { CouponExceptionFilter } from '../filters/coupon-exception.filter';
import { UserCouponsService } from '../services/user-coupons.service';

@ApiTags('coupons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseFilters(CouponExceptionFilter)
@Controller('coupons')
export class UserCouponsController {
  constructor(private readonly service: UserCouponsService) {}

  @Get('me')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '내 쿠폰 목록 (발급 최신순)' })
  @ApiOkResponse({ type: UserCouponListPageDto })
  list(@CurrentUser() userId: number, @Query() query: GetCouponsQueryDto) {
    return this.service.listMine(userId, query);
  }
}
