import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class CouponExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CouponExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const body =
      error instanceof HttpException ? error.getResponse() : undefined;
    const defaults: Record<number, string> = {
      400: 'INVALID_COUPON_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      429: 'RATE_LIMITED',
      503: 'COUPON_TEMPORARILY_UNAVAILABLE',
    };
    const code =
      body && typeof body === 'object' && 'code' in body
        ? body.code
        : (defaults[status] ?? 'INTERNAL_SERVER_ERROR');
    const message =
      status === 500
        ? '쿠폰 처리 중 오류가 발생했습니다.'
        : body && typeof body === 'object' && 'message' in body
          ? body.message
          : body;
    if (status === 500)
      this.logger.error(
        '쿠폰 요청 처리 실패: 내부 로그/DB 상태를 확인해주세요.',
      );
    response.setHeader('Cache-Control', 'private, no-store');
    if (
      (status === 503 || status === 429) &&
      !response.hasHeader('Retry-After')
    )
      response.setHeader('Retry-After', status === 429 ? '60' : '1');
    response.status(status).json({ statusCode: status, code, message });
  }
}
