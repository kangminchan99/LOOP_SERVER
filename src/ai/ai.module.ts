import { Module } from '@nestjs/common';
import { OpenAiService } from './services/open-ai/open-ai.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [OpenAiService],
  exports: [OpenAiService],
})
export class AiModule {}
