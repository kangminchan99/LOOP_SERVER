import { Logger } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createThrottlerOptions } from './throttler.config';

describe('로컬 부하 테스트 요청 제한 설정', () => {
  beforeEach(() =>
    jest.spyOn(Logger, 'warn').mockImplementation(() => undefined),
  );
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['development', 'true', true],
    ['development', 'false', false],
    ['development', undefined, false],
    ['development', 'TRUE', false],
    ['production', 'true', false],
    ['test', 'true', false],
    [undefined, 'true', false],
  ])(
    'NODE_ENV=%s LOAD_TEST_MODE=%s일 때 skip=%s',
    (environment, flag, expected) => {
      // 실행 중인 셸 환경변수가 테스트 입력을 덮어쓰지 않도록 차단한다.
      const values: Record<string, string | undefined> = {
        NODE_ENV: environment,
        LOAD_TEST_MODE: flag,
      };
      const config = new ConfigService();
      jest
        .spyOn(config, 'get')
        .mockImplementation((key: string) => values[key]);
      const options = createThrottlerOptions(config);
      if (Array.isArray(options))
        throw new Error('공통 skipIf 설정이 필요합니다.');
      expect(options.throttlers).toEqual([{ ttl: 60_000, limit: 100 }]);
      expect(options.skipIf?.({} as ExecutionContext)).toBe(expected);
    },
  );
});
