import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Post } from '../../posts/entities/post.entity';
import { User } from '../../users/entities/user.entity';

@Entity('comments')
@Index(['postId', 'createdAt', 'id'])
export class Comment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  postId!: number;

  @Column()
  authorId!: number;

  @Column({ type: 'varchar', length: 500 })
  content!: string;

  @ManyToOne(() => Post, {
    onDelete: 'CASCADE',
  })
  post!: Post;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  author!: User;

  @CreateDateColumn({ precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt!: Date;
}
