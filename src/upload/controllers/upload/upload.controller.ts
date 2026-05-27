import {
  BadRequestException,
  Controller,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UsersService } from '../../../users/services/users/users.service';
import { UploadService } from '../../services/upload/upload.service';

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly usersService: UsersService,
  ) {}

  @ApiOperation({ summary: '프로필 이미지 업로드' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        // 메모리 기반 업로드에서 과도한 메모리 점유를 막기 위한 1차 제한
        fileSize: 2 * 1024 * 1024, // 2MB
      },
      fileFilter: (req, file, cb) => {
        // 확장자가 아니라 MIME 타입 기준으로 허용 대상을 제한
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              '지원하지 않는 이미지 형식입니다. (jpeg, png, webp만 허용)',
            ),
            false,
          );
        }
        return cb(null, true);
      },
    }),
  )
  @UseGuards(JwtAuthGuard)
  @Post('profile-image')
  async uploadProfileImage(
    @CurrentUser() userId: number,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ profileImageUrl: string }> {
    // Guard를 통과했더라도 user 객체가 비정상인 경우를 방어
    if (!userId) {
      throw new UnauthorizedException('유효한 사용자 정보가 없습니다.');
    }

    // 인터셉터를 통과했더라도 파일 누락 케이스를 최종 방어
    if (!file) {
      throw new BadRequestException('이미지 파일(image)은 필수입니다.');
    }

    const profileImageUrl = await this.uploadService.uploadImage(file);
    await this.usersService.updateProfileImage(userId, profileImageUrl);
    return { profileImageUrl };
  }
}
