import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { UploadController } from './controllers/upload/upload.controller';
import { UploadService } from './services/upload/upload.service';

@Module({
  imports: [UsersModule],
  providers: [UploadService],
  controllers: [UploadController],
})
export class UploadModule {}
