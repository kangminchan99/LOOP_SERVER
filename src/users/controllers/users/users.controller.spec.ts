import { Test } from '@nestjs/testing';
import { UploadService } from '../../../upload/services/upload/upload.service';
import { User } from '../../entities/user.entity';
import { UsersService } from '../../services/users/users.service';
import { UsersController } from './users.controller';

describe('UsersController', () => {
  let controller: UsersController;
  const users = { findOne: jest.fn() };
  const upload = { toSignedProfileImageUrl: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: users },
        { provide: UploadService, useValue: upload },
      ],
    }).compile();
    controller = module.get(UsersController);
  });
  it('내 정보에는 비밀번호를 제외하고 서명된 프로필 URL을 반환한다', async () => {
    users.findOne.mockResolvedValue(
      Object.assign(new User(), {
        id: 1,
        nickname: 'tester',
        password: 'secret',
        profileImageUrl: 'profiles/test.webp',
      }),
    );
    upload.toSignedProfileImageUrl.mockResolvedValue(
      'https://example.com/signed',
    );
    const result = await controller.getMe(1);
    expect(users.findOne).toHaveBeenCalledWith(1);
    expect(upload.toSignedProfileImageUrl).toHaveBeenCalledWith(
      'profiles/test.webp',
    );
    expect(result.profileImageUrl).toBe('https://example.com/signed');
    expect(result).not.toHaveProperty('password');
  });
});
