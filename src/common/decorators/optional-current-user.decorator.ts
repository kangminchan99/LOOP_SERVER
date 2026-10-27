import { createParamDecorator, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: { id?: unknown } }>();

    // 비로그인 요청
    if (request.user === undefined) {
      return undefined;
    }

    // 인증 결과에 올바른 사용자 ID가 있는지 확인
    const userId = request.user.id;

    if (
      typeof userId !== 'number' ||
      !Number.isSafeInteger(userId) ||
      userId < 1 ||
      userId > 2147483647
    ) {
      throw new UnauthorizedException('잘못된 사용자 인증입니다.');
    }

    return userId;
  },
);
