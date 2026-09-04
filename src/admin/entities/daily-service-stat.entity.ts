import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('daily_service_stats')
@Unique(['date'])
export class DailyServiceStat {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'int', default: 0 })
  newUsers!: number;

  @Column({ type: 'int', default: 0 })
  newPosts!: number;

  @Column({ type: 'int', default: 0 })
  newComments!: number;

  @CreateDateColumn({ precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt!: Date;
}
