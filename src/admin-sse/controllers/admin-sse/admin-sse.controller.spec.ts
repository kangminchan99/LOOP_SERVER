import { Test, TestingModule } from '@nestjs/testing';
import { AdminSseController } from './admin-sse.controller';

describe('AdminSseController', () => {
  let controller: AdminSseController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminSseController],
    }).compile();

    controller = module.get<AdminSseController>(AdminSseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
