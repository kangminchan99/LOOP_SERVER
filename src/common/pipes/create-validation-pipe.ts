import { ValidationPipe } from '@nestjs/common';

// 실제 서버와 HTTP 테스트가 동일한 요청 검증 규칙을 사용한다.
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
}
