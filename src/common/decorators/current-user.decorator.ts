import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): number => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: { id: number; email: string } }>();
    return request.user.id; // JwtStrategy에서 붙인 user.id
  },
);
