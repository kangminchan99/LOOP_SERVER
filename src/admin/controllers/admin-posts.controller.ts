import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
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
}
