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

  @ApiOperation({ summary: '관리자 댓글 삭제' })
  @ApiNoContentResponse({ description: '댓글 삭제 성공' })
  @ApiBadRequestResponse({ description: '잘못된 댓글 ID입니다.' })
  @ApiUnauthorizedResponse({ description: '인증이 필요합니다.' })
  @ApiForbiddenResponse({ description: '관리자 권한이 필요합니다.' })
  @ApiNotFoundResponse({ description: '댓글을 찾을 수 없습니다.' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    // 1. 양의 안전한 정수인지 검사
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException('잘못된 댓글 id입니다');
    }

    // 서비스에 삭제 요청
    await this.adminCommentsService.remove(id);
  }
}
