import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { CouponEventsRepository } from '../repositories/coupon-events.repository';

export function postgresError(error: unknown): {
  code?: string;
  constraint?: string;
} {
  const driver: unknown =
    error instanceof QueryFailedError ? error.driverError : error;
  if (typeof driver !== 'object' || driver === null) return {};
  return {
    code:
      'code' in driver && typeof driver.code === 'string'
        ? driver.code
        : undefined,
    constraint:
      'constraint' in driver && typeof driver.constraint === 'string'
        ? driver.constraint
        : undefined,
  };
}

@Injectable()
export class CouponTransactionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly events: CouponEventsRepository,
  ) {}

  async run<T>(
    userId: number,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) {
      throw new UnauthorizedException('잘못된 사용자 인증입니다.');
    }
    const started = performance.now();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.dataSource.transaction(
          'READ COMMITTED',
          async (manager) => {
            const remaining = Math.floor(5000 - (performance.now() - started));
            if (remaining <= 0)
              throw new ServiceUnavailableException(
                '잠시 후 다시 시도해주세요.',
              );
            // 트랜잭션 종료 시 자동 해제된다. 풀의 다른 요청에 설정이 남지 않는다.
            await manager.query(
              `SELECT set_config('lock_timeout', $1, true), set_config('statement_timeout', $2, true)`,
              [
                `${Math.min(1000, remaining)}ms`,
                `${Math.min(3000, remaining)}ms`,
              ],
            );
            if (!(await this.events.findUserForKeyShare(manager, userId))) {
              throw new UnauthorizedException('존재하지 않는 계정입니다.');
            }
            return work(manager);
          },
        );
      } catch (error: unknown) {
        const { code } = postgresError(error);
        // 롤백이 확실한 교착·직렬화 실패만 재시도한다. 연결 오류는 자동 재발급하지 않는다.
        if (code === '40P01' || code === '40001') {
          if (attempt < 2 && performance.now() - started < 4500) {
            await new Promise((resolve) =>
              setTimeout(resolve, 20 * 2 ** attempt + Math.random() * 30),
            );
            continue;
          }
          throw new ServiceUnavailableException(
            '발급 요청이 많습니다. 잠시 후 다시 시도해주세요.',
          );
        }
        const poolTimeout =
          error instanceof Error &&
          [
            'timeout exceeded when trying to connect',
            'Connection terminated due to connection timeout',
          ].includes(error.message);
        if (
          poolTimeout ||
          (code &&
            [
              '55P03',
              '57014',
              '53300',
              '57P01',
              '57P02',
              '57P03',
              '08000',
              '08001',
              '08003',
              '08004',
              '08006',
              '08007',
              '08P01',
              'ECONNREFUSED',
              'ECONNRESET',
              'ETIMEDOUT',
              'EPIPE',
            ].includes(code))
        ) {
          throw new ServiceUnavailableException(
            '처리 대기 시간이 초과되었습니다. 발급 결과를 조회해주세요.',
          );
        }
        throw error;
      }
    }
    throw new ServiceUnavailableException();
  }
}
