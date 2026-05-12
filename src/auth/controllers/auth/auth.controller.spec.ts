import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../services/auth/auth.service';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refresh: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call refresh service and return tokens', async () => {
    const dto = { refreshToken: 'valid.refresh.token' };
    const mocked = {
      user: { id: 1, email: 'test@example.com', nickname: 'tester' },
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    };

    authService.refresh.mockResolvedValue(mocked);

    const result = await controller.refresh(dto);

    expect(authService.refresh).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mocked);
  });
});
