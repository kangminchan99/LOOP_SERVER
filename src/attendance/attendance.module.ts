import { Module } from '@nestjs/common';
import { AttendanceController } from './controllers/attendance/attendance.controller';
import { AttendanceService } from './services/attendance/attendance.service';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
