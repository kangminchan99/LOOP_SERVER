import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PostResponseDto } from '../../dto/post-response.dto';
import { Post } from '../../entities/post.entity';
import { PostsService } from '../../services/posts/posts.service';
import { PostsController } from './posts.controller';

// 인증・HTTP 검증은 통합 테스트에서, 여기서는 Service 호출 인자와 오류 전달을 검증한다.
describe('PostsController', () => {
  let controller: PostsController;
  const service = {
    findListItems: jest.fn(),
    searchListItems: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [{ provide: PostsService, useValue: service }],
    }).compile();
    controller = module.get(PostsController);
  });

  it.each([undefined, 42])(
    '목록 조회 조건과 조회자 ID %s를 Service에 전달한다',
    async (viewerId) => {
      const query = { limit: 20 };
      const result = { items: [], hasNext: false, nextCursor: null };
      service.findListItems.mockResolvedValue(result);

      await expect(controller.findList(query, viewerId)).resolves.toEqual(
        result,
      );
      expect(service.findListItems).toHaveBeenCalledWith(query, viewerId);
    },
  );

  it.each([undefined, 42])(
    '검색 조건과 조회자 ID %s를 Service에 전달한다',
    async (viewerId) => {
      const query = { keyword: '테스트', limit: 20 };
      const result = { items: [], hasNext: false, nextCursor: null };
      service.searchListItems.mockResolvedValue(result);

      await expect(controller.searchList(query, viewerId)).resolves.toEqual(
        result,
      );
      expect(service.searchListItems).toHaveBeenCalledWith(query, viewerId);
    },
  );

  it.each([undefined, 42])(
    '상세 조회에 조회자 ID %s를 전달하고 응답 DTO로 변환한다',
    async (viewerId) => {
      const post = Object.assign(new Post(), {
        id: 10,
        authorId: 2,
        title: '게시글',
        content: '본문',
        summary: null,
        summaryStatus: 'SKIPPED',
        summaryError: null,
        summaryGeneratedAt: null,
        createdAt: new Date('2026-10-27T03:00:00.000Z'),
        updatedAt: new Date('2026-10-27T03:00:00.000Z'),
      });
      service.findOne.mockResolvedValue(post);

      await expect(controller.findOne(10, viewerId)).resolves.toEqual(
        PostResponseDto.fromEntity(post),
      );
      expect(service.findOne).toHaveBeenCalledWith(10, viewerId);
    },
  );

  it('목록 조회 실패를 성공 응답으로 바꾸지 않는다', async () => {
    service.findListItems.mockRejectedValue(new Error('service unavailable'));
    await expect(controller.findList({ limit: 20 }, 42)).rejects.toThrow(
      'service unavailable',
    );
  });

  it('상세 조회의 404를 빈 상세 응답으로 바꾸지 않는다', async () => {
    service.findOne.mockRejectedValue(
      new NotFoundException('게시글을 찾을 수 없습니다.'),
    );
    await expect(controller.findOne(10, 42)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
