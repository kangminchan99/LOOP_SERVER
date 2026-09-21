import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

export function createThrottlerOptions(
  config: ConfigService,
): ThrottlerModuleOptions {
  // 플래그만으로는 해제할 수 없다. 명시적인 개발 환경에서만 허용한다.
  const skip =
    config.get<string>('NODE_ENV') === 'development' &&
    config.get<string>('LOAD_TEST_MODE') === 'true';

  if (skip) {
    Logger.warn(
      '로컬 부하 테스트 모드: 전역 요청 제한 해제. 외부에 노출하지 말고 테스트 후 LOAD_TEST_MODE=false로 재시작하세요.',
      'ThrottlerConfig',
    );
  }

  return {
    throttlers: [{ ttl: 60_000, limit: 100 }],
    skipIf: () => skip,
  };
}
