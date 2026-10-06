import { ServiceUnavailableException } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import type { CouponEventsRepository } from '../repositories/coupon-events.repository';
import { CouponTransactionsService } from './coupon-transactions.service';

describe('CouponTransactionsService 재시도 정책', () => {
  const create = () => {
    const transaction = jest.fn();
    const events = {
      findUserForKeyShare: jest.fn().mockResolvedValue({ id: 1 }),
    };
    const service = new CouponTransactionsService(
      { transaction } as unknown as DataSource,
      events as unknown as CouponEventsRepository,
    );
    return { service, transaction, events };
  };

  it.each(['40P01', '40001'])('%s는 최대 세 번만 시도한다', async (code) => {
    const { service, transaction } = create();
    transaction.mockRejectedValue({ code });
    await expect(
      service.run(1, () => Promise.resolve(1)),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it('재시도에서 성공하면 그 결과를 반환한다', async () => {
    const { service, transaction } = create();
    transaction
      .mockRejectedValueOnce({ code: '40P01' })
      .mockResolvedValueOnce('ok');
    await expect(service.run(1, () => Promise.resolve('ok'))).resolves.toBe(
      'ok',
    );
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it.each(['55P03', '57014', 'ECONNRESET', 'ECONNREFUSED', '53300'])(
    '%s는 503으로 반환하되 자동 재시도하지 않는다',
    async (code) => {
      const { service, transaction } = create();
      transaction.mockRejectedValue({ code });
      await expect(
        service.run(1, () => Promise.resolve(1)),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(transaction).toHaveBeenCalledTimes(1);
    },
  );

  it('풀 획득 시간 초과는 503이며 자동 재시도하지 않는다', async () => {
    const { service, transaction } = create();
    transaction.mockRejectedValue(
      new Error('timeout exceeded when trying to connect'),
    );
    await expect(
      service.run(1, () => Promise.resolve(1)),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('그 밖의 오류는 감추거나 성공 처리하지 않는다', async () => {
    const { service, transaction } = create();
    const error = { code: '23505', constraint: 'other_unique' };
    transaction.mockRejectedValue(error);
    await expect(service.run(1, () => Promise.resolve(1))).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('트랜잭션 manager를 사용하고 계정 확인 뒤에 업무를 실행한다', async () => {
    const { service, transaction, events } = create();
    const manager = {
      query: jest.fn().mockResolvedValue([]),
    } as unknown as EntityManager;
    transaction.mockImplementation(
      async (
        _level: string,
        callback: (manager: EntityManager) => Promise<string>,
      ) => callback(manager),
    );
    const work = jest.fn().mockResolvedValue('ok');
    await expect(service.run(1, work)).resolves.toBe('ok');
    expect(events.findUserForKeyShare).toHaveBeenCalledWith(manager, 1);
    expect(work).toHaveBeenCalledWith(manager);
  });
});
