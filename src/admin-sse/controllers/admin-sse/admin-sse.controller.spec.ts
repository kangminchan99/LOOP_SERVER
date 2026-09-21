import { Test } from '@nestjs/testing';
import { AdminSseService } from '../../services/admin-sse.service';
import { AdminSseController } from './admin-sse.controller';

describe('AdminSseController', () => {
  let controller: AdminSseController;
  const status = { getServerStatus: jest.fn() };
  beforeEach(async () => {
    status.getServerStatus.mockReset();
    jest.useFakeTimers();
    const module = await Test.createTestingModule({
      controllers: [AdminSseController],
      providers: [{ provide: AdminSseService, useValue: status }],
    }).compile();
    controller = module.get(AdminSseController);
  });
  afterEach(() => jest.useRealTimers());
  it('1초마다 상태를 전달하고 구독 해제 시 중단한다', () => {
    const data = { uptime: 10 };
    status.getServerStatus.mockReturnValue(data);
    const next = jest.fn();
    const subscription = controller.streamServerStatus().subscribe(next);
    try {
      expect(next).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1000);
      expect(next).toHaveBeenCalledWith({ type: 'server_status', data });
      expect(next).toHaveBeenCalledTimes(1);
      subscription.unsubscribe();
      jest.advanceTimersByTime(2000);
      expect(status.getServerStatus).toHaveBeenCalledTimes(1);
    } finally {
      subscription.unsubscribe();
    }
  });
});
