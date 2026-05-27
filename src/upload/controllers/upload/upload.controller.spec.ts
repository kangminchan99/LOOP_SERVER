import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../../users/services/users/users.service';
import { UploadService } from '../../services/upload/upload.service';
import { UploadController } from './upload.controller';

describe('UploadController', () => {
  let controller: UploadController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        {
          provide: UploadService,
          useValue: { uploadImage: jest.fn() },
        },
        {
          provide: UsersService,
          useValue: { updateProfileImage: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<UploadController>(UploadController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
