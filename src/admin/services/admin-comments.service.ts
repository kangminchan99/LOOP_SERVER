import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Comment } from '../../comments/entities/comment.entity';
import { AdminCommentListItemDto } from '../dto/admin-comment-list-item.dto';
import { GetAdminCommentsQueryDto } from '../dto/get-admin-comments-query.dto';

@Injectable()
export class AdminCommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
  ) {}

  async findList(query: GetAdminCommentsQueryDto): Promise<{
    items: AdminCommentListItemDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const queryBuilder = this.commentsRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .leftJoinAndSelect('comment.post', 'post')
      .orderBy('comment.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('comment.content ILIKE :search', {
            search: `%${search}%`,
          })
            .orWhere('author.nickname ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('post.title ILIKE :search', {
              search: `%${search}%`,
            });
        }),
      );
    }

    const [comments, total] = await queryBuilder.getManyAndCount();

    return {
      items: comments.map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        postTitle: comment.post?.title ?? null,
        authorId: comment.authorId,
        authorNickname: comment.author?.nickname ?? null,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async remove(commentId: number): Promise<void> {
    // 1. id에 해당하는 댓글 삭제
    const result = await this.commentsRepository.delete(commentId);

    // 2. 삭제된 댓글이 없으면 404처리
    if (result.affected === 0) {
      throw new NotFoundException('댓글을 찾을 수 없습니다.');
    }
  }
}
