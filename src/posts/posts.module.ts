import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { PostsController } from './controllers/posts/posts.controller';
import { Post } from './entities/post.entity';
import { PostsService } from './services/posts/posts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Post]), NotificationsModule],
  providers: [PostsService],
  controllers: [PostsController],
})
export class PostsModule {}
