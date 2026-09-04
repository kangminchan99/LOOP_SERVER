import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { Comment } from '../../comments/entities/comment.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { Post } from '../../posts/entities/post.entity';
import { User } from '../../users/entities/user.entity';
import { AdminDashboardResponseDto } from '../dto/admin-dashboard-response.dto';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,

    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,

    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
  ) {}

  async getDashboard(): Promise<AdminDashboardResponseDto> {
    const todayStart = this.getTodayStart();

    const [
      totalUsers,
      totalPosts,
      totalComments,
      totalNotifications,
      unreadNotifications,
      todayUsers,
      todayPosts,
      todayComments,
      // Promise.all: DB 조회를 하나씩 순서대로 기다리지 않고, 동시에 요청
    ] = await Promise.all([
      this.usersRepository.count(),
      this.postsRepository.count(),
      this.commentsRepository.count(),
      this.notificationsRepository.count(),

      this.notificationsRepository.count({
        where: {
          readAt: IsNull(),
        },
      }),

      this.usersRepository.count({
        where: {
          createdAt: MoreThanOrEqual(todayStart),
        },
      }),

      this.postsRepository.count({
        where: {
          createdAt: MoreThanOrEqual(todayStart),
        },
      }),

      this.commentsRepository.count({
        where: {
          createdAt: MoreThanOrEqual(todayStart),
        },
      }),
    ]);

    const dailyGrowth = await this.getDailyGrowth();

    return {
      totalUsers,
      totalPosts,
      totalComments,
      totalNotifications,
      unreadNotifications,
      todayUsers,
      todayPosts,
      todayComments,
      dailyGrowth,
      generatedAt: new Date().toISOString(),
    };
  }

  private getTodayStart(): Date {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return todayStart;
  }

  private async getDailyGrowth(): Promise<
    {
      date: string;
      newUsers: number;
      newPosts: number;
      newComments: number;
    }[]
  > {
    const [userRows, postRows, commentRows] = await Promise.all([
      this.getDailyCountRows(this.usersRepository),
      this.getDailyCountRows(this.postsRepository),
      this.getDailyCountRows(this.commentsRepository),
    ]);

    const allDates = new Set<string>();

    userRows.forEach((row) => allDates.add(row.date));
    postRows.forEach((row) => allDates.add(row.date));
    commentRows.forEach((row) => allDates.add(row.date));

    const sortedDates = [...allDates].sort();

    return sortedDates.map((date) => {
      const userRow = userRows.find((row) => row.date === date);
      const postRow = postRows.find((row) => row.date === date);
      const commentRow = commentRows.find((row) => row.date === date);

      return {
        date,
        newUsers: Number(userRow?.count ?? 0),
        newPosts: Number(postRow?.count ?? 0),
        newComments: Number(commentRow?.count ?? 0),
      };
    });
  }

  private getDailyCountRows<T extends { createdAt: Date }>(
    repository: Repository<T>,
  ): Promise<{ date: string; count: string }[]> {
    return repository
      .createQueryBuilder('entity')
      .select(`TO_CHAR(entity."createdAt", 'YYYY-MM-DD')`, 'date')
      .addSelect('COUNT(*)', 'count')
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; count: string }>();
  }
}
