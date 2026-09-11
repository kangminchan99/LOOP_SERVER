import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminPostListPageDto } from '../dto/admin-post-list-page.dto';
import { GetAdminPostsQueryDto } from '../dto/get-admin-posts-query.dto';
import { AdminPostsService } from '../services/admin-posts.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/posts')
export class AdminPostsController {
  constructor(private readonly adminPostsService: AdminPostsService) {}

  @ApiOperation({ summary: '관리자 게시글 목록 조회' })
  @ApiOkResponse({
    description: '관리자 게시글 목록 조회 성공',
    type: AdminPostListPageDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiForbiddenResponse({
    description: '관리자 권한이 필요합니다.',
  })
  @Get()
  findList(
    @Query() query: GetAdminPostsQueryDto,
  ): Promise<AdminPostListPageDto> {
    return this.adminPostsService.findList(query);
  }

  @ApiOperation({ summary: '관리자 게시글 삭제' })
  @ApiNoContentResponse({ description: '게시글 삭제 성공' })
  @ApiBadRequestResponse({ description: '잘못된 게시글 ID입니다.' })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  @ApiForbiddenResponse({ description: '관리자 권한이 필요합니다.' })
  @ApiNotFoundResponse({ description: '게시글을 찾을 수 없습니다.' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    // 1. 양의 안전한 정수인지 검사
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException('잘못된 게시글 ID입니다.');
    }

    // 2. 삭제 및 목록 캐시 무효화
    await this.adminPostsService.remove(id);
  }
}
