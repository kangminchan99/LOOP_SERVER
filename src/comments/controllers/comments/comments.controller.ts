import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
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
import { CommentListPageDto } from '../../dto/comment-list-page.dto';
import { CommentResponseDto } from '../../dto/comment-response.dto';
import { CreateCommentDto } from '../../dto/create-comment.dto';
import { GetCommentsQueryDto } from '../../dto/get-comments-query.dto';
import { CommentsService } from '../../services/comments/comments.service';

@ApiTags('comments')
@Controller('posts/:postId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @ApiOperation({ summary: '댓글 목록 조회' })
  @ApiOkResponse({
    description: '댓글 목록 조회 성공',
    type: CommentListPageDto,
  })
  @ApiNotFoundResponse({ description: '게시글을 찾을 수 없습니다.' })
  @Get()
  findByPostId(
    @Param('postId', ParseIntPipe) postId: number,
    @Query() query: GetCommentsQueryDto,
  ): Promise<CommentListPageDto> {
    return this.commentsService.findByPostId(postId, query);
  }

  @ApiOperation({ summary: '댓글 작성' })
  @ApiBearerAuth()
  @ApiBody({ type: CreateCommentDto })
  @ApiCreatedResponse({
    description: '댓글 작성 성공',
    type: CommentResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiNotFoundResponse({ description: '게시글을 찾을 수 없습니다.' })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Param('postId', ParseIntPipe) postId: number,
    @CurrentUser() userId: number,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.create(postId, userId, dto);
  }

  @ApiOperation({ summary: '댓글 삭제' })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: '댓글 삭제 성공',
    type: CommentResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiForbiddenResponse({ description: '본인의 댓글만 삭제할 수 있습니다.' })
  @ApiNotFoundResponse({ description: '댓글을 찾을 수 없습니다.' })
  @UseGuards(JwtAuthGuard)
  @Delete(':commentId')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('postId', ParseIntPipe) postId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @CurrentUser() userId: number,
  ): Promise<CommentResponseDto> {
    return this.commentsService.remove(postId, commentId, userId);
  }
}
