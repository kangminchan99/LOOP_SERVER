import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      // 1) Authorization 헤더에서 "Bearer {token}" 형식으로 토큰 추출
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // 2) JWT_SECRET 환경변수로 토큰 서명 검증
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // 3) 토큰 검증 성공 후 실행
  // payload = { sub: userId, type: 'access' }
  // 반환값이 Request.user에 붙음
  validate(payload: { sub: number; type: string }) {
    // Access Token의 종류까지 확인
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Access Token이 아닙니다.');
    }
    return { id: payload.sub };
  }
}
