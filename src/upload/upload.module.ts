import { Module } from '@nestjs/common';
import { UploadService } from './services/upload/upload.service';
import { UploadController } from './controllers/upload/upload.controller';

@Module({
  providers: [UploadService],
  controllers: [UploadController]
})
export class UploadModule {}
