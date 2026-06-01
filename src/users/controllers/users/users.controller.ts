import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UploadService } from '../../../upload/services/upload/upload.service';
import { CreateUserDto } from '../../dto/create-user.dto';
import { UserResponseDto } from '../../dto/user-response.dto';
import { User } from '../../entities/user.entity';
import { UsersService } from '../../services/users/users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly uploadService: UploadService,
  ) {}

  @ApiOperation({ summary: '유저 목록 조회' })
  @ApiOkResponse({
    description: '유저 목록 조회 성공',
    type: UserResponseDto,
    isArray: true,
  })
  @ApiBadRequestResponse({ description: '잘못된 요청' })
  @Get()
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.usersService.findAll();
    return Promise.all(users.map((user) => this.toUserResponseDto(user)));
  }

  @ApiOperation({ summary: '현재 로그인한 사용자 정보 조회' })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: '사용자 정보 조회 성공',
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiNotFoundResponse({ description: '사용자를 찾을 수 없습니다.' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() userId: number): Promise<UserResponseDto> {
    const user = await this.usersService.findOne(userId);
    return this.toUserResponseDto(user);
  }

  @ApiOperation({ summary: '유저 단건 조회' })
  @ApiParam({ name: 'id', type: Number, description: '유저 ID' })
  @ApiOkResponse({ description: '유저 조회 성공', type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'id 파라미터 형식 오류' })
  @ApiNotFoundResponse({ description: '유저를 찾을 수 없습니다.' })
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.findOne(id);
    return this.toUserResponseDto(user);
  }

  @ApiOperation({ summary: '유저 생성' })
  @ApiBody({ type: CreateUserDto })
  @ApiCreatedResponse({ description: '유저 생성 성공', type: UserResponseDto })
  @ApiBadRequestResponse({ description: '요청 바디 검증 실패' })
  @ApiConflictResponse({ description: '이미 존재하는 이메일입니다.' })
  @Post()
  async create(@Body() body: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.create(
      body.email,
      body.password,
      body.nickname,
    );
    return this.toUserResponseDto(user);
  }

  @ApiOperation({ summary: '유저 삭제' })
  @ApiParam({ name: 'id', type: Number, description: '유저 ID' })
  @ApiNoContentResponse({ description: '유저 삭제 성공' })
  @ApiBadRequestResponse({ description: 'id 파라미터 형식 오류' })
  @ApiNotFoundResponse({ description: '유저를 찾을 수 없습니다.' })
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.usersService.remove(id);
  }

  private async toUserResponseDto(user: User): Promise<UserResponseDto> {
    const dto = UserResponseDto.fromEntity(user);
    // DB에 저장된 profileImageUrl 값(key)을 응답 직전에 Presigned URL로 변환한다.
    dto.profileImageUrl = await this.uploadService.toSignedProfileImageUrl(
      dto.profileImageUrl,
    );
    return dto;
  }
}
