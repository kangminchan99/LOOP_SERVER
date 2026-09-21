import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { FcmService } from './fcm.service';

const mockSend = jest.fn();
const mockSendEach = jest.fn();
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ send: mockSend, sendEach: mockSendEach }),
}));

describe('FcmService', () => {
  let service: FcmService;
  beforeEach(async () => {
    mockSend.mockReset();
    mockSendEach.mockReset();
    // compile만 호출하므로 실제 인증 파일을 읽는 초기화 훅은 실행하지 않는다.
    const module = await Test.createTestingModule({
      providers: [FcmService, { provide: ConfigService, useValue: {} }],
    }).compile();
    service = module.get(FcmService);
  });
  it('단일 기기 메시지를 SDK에 전달한다', async () => {
    mockSend.mockResolvedValue('message-id');
    await expect(
      service.sendToToken({
        token: 'token',
        title: '제목',
        body: '내용',
        data: { postId: '1' },
      }),
    ).resolves.toBe('message-id');
    expect(mockSend).toHaveBeenCalledWith({
      token: 'token',
      notification: { title: '제목', body: '내용' },
      data: { postId: '1' },
    });
  });
  it('빈 토큰 목록이면 전송하지 않는다', async () => {
    await service.sendToTokens({ tokens: [], title: '제목', body: '내용' });
    expect(mockSendEach).not.toHaveBeenCalled();
  });
  it('501개 기기는 500개와 1개로 나누어 보낸다', async () => {
    await service.sendToTokens({
      tokens: Array.from({ length: 501 }, (_, i) => String(i)),
      title: '제목',
      body: '내용',
    });
    expect(mockSendEach).toHaveBeenCalledTimes(2);
    expect(mockSendEach).toHaveBeenNthCalledWith(
      1,
      Array.from({ length: 500 }, (_, i) => ({
        token: String(i),
        notification: { title: '제목', body: '내용' },
        data: undefined,
      })),
    );
    expect(mockSendEach).toHaveBeenNthCalledWith(2, [
      {
        token: '500',
        notification: { title: '제목', body: '내용' },
        data: undefined,
      },
    ]);
  });
});
