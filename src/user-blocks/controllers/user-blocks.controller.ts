import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserBlockResponseDto } from '../dto/user-block-response.dto';
import { UserBlockTargetParamDto } from '../dto/user-block-target-param.dto';
import { UserBlocksService } from '../services/user-blocks.service';
import { UserBlockListPageDto } from '../dto/user-block-list-page.dto';
import { GetUserBlocksQueryDto } from '../dto/get-user-blocks-query.dto';

@ApiTags('user-blocks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me/blocks')
export class UserBlocksController {
  constructor(private readonly service: UserBlocksService) {}

  @Put(':targetUserId')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '사용자 차단 또는 기존 차단 유지' })
  @ApiOkResponse({ type: UserBlockResponseDto })
  block(
    @CurrentUser() userId: number,
    @Param() params: UserBlockTargetParamDto,
    @Body() body: unknown,
  ): Promise<UserBlockResponseDto> {
    // 본문은 생략하거나 빈 객체만 허용한다.
    if (
      body !== undefined &&
      (body === null ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).length > 0)
    ) {
      throw new BadRequestException('요청 본문은 비워주세요.');
    }

    return this.service.block(userId, params.targetUserId);
  }

  @Delete(':targetUserId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '사용자 차단 해제' })
  @ApiNoContentResponse({ description: '차단 해제 완료 또는 이미 해제됨' })
  async unblock(
    @CurrentUser() userId: number,
    @Param() params: UserBlockTargetParamDto,
    @Body() body: unknown,
  ): Promise<void> {
    // 차단 API와 동일하게 추가 본문 입력을 거부한다.
    if (
      body !== undefined &&
      (body === null ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).length > 0)
    ) {
      throw new BadRequestException('요청 본문은 비워주세요.');
    }

    await this.service.unblock(userId, params.targetUserId);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '내가 차단한 사용자 목록 조회' })
  @ApiOkResponse({ type: UserBlockListPageDto })
  findMyBlocks(
    @CurrentUser() userId: number,
    @Query() query: GetUserBlocksQueryDto,
  ): Promise<UserBlockListPageDto> {
    return this.service.findMyBlocks(userId, query);
  }
}
