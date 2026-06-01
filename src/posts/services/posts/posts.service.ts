import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import { CreatePostDto } from '../../dto/create-dto';
import { GetPostsQueryDto } from '../../dto/get-posts-query.dto';
import { PostListItemDto } from '../../dto/post-list-item-dto';
import { PostListPageDto } from '../../dto/post-list-page.dto';
import { Post } from '../../entities/post.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  async create(authorId: number, dto: CreatePostDto): Promise<Post> {
    const post = this.postsRepository.create({
      title: dto.title.trim(),
      content: dto.content.trim(),
      authorId,
    });
    return this.postsRepository.save(post);
  }

  // 커서 기반 게시글 목록 조회 (최신순)
  async findListItems(query: GetPostsQueryDto): Promise<PostListPageDto> {
    const { cursor, limit = 20 } = query;

    const qb = this.postsRepository
      .createQueryBuilder('post')
      .innerJoin(User, 'user', 'user.id = post.authorId')
      .select('post.id', 'postId')
      .addSelect('post.title', 'title')
      .addSelect('user.nickname', 'authorNickname')
      .addSelect('post.createdAt', 'createdAt')
      .orderBy('post.id', 'DESC')
      .take(limit + 1);

    if (cursor) {
      qb.where('post.id < :cursor', { cursor });
    }

    const rows = await qb.getRawMany<{
      postId: number | string;
      title: string;
      authorNickname: string;
      createdAt: Date;
    }>();

    const hasNext = rows.length > limit;
    const pageRows = hasNext ? rows.slice(0, limit) : rows;

    const items: PostListItemDto[] = pageRows.map((row) => ({
      postId: Number(row.postId),
      title: row.title,
      authorNickname: row.authorNickname,
      createdAt: row.createdAt,
    }));

    const nextCursor =
      hasNext && items.length > 0 ? items[items.length - 1].postId : null;

    return {
      items,
      nextCursor,
      hasNext,
    };
  }
}
