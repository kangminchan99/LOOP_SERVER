import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../../users/entities/user.entity';
import { UploadService } from '../../../upload/services/upload/upload.service';
import { SocialAccount } from '../../entities/social-account.entity';
import { KakaoAuthService } from '../kakao/kakao-auth.service';
import { GoogleAuthService } from '../google/google-auth.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const users = { findOne: jest.fn() };
  const jwt = { sign: jest.fn(), verify: jest.fn() };
  const upload = { toSignedProfileImageUrl: jest.fn() };
  const config: Record<string, string> = {
    JWT_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(SocialAccount), useValue: {} },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: { getOrThrow: (key: string) => config[key] },
        },
        { provide: UploadService, useValue: upload },
        { provide: KakaoAuthService, useValue: {} },
        { provide: GoogleAuthService, useValue: {} },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('refresh 검증 후 서로 다른 비밀키와 용도로 토큰을 발급한다', async () => {
    const user = Object.assign(new User(), {
      id: 1,
      email: 'test@example.com',
      nickname: 'tester',
      password: 'hashed',
      role: 'USER',
      profileImageUrl: 'profiles/test.webp',
    });
    jwt.verify.mockReturnValue({ sub: 1, type: 'refresh' });
    users.findOne.mockResolvedValue(user);
    jwt.sign
      .mockReturnValueOnce('new-access')
      .mockReturnValueOnce('new-refresh');
    upload.toSignedProfileImageUrl.mockResolvedValue(
      'https://example.com/signed',
    );
    const result = await service.refresh({ refreshToken: 'valid-token' });

    expect(jwt.verify).toHaveBeenCalledWith('valid-token', {
      secret: config.JWT_REFRESH_SECRET,
    });
    expect(users.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(jwt.sign).toHaveBeenNthCalledWith(
      1,
      { sub: 1, role: 'USER', type: 'access' },
      { secret: config.JWT_SECRET, expiresIn: '15m' },
    );
    expect(jwt.sign).toHaveBeenNthCalledWith(
      2,
      { sub: 1, role: 'USER', type: 'refresh' },
      { secret: config.JWT_REFRESH_SECRET, expiresIn: '7d' },
    );
    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
    expect(result.user.profileImageUrl).toBe('https://example.com/signed');
    expect(result.user).not.toHaveProperty('password');
  });

  it('잘못된 서명의 토큰은 거부한다', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    await expect(service.refresh({ refreshToken: 'invalid' })).rejects.toThrow(
      '유효하지 않은 Refresh Token입니다.',
    );
    expect(users.findOne).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('access 토큰으로 refresh할 수 없다', async () => {
    jwt.verify.mockReturnValue({ sub: 1, type: 'access' });
    await expect(service.refresh({ refreshToken: 'access' })).rejects.toThrow(
      '유효하지 않은 Refresh Token입니다.',
    );
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('삭제된 사용자에게 새 토큰을 발급하지 않는다', async () => {
    jwt.verify.mockReturnValue({ sub: 1, type: 'refresh' });
    users.findOne.mockResolvedValue(null);
    await expect(service.refresh({ refreshToken: 'valid' })).rejects.toThrow(
      '유저를 찾을 수 없습니다.',
    );
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});
