import { Test } from '@nestjs/testing';
import { CommentsService } from '../../services/comments/comments.service';
import { CommentsController } from './comments.controller';

describe('CommentsController', () => {
  let controller: CommentsController;
  const service = { findByPostId: jest.fn() };
  beforeEach(async () => {
    service.findByPostId.mockReset();
    const module = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [{ provide: CommentsService, useValue: service }],
    }).compile();
    controller = module.get(CommentsController);
  });
  it('조회 조건과 서비스 응답을 전달한다', async () => {
    const result = { items: [], hasNext: false, nextCursor: null };
    service.findByPostId.mockResolvedValue(result);
    await expect(controller.findByPostId(10, { limit: 20 })).resolves.toEqual(
      result,
    );
    expect(service.findByPostId).toHaveBeenCalledWith(10, { limit: 20 });
  });
  it('서비스 실패를 성공 응답으로 바꾸지 않는다', async () => {
    service.findByPostId.mockRejectedValue(new Error('service unavailable'));
    await expect(controller.findByPostId(10, { limit: 20 })).rejects.toThrow(
      'service unavailable',
    );
  });
});
