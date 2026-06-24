import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface KakaoTokenInfo {
  id: number;
  expires_in: number;
  app_id: number;
}

interface KakaoUserResponse {
  id: number;
  kakao_account?: {
    email?: string;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
}

export interface KakaoProfile {
  id: string;
  email: string | null;
  nickname: string | null;
  profileImageUrl: string | null;
}

@Injectable()
export class KakaoAuthService {
  constructor(private readonly configService: ConfigService) {}

  async verifyAccessToken(kakaoAccessToken: string): Promise<string> {
    let response: Response;

    try {
      response = await fetch(
        'https://kapi.kakao.com/v1/user/access_token_info',
        {
          headers: {
            Authorization: `Bearer ${kakaoAccessToken}`,
          },
          signal: AbortSignal.timeout(5000),
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        '카카오 인증 서버에 연결할 수 없습니다.',
      );
    }

    if (!response.ok) {
      throw new UnauthorizedException('유효하지 않은 카카오 토큰입니다.');
    }

    const tokenInfo = (await response.json()) as KakaoTokenInfo;
    const expectedAppId = this.configService.getOrThrow<string>('KAKAO_APP_ID');

    if (String(tokenInfo.app_id) !== String(expectedAppId)) {
      throw new UnauthorizedException('다른 카카오 앱에서 발급된 토큰입니다.');
    }

    return String(tokenInfo.id);
  }

  async getUserProfile(kakaoAccessToken: string): Promise<KakaoProfile> {
    let response: Response;

    try {
      response = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: {
          Authorization: `Bearer ${kakaoAccessToken}`,
        },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException(
        '카카오 인증 서버에 연결할 수 없습니다.',
      );
    }

    if (!response.ok) {
      throw new UnauthorizedException(
        '카카오 사용자 정보를 가져올 수 없습니다.',
      );
    }

    const kakaoUser = (await response.json()) as KakaoUserResponse;
    const account = kakaoUser.kakao_account;

    const verifiedEmail =
      account?.is_email_valid === true && account?.is_email_verified === true
        ? (account.email ?? null)
        : null;

    return {
      id: String(kakaoUser.id),
      email: verifiedEmail,
      nickname: account?.profile?.nickname ?? null,
      profileImageUrl: account?.profile?.profile_image_url ?? null,
    };
  }

  async authenticate(kakaoAccessToken: string): Promise<KakaoProfile> {
    const verifiedUserId = await this.verifyAccessToken(kakaoAccessToken);

    const profile = await this.getUserProfile(kakaoAccessToken);

    if (profile.id !== verifiedUserId) {
      throw new UnauthorizedException(
        '카카오 사용자 정보가 일치하지 않습니다.',
      );
    }

    return profile;
  }
}
