import { Test } from '@nestjs/testing';
import { AttendanceService } from '../../services/attendance/attendance.service';
import { AttendanceController } from './attendance.controller';

describe('AttendanceController', () => {
  let controller: AttendanceController;
  const service = { getMyAttendance: jest.fn() };
  beforeEach(async () => {
    service.getMyAttendance.mockReset();
    const module = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [{ provide: AttendanceService, useValue: service }],
    }).compile();
    controller = module.get(AttendanceController);
  });
  it('조회 조건과 서비스 응답을 전달한다', async () => {
    const result = {
      checkedToday: false,
      checkedDate: null,
      streakCount: 0,
      rewardPoint: 10,
      totalPoint: 0,
    };
    service.getMyAttendance.mockResolvedValue(result);
    await expect(controller.getMyAttendance(1)).resolves.toEqual(result);
    expect(service.getMyAttendance).toHaveBeenCalledWith(1);
  });
  it('서비스 실패를 성공 응답으로 바꾸지 않는다', async () => {
    service.getMyAttendance.mockRejectedValue(new Error('service unavailable'));
    await expect(controller.getMyAttendance(1)).rejects.toThrow(
      'service unavailable',
    );
  });
});
