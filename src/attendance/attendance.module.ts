import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AttendanceController } from './controllers/attendance/attendance.controller';
import { Attendance } from './entities/attendance.entity';
import { AttendanceService } from './services/attendance/attendance.service';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService],
  imports: [TypeOrmModule.forFeature([Attendance]), UsersModule],
})
export class AttendanceModule {}
