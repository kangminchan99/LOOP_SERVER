import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum SocialProvider {
  KAKAO = 'kakao',
}

@Entity('social_accounts')
@Unique(['provider', 'providerUserId'])
@Index(['userId', 'provider'], { unique: true })
export class SocialAccount {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  @Column({
    type: 'varchar',
    length: 20,
  })
  provider!: SocialProvider;

  @Column({
    type: 'varchar',
    length: 100,
  })
  providerUserId!: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
