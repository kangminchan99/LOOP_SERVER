import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '../../../posts/entities/post.entity';
import { Comment } from '../../entities/comment.entity';
import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  let service: CommentsService;
  const comments = {
    findOne: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const posts = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: comments },
        { provide: getRepositoryToken(Post), useValue: posts },
      ],
    }).compile();
    service = module.get(CommentsService);
  });

  it('없는 게시글에 댓글을 저장하지 않는다', async () => {
    posts.findOne.mockResolvedValue(null);
    await expect(service.create(10, 1, { content: '댓글' })).rejects.toThrow(
      '게시글을 찾을 수 없습니다.',
    );
    expect(comments.save).not.toHaveBeenCalled();
  });

  it('다른 작성자의 댓글을 삭제할 수 없다', async () => {
    comments.findOne.mockResolvedValue(
      Object.assign(new Comment(), { id: 2, postId: 10, authorId: 3 }),
    );
    await expect(service.remove(10, 2, 1)).rejects.toThrow(
      '본인의 댓글만 삭제할 수 있습니다.',
    );
    expect(comments.delete).not.toHaveBeenCalled();
  });

  it('해당 게시글의 본인 댓글을 삭제한다', async () => {
    comments.findOne.mockResolvedValue(
      Object.assign(new Comment(), {
        id: 2,
        postId: 10,
        authorId: 1,
        content: '댓글',
      }),
    );
    const result = await service.remove(10, 2, 1);
    expect(comments.findOne).toHaveBeenCalledWith({
      where: { id: 2, postId: 10 },
      relations: { author: true },
    });
    expect(comments.delete).toHaveBeenCalledWith(2);
    expect(result).toMatchObject({ id: 2, postId: 10, authorId: 1 });
  });
});
