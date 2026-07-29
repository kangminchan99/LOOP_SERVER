import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('OPENAI_API_KEY');

    this.model =
      this.configService.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';

    this.client = new OpenAI({
      apiKey,
    });
  }

  async summarizePost(params: {
    title: string;
    content: string;
  }): Promise<string | null> {
    const enabled =
      this.configService.get<string>('AI_SUMMARY_ENABLED') === 'true';

    if (!enabled) {
      return null;
    }

    const title = params.title.trim();
    const content = params.content.trim();

    if (content.length < 100) {
      return null;
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.2,
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content:
              '너는 커뮤니티 게시글을 요약하는 도우미다. 한국어로만 답변하고, 원문에 없는 내용을 추가하지 않는다.',
          },
          {
            role: 'user',
            content: `
아래 게시글을 2문장 이내로 요약해줘.

규칙:
- 한국어로 작성
- 2문장 이내
- 과장 금지
- 원문에 없는 내용 추가 금지
- 개인정보가 있으면 그대로 반복하지 않기
- 요약문만 반환

제목:
${title}

본문:
${content}
`,
          },
        ],
      });

      const summary = response.choices[0]?.message?.content?.trim();

      if (!summary) {
        return null;
      }

      return summary;
    } catch (error) {
      this.logger.error('OpenAI 게시글 요약 생성 실패', error);
      return null;
    }
  }
}
