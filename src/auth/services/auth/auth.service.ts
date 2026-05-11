import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UserResponseDto } from '../../../users/dto/user-response.dto';
import { User } from '../../../users/entities/user.entity';
import { AuthTokenResponseDto } from '../../dto/auth-token-response.dto';
import { LoginDto } from '../../dto/login.dto';
import { RegisterDto } from '../../dto/register.dto';

@Injectable() // Nest DI 컨테이너에 서비스로 등록
export class AuthService {
  constructor(
    @InjectRepository(User) // users 테이블 접근용 Repository 주입
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService, // JWT 발급용 서비스 주입
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
    const payload = { sub: savedUser.id, email: savedUser.email };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // 5) 응답에는 비밀번호 제외
    return {
      user: UserResponseDto.fromEntity(savedUser),
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
    if (!user) {
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
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // 4) 응답 반환 (비밀번호 제외)
    return {
      user: UserResponseDto.fromEntity(user),
      accessToken,
      refreshToken,
    };
  }
}
