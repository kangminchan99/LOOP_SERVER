import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../../../users/services/users/users.service';
import { AttendanceResponseDto } from '../../dto/attendance-response.dto';
import { Attendance } from '../../entities/attendance.entity';

@Injectable()
export class AttendanceService {
  private readonly rewardPoint = 10;

  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,

    private readonly usersService: UsersService,
  ) {}

  async getMyAttendance(userId: number): Promise<AttendanceResponseDto> {
    const today = this.getTodayString();

    const todayAttendance = await this.attendanceRepository.findOne({
      where: { userId, checkedDate: today },
    });

    const latestAttendance = await this.attendanceRepository.findOne({
      where: { userId },
      order: { checkedDate: 'DESC' },
    });

    const user = await this.usersService.findOne(userId);

    return {
      checkedToday: !!todayAttendance,
      checkedDate: todayAttendance?.checkedDate ?? null,
      streakCount: latestAttendance?.streakCount ?? 0,
      rewardPoint: this.rewardPoint,
      totalPoint: user.point,
    };
  }

  async checkIn(userId: number): Promise<AttendanceResponseDto> {
    const today = this.getTodayString();

    const alreadyChecked = await this.attendanceRepository.findOne({
      where: { userId, checkedDate: today },
    });

    if (alreadyChecked) {
      throw new BadRequestException('이미 오늘 출석체크를 완료했습니다.');
    }

    const yesterday = this.getYesterdayString();

    const yesterdayAttendance = await this.attendanceRepository.findOne({
      where: { userId, checkedDate: yesterday },
    });

    const streakCount = yesterdayAttendance
      ? yesterdayAttendance.streakCount + 1
      : 1;

    const attendance = this.attendanceRepository.create({
      userId,
      checkedDate: today,
      streakCount,
      rewardPoint: this.rewardPoint,
    });

    const savedAttendance = await this.attendanceRepository.save(attendance);

    const updatedUser = await this.usersService.addPoint(
      userId,
      this.rewardPoint,
    );

    return {
      checkedToday: true,
      checkedDate: savedAttendance.checkedDate,
      streakCount: savedAttendance.streakCount,
      rewardPoint: savedAttendance.rewardPoint,
      totalPoint: updatedUser.point,
    };
  }

  private getTodayString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getYesterdayString(): string {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
  }
}
