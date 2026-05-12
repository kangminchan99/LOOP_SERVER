import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTokenResponseDto } from '../../dto/auth-token-response.dto';
import { LoginDto } from '../../dto/login.dto';
import { RefreshTokenDto } from '../../dto/refresh-token.dto';
import { RegisterDto } from '../../dto/register.dto';
import { AuthService } from '../../services/auth/auth.service';

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
  @Post('login') // POST /auth/login
  login(@Body() dto: LoginDto): Promise<AuthTokenResponseDto> {
    return this.authService.login(dto);
  }

  @ApiOperation({ summary: '토큰 리프레쉬' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: '토큰 리프레쉬 성공',
    type: AuthTokenResponseDto,
  }) // 200
  @ApiBadRequestResponse({ description: '요청 값 검증 실패' }) // 400
  @ApiUnauthorizedResponse({ description: '유효하지 않은 Refresh Token' }) // 401
  @Post('refresh') // POST /auth/refresh
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokenResponseDto> {
    return this.authService.refresh(dto);
  }
}
