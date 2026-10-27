import type { ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  override canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();

    // 인증 헤더가 없으면 비로그인 조회를 허용한다.
    if (request.headers.authorization === undefined) {
      return true;
    }

    // 헤더가 있으면 기존 JWT 인증을 반드시 통과해야 한다.
    return super.canActivate(context);
  }
}
