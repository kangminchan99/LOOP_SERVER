import { Test } from '@nestjs/testing';
import { PostsService } from '../../services/posts/posts.service';
import { PostsController } from './posts.controller';

describe('PostsController', () => {
  let controller: PostsController;
  const service = { findListItems: jest.fn() };
  beforeEach(async () => {
    service.findListItems.mockReset();
    const module = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [{ provide: PostsService, useValue: service }],
    }).compile();
    controller = module.get(PostsController);
  });
  it('조회 조건과 서비스 응답을 전달한다', async () => {
    const result = { items: [], hasNext: false, nextCursor: null };
    service.findListItems.mockResolvedValue(result);
    await expect(controller.findList({ limit: 20 })).resolves.toEqual(result);
    expect(service.findListItems).toHaveBeenCalledWith({ limit: 20 });
  });
  it('서비스 실패를 성공 응답으로 바꾸지 않는다', async () => {
    service.findListItems.mockRejectedValue(new Error('service unavailable'));
    await expect(controller.findList({ limit: 20 })).rejects.toThrow(
      'service unavailable',
    );
  });
});
