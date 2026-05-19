import { Body, Controller, Post as HttpPost, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CreatePostDto } from '../../dto/create-dto';
import { PostsService } from '../../services/posts/posts.service';
import { PostResponseDto } from '../../dto/post-response.dto';

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
}
