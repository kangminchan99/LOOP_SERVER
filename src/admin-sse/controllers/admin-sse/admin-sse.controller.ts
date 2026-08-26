import { Controller, MessageEvent, Sse, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { interval, map, Observable } from 'rxjs';
import { AdminGuard } from '../../../auth/guards/admin.guard';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { AdminSseService } from '../../services/admin-sse.service';

@ApiTags('admin-sse')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/sse')
export class AdminSseController {
  constructor(private readonly adminSseService: AdminSseService) {}

  @ApiOperation({
    summary: '관리자 서버 상태 SSE 스트림',
    description: '관리자 대시보드에서 서버 상태를 실시간으로 수신합니다.',
  })
  @ApiUnauthorizedResponse({
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiForbiddenResponse({
    description: '관리자 권한이 필요합니다.',
  })
  @Sse('server-status')
  streamServerStatus(): Observable<MessageEvent> {
    return interval(1000).pipe(
      map(() => ({
        type: 'server_status',
        data: this.adminSseService.getServerStatus(),
      })),
    );
  }
}
