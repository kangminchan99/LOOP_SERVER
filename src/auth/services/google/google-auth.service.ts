import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

export interface GoogleProfile {
  id: string;
  email: string | null;
  nickname: string | null;
  profileImageUrl: string | null;
}

@Injectable()
export class GoogleAuthService {
  private readonly client = new OAuth2Client();

  constructor(private readonly configService: ConfigService) {}

  async authenticate(googleIdToken: string): Promise<GoogleProfile> {
    const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');

    let payload: TokenPayload | undefined;

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: googleIdToken,
        audience: clientId,
      });

      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('유효하지 않은 구글 토큰입니다.');
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('구글 사용자 정보를 확인할 수 없습니다.');
    }

    if (payload.email && payload.email_verified !== true) {
      throw new UnauthorizedException('검증되지 않은 구글 이메일입니다.');
    }

    return {
      id: payload.sub,
      email: payload.email ?? null,
      nickname: payload.name ?? null,
      profileImageUrl: payload.picture ?? null,
    };
  }
}
