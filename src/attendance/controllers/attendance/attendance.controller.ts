import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AttendanceResponseDto } from '../../dto/attendance-response.dto';
import { AttendanceService } from '../../services/attendance/attendance.service';

@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @ApiOperation({ summary: '내 출석 상태 조회' })
  @ApiOkResponse({
    description: '출석 상태 조회 성공',
    type: AttendanceResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @Get('me')
  async getMyAttendance(
    @CurrentUser() userId: number,
  ): Promise<AttendanceResponseDto> {
    return this.attendanceService.getMyAttendance(userId);
  }

  @ApiOperation({ summary: '오늘 출석 체크' })
  @ApiCreatedResponse({
    description: '출석 체크 성공',
    type: AttendanceResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @Post('check-in')
  async checkIn(@CurrentUser() userId: number): Promise<AttendanceResponseDto> {
    return this.attendanceService.checkIn(userId);
  }
}
