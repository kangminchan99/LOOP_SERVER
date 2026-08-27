import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from '../comments/entities/comment.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Post } from '../posts/entities/post.entity';
import { UploadModule } from '../upload/upload.module';
import { User } from '../users/entities/user.entity';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminPostsController } from './controllers/admin-posts.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminPostsService } from './services/admin-posts.service';
import { AdminUsersService } from './services/admin-users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Post, Comment, Notification]),
    UploadModule,
  ],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminPostsController,
  ],
  providers: [AdminDashboardService, AdminUsersService, AdminPostsService],
})
export class AdminModule {}
