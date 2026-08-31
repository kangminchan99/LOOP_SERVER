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
import { AdminCommentListPageDto } from '../dto/admin-comment-list-page.dto';
import { GetAdminCommentsQueryDto } from '../dto/get-admin-comments-query.dto';
import { AdminCommentsService } from '../services/admin-comments.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/comments')
export class AdminCommentsController {
  constructor(private readonly adminCommentsService: AdminCommentsService) {}

  @ApiOperation({ summary: '관리자 댓글 목록 조회' })
  @ApiOkResponse({
    description: '관리자 댓글 목록 조회 성공',
    type: AdminCommentListPageDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiForbiddenResponse({
    description: '관리자 권한이 필요합니다.',
  })
  @Get()
  findList(
    @Query() query: GetAdminCommentsQueryDto,
  ): Promise<AdminCommentListPageDto> {
    return this.adminCommentsService.findList(query);
  }
}
