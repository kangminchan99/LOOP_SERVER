import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../posts/entities/post.entity';
import { CommentsController } from './controllers/comments/comments.controller';
import { Comment } from './entities/comment.entity';
import { CommentsService } from './services/comments/comments.service';
import { MyCommentsController } from './controllers/comments/my-comments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Post])],
  providers: [CommentsService],
  controllers: [CommentsController, MyCommentsController],
})
export class CommentsModule {}
