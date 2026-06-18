import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('attendances')
@Unique(['userId', 'checkedDate'])
export class Attendance {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column()
  userId!: number;

  @Column({ type: 'date' })
  checkedDate!: string;

  @Column({ default: 1 })
  streakCount!: number;

  @Column({ default: 10 })
  rewardPoint!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
