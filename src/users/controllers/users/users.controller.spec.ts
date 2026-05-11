// Nest 테스트 유틸: 테스트용 모듈을 만들 때 사용
import { Test, TestingModule } from '@nestjs/testing';
// 컨트롤러가 의존하는 서비스 타입
import { UsersService } from '../../services/users/users.service';
// 테스트 대상 컨트롤러
import { UsersController } from './users.controller';

// UsersController 테스트 그룹 시작
describe('UsersController', () => {
  // 각 테스트에서 사용할 컨트롤러 인스턴스
  let controller: UsersController;

  // 각 테스트 실행 전에 새로운 테스트 모듈을 구성해 독립성 보장
  beforeEach(async () => {
    // Nest 테스트 모듈 생성
    const module: TestingModule = await Test.createTestingModule({
      // 테스트 대상 컨트롤러 등록
      controllers: [UsersController],
      // 컨트롤러가 필요로 하는 의존성(UsersService)을 mock으로 등록
      providers: [
        {
          // UsersService 토큰에 아래 mock 객체를 바인딩
          provide: UsersService,
          useValue: {
            // 컨트롤러에서 호출할 수 있는 서비스 메서드를 jest mock 함수로 준비
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    // 테스트 모듈에서 컨트롤러 인스턴스를 꺼내서 각 테스트에서 사용
    controller = module.get<UsersController>(UsersController);
  });

  // 기본 스모크 테스트: 컨트롤러가 정상적으로 생성되는지 확인
  it('should be defined', () => {
    // 정의되어 있으면(인스턴스 생성 성공) 테스트 통과
    expect(controller).toBeDefined();
  });
});
