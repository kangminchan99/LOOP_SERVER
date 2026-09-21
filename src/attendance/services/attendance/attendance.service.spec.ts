import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from '../../../users/services/users/users.service';
import { Attendance } from '../../entities/attendance.entity';
import { AttendanceService } from './attendance.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  const repository = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const users = { addPoint: jest.fn(), findOne: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-09-21T12:00:00Z'));
    const module = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: getRepositoryToken(Attendance), useValue: repository },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    service = module.get(AttendanceService);
  });
  afterEach(() => jest.useRealTimers());

  it('이미 출석한 날에는 포인트를 다시 지급하지 않는다', async () => {
    repository.findOne.mockResolvedValue({ id: 1 });
    await expect(service.checkIn(1)).rejects.toThrow(
      '이미 오늘 출석체크를 완료했습니다.',
    );
    expect(repository.save).not.toHaveBeenCalled();
    expect(users.addPoint).not.toHaveBeenCalled();
  });

  it('전날 출석 기록이 있으면 연속 출석과 보상을 반영한다', async () => {
    repository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ streakCount: 2 });
    const attendance = Object.assign(new Attendance(), {
      userId: 1,
      checkedDate: '2026-09-21',
      streakCount: 3,
      rewardPoint: 10,
    });
    repository.create.mockReturnValue(attendance);
    repository.save.mockResolvedValue(attendance);
    users.addPoint.mockResolvedValue({ point: 30 });
    await expect(service.checkIn(1)).resolves.toEqual({
      checkedToday: true,
      checkedDate: '2026-09-21',
      streakCount: 3,
      rewardPoint: 10,
      totalPoint: 30,
    });
    expect(repository.findOne).toHaveBeenNthCalledWith(2, {
      where: { userId: 1, checkedDate: '2026-09-20' },
    });
    expect(users.addPoint).toHaveBeenCalledWith(1, 10);
  });
});
