import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { UploadController } from './controllers/upload/upload.controller';
import { UploadService } from './services/upload/upload.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UploadService],
  controllers: [UploadController],
  exports: [UploadService],
})
export class UploadModule {}
