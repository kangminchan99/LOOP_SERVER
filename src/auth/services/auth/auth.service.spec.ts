import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../../users/entities/user.entity';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
    verify: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepository = module.get(getRepositoryToken(User));
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should issue new token pair when refresh token is valid', async () => {
    const user = {
      id: 1,
      email: 'test@example.com',
      password: 'hashed',
      nickname: 'tester',
    } as User;

    jwtService.verify.mockReturnValue({ sub: 1, email: 'test@example.com' });
    usersRepository.findOne.mockResolvedValue(user);
    jwtService.sign
      .mockReturnValueOnce('new-access')
      .mockReturnValueOnce('new-refresh');

    const result = await service.refresh({
      refreshToken: 'valid.refresh.token',
    });

    expect(jwtService.verify).toHaveBeenCalledWith('valid.refresh.token');
    expect(usersRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
  });

  it('should throw when refresh token is invalid', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    await expect(
      service.refresh({ refreshToken: 'invalid.refresh.token' }),
    ).rejects.toThrow('유효하지 않은 Refresh Token입니다.');
  });
});
