import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';
import { UserBlocksController } from './controllers/user-blocks.controller';
import { UserBlock } from './entities/user-block.entity';
import { UserBlocksRepository } from './repositories/user-blocks-repository';
import { UserBlocksService } from './services/user-blocks.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([UserBlock, User])],
  controllers: [UserBlocksController],
  providers: [UserBlocksService, UserBlocksRepository],
  exports: [UserBlocksService],
})
export class UserBlocksModule {}
