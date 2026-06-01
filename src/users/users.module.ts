import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadModule } from '../upload/upload.module';
import { UsersController } from './controllers/users/users.controller';
import { User } from './entities/user.entity';
import { UsersService } from './services/users/users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), UploadModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
