import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { GetCommentsQueryDto } from '../../dto/get-comments-query.dto';
import { MyCommentListPageDto } from '../../dto/my-comment-list-page.dto';
import { CommentsService } from '../../services/comments/comments.service';

@ApiTags('comments')
@Controller('comments')
export class MyCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @ApiOperation({ summary: '내가 작성한 댓글 목록 조회' })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: '내 댓글 목록 조회 성공',
    type: MyCommentListPageDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  findMyComments(
    @CurrentUser() userId: number,
    @Query() query: GetCommentsQueryDto,
  ): Promise<MyCommentListPageDto> {
    return this.commentsService.findMyComments(userId, query);
  }
}
