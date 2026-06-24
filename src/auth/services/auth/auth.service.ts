import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UploadService } from '../../../upload/services/upload/upload.service';
import { UserResponseDto } from '../../../users/dto/user-response.dto';
import { User } from '../../../users/entities/user.entity';
import { AuthTokenResponseDto } from '../../dto/auth-token-response.dto';
import { LoginDto } from '../../dto/login.dto';
import { RefreshTokenDto } from '../../dto/refresh-token.dto';
import { RegisterDto } from '../../dto/register.dto';
import {
  SocialAccount,
  SocialProvider,
} from '../../entities/social-account.entity';
import { KakaoAuthService } from '../kakao/kakao-auth.service';
import { KakaoLoginDto } from '../../dto/kakao-login.dto';

@Injectable() // Nest DI 컨테이너에 서비스로 등록
export class AuthService {
  constructor(
    @InjectRepository(User) // users 테이블 접근용 Repository 주입
    private readonly usersRepository: Repository<User>,
    @InjectRepository(SocialAccount) // social_accounts 테이블 접근용 Repository 주입
    private readonly socialAccountsRepository: Repository<SocialAccount>,
    private readonly jwtService: JwtService, // JWT 발급용 서비스 주입
    private readonly configService: ConfigService,
    private readonly uploadService: UploadService,
    private readonly kakaoAuthService: KakaoAuthService,
  ) {}

  // 회원가입
  async register(dto: RegisterDto): Promise<AuthTokenResponseDto> {
    const { email, password, nickname } = dto;

    // 1) 이메일 중복 체크
    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('이미 존재하는 이메일입니다.');
    }

    // 2) 비밀번호 해시 (원문 저장 금지)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3) 유저 생성 후 DB 저장
    const user = this.usersRepository.create({
      email,
      password: hashedPassword,
      nickname,
    });
    const savedUser = await this.usersRepository.save(user);

    // 4) Access / Refresh 토큰 발급
    const { accessToken, refreshToken } = this.issueTokens(savedUser);

    // 5) 응답에는 비밀번호 제외
    return {
      user: await this.toUserResponseDto(savedUser),
      accessToken,
      refreshToken,
    };
  }

  // 로그인
  async login(dto: LoginDto): Promise<AuthTokenResponseDto> {
    const { email, password } = dto;

    // 1) 이메일로 유저 조회
    const user = await this.usersRepository.findOne({
      where: { email },
    });
    if (!user || !user.password) {
      throw new BadRequestException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // 2) 비밀번호 검증 (입력값 vs 저장된 해시)
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // 3) 토큰 발급
    const { accessToken, refreshToken } = this.issueTokens(user);

    // 4) 응답 반환 (비밀번호 제외)
    return {
      user: await this.toUserResponseDto(user),
      accessToken,
      refreshToken,
    };
  }

  async kakaoLogin(dto: KakaoLoginDto): Promise<AuthTokenResponseDto> {
    // 1. 카카오 토큰 검증 및 프로필 조회
    const profile = await this.kakaoAuthService.authenticate(
      dto.kakaoAccessToken,
    );

    // 2. 기존 카카오 계정 조회
    const existingSocialAccount = await this.socialAccountsRepository.findOne({
      where: {
        provider: SocialProvider.KAKAO,
        providerUserId: profile.id,
      },
      relations: {
        user: true,
      },
    });

    // 3. 이미 가입한 카카오 사용자라면 바로 로그인
    if (existingSocialAccount) {
      const { accessToken, refreshToken } = this.issueTokens(
        existingSocialAccount.user,
      );

      return {
        user: await this.toUserResponseDto(existingSocialAccount.user),
        accessToken,
        refreshToken,
      };
    }

    // 4. 동일 이메일의 기존 계정이 있는지 확인
    if (profile.email) {
      const existingEmailUser = await this.usersRepository.findOne({
        where: { email: profile.email },
      });

      if (existingEmailUser) {
        throw new ConflictException(
          '같은 이메일로 가입된 계정이 있습니다. 기존 계정에 로그인한 뒤 카카오 계정을 연결해 주세요.',
        );
      }
    }

    // 5. User와 SocialAccount를 하나의 트랜잭션으로 생성
    const savedUser = await this.usersRepository.manager.transaction(
      async (manager) => {
        const usersRepository = manager.getRepository(User);
        const socialAccountsRepository = manager.getRepository(SocialAccount);

        const user = usersRepository.create({
          email: profile.email,
          password: null,
          nickname: profile.nickname ?? '카카오 사용자',
          profileImageUrl: profile.profileImageUrl,
        });

        const newUser = await usersRepository.save(user);

        const socialAccount = socialAccountsRepository.create({
          userId: newUser.id,
          provider: SocialProvider.KAKAO,
          providerUserId: profile.id,
        });

        await socialAccountsRepository.save(socialAccount);

        return newUser;
      },
    );

    // 6. Loop JWT 발급
    const { accessToken, refreshToken } = this.issueTokens(savedUser);

    return {
      user: await this.toUserResponseDto(savedUser),
      accessToken,
      refreshToken,
    };
  }

  // 리프레시 토큰을 검증하고 새 토큰 쌍을 재발급
  async refresh(dto: RefreshTokenDto): Promise<AuthTokenResponseDto> {
    const { refreshToken } = dto;

    // 1) 전달받은 Refresh Token의 서명/만료를 검증
    let payload: { sub: number; type: string };
    try {
      payload = this.jwtService.verify<{
        sub: number;
        type: 'refresh';
      }>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Refresh Token이 아닙니다.');
      }
    } catch {
      throw new UnauthorizedException('유효하지 않은 Refresh Token입니다.');
    }

    // 2) 토큰의 사용자 정보로 실제 유저를 다시 조회
    const user = await this.usersRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('유저를 찾을 수 없습니다.');
    }

    // 3) 새 Access/Refresh Token 재발급
    const { accessToken, refreshToken: newRefreshToken } =
      this.issueTokens(user);

    // 4) 최신 유저 정보 + 신규 토큰 반환
    return {
      user: await this.toUserResponseDto(user),
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  // 로그인에 성공한 사용자에게 우리 서비스의 인증 토큰 2개를 발급
  private issueTokens(user: User): {
    accessToken: string;
    refreshToken: string;
  } {
    const commonPayload = { sub: user.id };

    const accessToken = this.jwtService.sign(
      {
        ...commonPayload,
        type: 'access',
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn:
          this.configService.getOrThrow<JwtSignOptions['expiresIn']>(
            'JWT_EXPIRES_IN',
          ),
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        ...commonPayload,
        type: 'refresh',
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow<JwtSignOptions['expiresIn']>(
          'JWT_REFRESH_EXPIRES_IN',
        ),
      },
    );

    return { accessToken, refreshToken };
  }

  private async toUserResponseDto(user: User): Promise<UserResponseDto> {
    const dto = UserResponseDto.fromEntity(user);
    // 로그인/토큰 재발급 응답에서도 profileImageUrl은 Presigned URL로 맞춘다.
    dto.profileImageUrl = await this.uploadService.toSignedProfileImageUrl(
      dto.profileImageUrl,
    );
    return dto;
  }
}
