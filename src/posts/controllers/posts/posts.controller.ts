import {
  Body,
  Controller,
  Delete,
  Get,
  Post as HttpPost,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CreatePostDto } from '../../dto/create-dto';
import { GetPostsQueryDto } from '../../dto/get-posts-query.dto';
import { PostListPageDto } from '../../dto/post-list-page.dto';
import { PostResponseDto } from '../../dto/post-response.dto';
import { UpdatePostDto } from '../../dto/update-dto';
import { PostsService } from '../../services/posts/posts.service';

@ApiTags('posts') // Swagger 그룹 이름
@Controller('posts') // 기본 경로: /posts
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @ApiOperation({ summary: '게시글 작성' }) // 기능 설명
  @ApiBearerAuth() // Bearer 토큰 필요 표시
  @ApiBody({ type: CreatePostDto }) // 요청 바디 스키마
  @ApiCreatedResponse({
    description: '게시글 작성 성공',
    type: PostResponseDto, // 우선 엔티티를 응답 타입으로 사용
  })
  @ApiUnauthorizedResponse({
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiBadRequestResponse({
    description: '요청 바디 검증 실패',
  })
  @UseGuards(JwtAuthGuard) // 인증된 사용자만 접근 가능
  @HttpPost() // POST /posts
  async create(
    @CurrentUser() userId: number, // 토큰에서 현재 사용자 id 추출
    @Body() dto: CreatePostDto, // title, content 검증 완료된 값
  ): Promise<PostResponseDto> {
    // authorId는 body로 받지 않고 서버에서 userId로 강제
    const post = await this.postsService.create(userId, dto);
    return PostResponseDto.fromEntity(post);
  }

  // 게시글 목록 조회 GET /posts
  @ApiOperation({ summary: '게시글 목록 조회' })
  @ApiOkResponse({
    description: '게시글 목록 조회 성공',
    type: PostListPageDto,
  })
  @Get()
  async findList(@Query() query: GetPostsQueryDto): Promise<PostListPageDto> {
    return this.postsService.findListItems(query);
  }

  // 게시글 상세 조회 GET /posts/:id
  @ApiOperation({ summary: '게시글 상세 조회' })
  @ApiOkResponse({
    description: '게시글 상세 조회 성공',
    type: PostResponseDto,
  })
  @ApiNotFoundResponse({ description: '게시글을 찾을 수 없습니다.' })
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PostResponseDto> {
    const post = await this.postsService.findOne(id);
    return PostResponseDto.fromEntity(post);
  }

  // 게시글 삭제 DELETE /posts/:id
  @ApiOperation({ summary: '게시글 삭제' })
  @ApiBearerAuth()
  @ApiOkResponse({ description: '게시글 삭제 성공', type: PostResponseDto })
  @ApiNotFoundResponse({ description: '게시글을 찾을 수 없습니다.' })
  @ApiForbiddenResponse({ description: '본인의 게시글만 삭제할 수 있습니다.' })
  @UseGuards(JwtAuthGuard) // 인증된 사용자만 접근 가능
  @Delete(':id')
  async remove(
    @CurrentUser() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PostResponseDto> {
    const post = await this.postsService.remove(userId, id);
    return PostResponseDto.fromEntity(post);
  }

  // 게시글 수정 PATCH /posts/:id
  @ApiOperation({ summary: '게시글 수정' })
  @ApiBearerAuth()
  @ApiBody({ type: UpdatePostDto })
  @ApiOkResponse({ description: '게시글 수정 성공', type: PostResponseDto })
  @ApiBadRequestResponse({
    description: '요청 바디 검증 실패',
  })
  @ApiUnauthorizedResponse({
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiNotFoundResponse({ description: '게시글을 찾을 수 없습니다.' })
  @ApiForbiddenResponse({ description: '본인의 게시글만 수정할 수 있습니다.' })
  @UseGuards(JwtAuthGuard) // 인증된 사용자만 접근 가능
  @Patch(':id')
  async update(
    @CurrentUser() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    const post = await this.postsService.update(userId, id, dto);
    return PostResponseDto.fromEntity(post);
  }
}
