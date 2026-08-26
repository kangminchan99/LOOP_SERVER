import { Module } from '@nestjs/common';
import { AdminSseController } from './controllers/admin-sse/admin-sse.controller';
import { AdminSseService } from './services/admin-sse.service';

@Module({
  controllers: [AdminSseController],
  providers: [AdminSseService],
})
export class AdminSseModule {}
