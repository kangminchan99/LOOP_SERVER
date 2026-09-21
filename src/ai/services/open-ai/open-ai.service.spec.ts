import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { OpenAiService } from './open-ai.service';

// SDK 경계만 대체한다. 실제 API나 환경변수는 사용하지 않는다.
const mockCreate = jest.fn();
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

describe('OpenAiService', () => {
  let service: OpenAiService;
  let settings: Record<string, string>;
  beforeEach(async () => {
    mockCreate.mockReset();
    settings = { AI_SUMMARY_ENABLED: 'true', OPENAI_MODEL: 'test-model' };
    const module = await Test.createTestingModule({
      providers: [
        OpenAiService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: () => 'test-key',
            get: (key: string) => settings[key],
          },
        },
      ],
    }).compile();
    service = module.get(OpenAiService);
  });
  afterEach(() => jest.restoreAllMocks());

  it('비활성화 시 API를 호출하지 않는다', async () => {
    settings.AI_SUMMARY_ENABLED = 'false';
    await expect(
      service.summarizePost({ title: '제목', content: '가'.repeat(100) }),
    ).resolves.toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });
  it('100자 미만의 본문은 요약하지 않는다', async () => {
    await expect(
      service.summarizePost({ title: '제목', content: '짧은 글' }),
    ).resolves.toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });
  it('SDK 응답을 공백 제거 후 반환한다', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: ' 요약문 ' } }],
    });
    await expect(
      service.summarizePost({ title: '제목', content: '가'.repeat(100) }),
    ).resolves.toBe('요약문');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'test-model', max_tokens: 200 }),
    );
  });
  it('외부 API 실패는 null로 처리한다', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    mockCreate.mockRejectedValue(new Error('timeout'));
    await expect(
      service.summarizePost({ title: '제목', content: '가'.repeat(100) }),
    ).resolves.toBeNull();
  });
});
