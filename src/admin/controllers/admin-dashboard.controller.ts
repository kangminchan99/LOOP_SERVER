import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminDashboardResponseDto } from '../dto/admin-dashboard-response.dto';
import { AdminDashboardService } from '../services/admin-dashboard.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @ApiOperation({ summary: '관리자 대시보드 통계 조회' })
  @ApiOkResponse({
    description: '관리자 대시보드 통계 조회 성공',
    type: AdminDashboardResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiForbiddenResponse({ description: '관리자 권한이 필요합니다.' })
  @Get()
  getDashboard(): Promise<AdminDashboardResponseDto> {
    return this.adminDashboardService.getDashboard();
  }
}
