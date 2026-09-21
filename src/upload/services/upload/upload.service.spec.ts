import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../../users/entities/user.entity';
import { UploadService } from './upload.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));

describe('UploadService', () => {
  let service: UploadService;
  const sign = jest.mocked(getSignedUrl);
  beforeEach(async () => {
    sign.mockReset();
    const config: Record<string, string | number> = {
      AWS_REGION: 'ap-northeast-2',
      AWS_S3_BUCKET: 'test-bucket',
      AWS_ACCESS_KEY_ID: 'test-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret',
      AWS_S3_SIGNED_URL_EXPIRES_IN: 300,
    };
    const module = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: getRepositoryToken(User), useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => config[key] },
        },
      ],
    }).compile();
    service = module.get(UploadService);
  });
  it('사진이 없으면 서명하지 않는다', async () => {
    await expect(service.toSignedProfileImageUrl(null)).resolves.toBeNull();
    expect(sign).not.toHaveBeenCalled();
  });
  it('기존 외부 URL은 그대로 반환한다', async () => {
    await expect(
      service.toSignedProfileImageUrl('https://example.com/photo.jpg'),
    ).resolves.toBe('https://example.com/photo.jpg');
    expect(sign).not.toHaveBeenCalled();
  });
  it('S3 키는 만료 시간이 있는 서명 URL로 변환한다', async () => {
    sign.mockResolvedValue('https://example.com/signed');
    await expect(
      service.toSignedProfileImageUrl('profiles/test.webp'),
    ).resolves.toBe('https://example.com/signed');
    expect(sign).toHaveBeenCalledWith(
      expect.any(S3Client),
      expect.any(GetObjectCommand),
      { expiresIn: 300 },
    );
    expect(sign.mock.calls[0][1].input).toEqual({
      Bucket: 'test-bucket',
      Key: 'profiles/test.webp',
    });
  });
});
