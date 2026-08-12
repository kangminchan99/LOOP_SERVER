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
import { UploadService } from '../../upload/services/upload/upload.service';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { AdminUserListPageDto } from '../dto/admin-user-list-page.dto';
import { GetAdminUsersQueryDto } from '../dto/get-admin-users-query.dto';
import { AdminUsersService } from '../services/admin-users.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly uploadService: UploadService,
  ) {}

  @ApiOperation({ summary: '관리자 유저 목록 조회' })
  @ApiOkResponse({
    description: '관리자 유저 목록 조회 성공',
    type: AdminUserListPageDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiForbiddenResponse({ description: '관리자 권한이 필요합니다.' })
  @Get()
  async findList(
    @Query() query: GetAdminUsersQueryDto,
  ): Promise<AdminUserListPageDto> {
    const result = await this.adminUsersService.findList(query);

    return {
      items: await Promise.all(
        result.items.map(async (user) => {
          const dto = UserResponseDto.fromEntity(user);

          dto.profileImageUrl =
            await this.uploadService.toSignedProfileImageUrl(
              dto.profileImageUrl,
            );

          return dto;
        }),
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }
}
