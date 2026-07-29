import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { NotificationQueueModule } from '../queues/notification-queue/notification-queue.module';
import { PostsController } from './controllers/posts/posts.controller';
import { Post } from './entities/post.entity';
import { PostsService } from './services/posts/posts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post]),
    NotificationQueueModule,
    AiModule,
  ],
  providers: [PostsService],
  controllers: [PostsController],
})
export class PostsModule {}
