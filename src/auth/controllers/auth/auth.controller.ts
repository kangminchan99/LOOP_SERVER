import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTokenResponseDto } from '../../dto/auth-token-response.dto';
import { KakaoLoginDto } from '../../dto/kakao-login.dto';
import { LoginDto } from '../../dto/login.dto';
import { RefreshTokenDto } from '../../dto/refresh-token.dto';
import { RegisterDto } from '../../dto/register.dto';
import { AuthService } from '../../services/auth/auth.service';
import { GoogleLoginDto } from '../../dto/google-login.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('auth') // Swagger에서 auth 그룹으로 표시
@Controller('auth') // 기본 경로: /auth
export class AuthController {
  // 실제 인증 로직은 AuthService에 위임
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: '회원가입' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: '회원가입 성공',
    type: AuthTokenResponseDto,
  }) // 201
  @ApiBadRequestResponse({ description: '요청 값 검증 실패' }) // 400
  @ApiConflictResponse({ description: '이미 존재하는 이메일' }) // 409
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('register') // POST /auth/register
  register(@Body() dto: RegisterDto): Promise<AuthTokenResponseDto> {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: '로그인' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: '로그인 성공', type: AuthTokenResponseDto }) // 200
  @ApiBadRequestResponse({
    description: '이메일 또는 비밀번호가 올바르지 않음',
  }) // 400
  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // 60초에 5번 요청 제한
  @Post('login') // POST /auth/login
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthTokenResponseDto> {
    return this.authService.login(dto);
  }

  @ApiOperation({ summary: '카카오 로그인' })
  @ApiBody({ type: KakaoLoginDto })
  @ApiOkResponse({
    description: '카카오 로그인 성공',
    type: AuthTokenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '유효하지 않은 카카오 토큰',
  })
  @ApiConflictResponse({
    description: '동일 이메일로 가입된 기존 계정 존재',
  })
  @ApiServiceUnavailableResponse({
    description: '카카오 인증 서버 연결 실패',
  })
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('kakao')
  @HttpCode(HttpStatus.OK)
  kakaoLogin(@Body() dto: KakaoLoginDto): Promise<AuthTokenResponseDto> {
    return this.authService.kakaoLogin(dto);
  }

  @ApiOperation({ summary: '토큰 리프레쉬' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: '토큰 리프레쉬 성공',
    type: AuthTokenResponseDto,
  }) // 200
  @ApiBadRequestResponse({ description: '요청 값 검증 실패' }) // 400
  @ApiUnauthorizedResponse({ description: '유효하지 않은 Refresh Token' }) // 401
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('refresh') // POST /auth/refresh
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokenResponseDto> {
    return this.authService.refresh(dto);
  }

  @ApiOperation({ summary: '구글 로그인' })
  @ApiBody({ type: GoogleLoginDto })
  @ApiOkResponse({
    description: '구글 로그인 성공',
    type: AuthTokenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '유효하지 않은 구글 토큰',
  })
  @ApiConflictResponse({
    description: '동일 이메일로 가입된 기존 계정 존재',
  })
  @ApiServiceUnavailableResponse({
    description: '구글 인증 서버 연결 실패',
  })
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('google')
  @HttpCode(HttpStatus.OK)
  googleLogin(@Body() dto: GoogleLoginDto): Promise<AuthTokenResponseDto> {
    return this.authService.googleLogin(dto);
  }
}
