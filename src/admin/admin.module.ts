import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from '../comments/entities/comment.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Post } from '../posts/entities/post.entity';
import { UploadModule } from '../upload/upload.module';
import { User } from '../users/entities/user.entity';
import { AdminCommentsController } from './controllers/admin-comments.controller';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminPostsController } from './controllers/admin-posts.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { DailyServiceStat } from './entities/daily-service-stat.entity';
import { AdminCommentsService } from './services/admin-comments.service';
import { AdminDailyStatsService } from './services/admin-daily-stats.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminPostsService } from './services/admin-posts.service';
import { AdminUsersService } from './services/admin-users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Post,
      Comment,
      Notification,
      DailyServiceStat,
    ]),
    UploadModule,
  ],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminPostsController,
    AdminCommentsController,
  ],
  providers: [
    AdminDashboardService,
    AdminUsersService,
    AdminPostsService,
    AdminCommentsService,
    AdminDailyStatsService,
  ],
})
export class AdminModule {}
