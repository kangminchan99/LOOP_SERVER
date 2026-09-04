import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Comment } from '../../comments/entities/comment.entity';
import { Post } from '../../posts/entities/post.entity';
import { User } from '../../users/entities/user.entity';
import { DailyServiceStat } from '../entities/daily-service-stat.entity';

type DailyCountRow = {
  date: string;
  count: string;
};

type DailyStatMapItem = {
  date: string;
  newUsers: number;
  newPosts: number;
  newComments: number;
};

@Injectable()
export class AdminDailyStatsService {
  constructor(
    @InjectRepository(DailyServiceStat)
    private readonly dailyServiceStatsRepository: Repository<DailyServiceStat>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,

    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,

    private readonly dataSource: DataSource,
  ) {}

  async rebuildDailyStats(): Promise<DailyServiceStat[]> {
    const [userRows, postRows, commentRows] = await Promise.all([
      this.getDailyCountRows(this.usersRepository),
      this.getDailyCountRows(this.postsRepository),
      this.getDailyCountRows(this.commentsRepository),
    ]);

    const statMap = new Map<string, DailyStatMapItem>();

    this.applyRows(statMap, userRows, 'newUsers');
    this.applyRows(statMap, postRows, 'newPosts');
    this.applyRows(statMap, commentRows, 'newComments');

    const stats = [...statMap.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return this.dataSource.transaction(async (manager) => {
      await manager.clear(DailyServiceStat);

      const entities = stats.map((stat) =>
        manager.create(DailyServiceStat, stat),
      );

      return manager.save(DailyServiceStat, entities);
    });
  }

  private getDailyCountRows<T extends { createdAt: Date }>(
    repository: Repository<T>,
  ): Promise<DailyCountRow[]> {
    return repository
      .createQueryBuilder('entity')
      .select(`TO_CHAR(entity."createdAt", 'YYYY-MM-DD')`, 'date')
      .addSelect('COUNT(*)', 'count')
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany<DailyCountRow>();
  }

  private applyRows(
    statMap: Map<string, DailyStatMapItem>,
    rows: DailyCountRow[],
    field: 'newUsers' | 'newPosts' | 'newComments',
  ): void {
    rows.forEach((row) => {
      const current = statMap.get(row.date) ?? {
        date: row.date,
        newUsers: 0,
        newPosts: 0,
        newComments: 0,
      };

      current[field] = Number(row.count);
      statMap.set(row.date, current);
    });
  }
}
