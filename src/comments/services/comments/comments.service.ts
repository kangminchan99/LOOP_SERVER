import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../../../posts/entities/post.entity';
import { CommentResponseDto } from '../../dto/comment-response.dto';
import { CreateCommentDto } from '../../dto/create-comment.dto';
import { Comment } from '../../entities/comment.entity';
import { GetCommentsQueryDto } from '../../dto/get-comments-query.dto';
import { CommentListPageDto } from '../../dto/comment-list-page.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,

    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  async create(
    postId: number,
    authorId: number,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const post = await this.postsRepository.findOne({
      where: {
        id: postId,
      },
    });

    if (!post) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    const comment = this.commentsRepository.create({
      postId,
      authorId,
      content: dto.content.trim(),
    });

    const savedComment = await this.commentsRepository.save(comment);

    const commentWithAuthor = await this.commentsRepository.findOne({
      where: {
        id: savedComment.id,
      },
      relations: {
        author: true,
      },
    });

    return CommentResponseDto.fromEntity(commentWithAuthor!);
  }

  async findByPostId(
    postId: number,
    query: GetCommentsQueryDto,
  ): Promise<CommentListPageDto> {
    const { cursor, limit = 20 } = query;

    const qb = this.commentsRepository
      .createQueryBuilder('comment')
      .innerJoinAndSelect('comment.author', 'author')
      .where('comment.postId = :postId', { postId })
      .orderBy('comment.createdAt', 'ASC')
      .addOrderBy('comment.id', 'ASC')
      .take(limit + 1);

    if (cursor) {
      const [cursorCreatedAt, cursorCommentId] = cursor.split('_');

      qb.andWhere(
        '(comment.createdAt > :cursorCreatedAt OR (comment.createdAt = :cursorCreatedAt AND comment.id > :cursorCommentId))',
        {
          cursorCreatedAt: new Date(cursorCreatedAt),
          cursorCommentId: Number(cursorCommentId),
        },
      );
    }

    const comments = await qb.getMany();

    const hasNext = comments.length > limit;
    const pageComments = hasNext ? comments.slice(0, limit) : comments;

    const items = pageComments.map((comment) =>
      CommentResponseDto.fromEntity(comment),
    );

    const lastItem = items[items.length - 1];

    const nextCursor =
      hasNext && lastItem
        ? `${lastItem.createdAt.toISOString()}_${lastItem.id}`
        : null;

    return {
      items,
      nextCursor,
      hasNext,
    };
  }

  async remove(
    postId: number,
    commentId: number,
    userId: number,
  ): Promise<CommentResponseDto> {
    const comment = await this.commentsRepository.findOne({
      where: {
        id: commentId,
        postId,
      },
      relations: {
        author: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('댓글을 찾을 수 없습니다.');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('본인의 댓글만 삭제할 수 있습니다.');
    }

    await this.commentsRepository.delete(comment.id);

    return CommentResponseDto.fromEntity(comment);
  }
}
