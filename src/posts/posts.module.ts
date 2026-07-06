import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsController } from './controllers/posts/posts.controller';
import { Post } from './entities/post.entity';
import { PostsService } from './services/posts/posts.service';
import { NotificationQueueModule } from '../queues/notification-queue/notification-queue.module';

@Module({
  imports: [TypeOrmModule.forFeature([Post]), NotificationQueueModule],
  providers: [PostsService],
  controllers: [PostsController],
})
export class PostsModule {}
