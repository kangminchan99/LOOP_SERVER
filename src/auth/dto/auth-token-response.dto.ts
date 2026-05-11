import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class AuthTokenResponseDto {
  @ApiProperty({ type: UserResponseDto, description: '유저 정보' })
  user!: UserResponseDto;

  @ApiProperty({ description: 'Access Token' })
  accessToken!: string;

  @ApiProperty({ description: 'Refresh Token' })
  refreshToken!: string;
}
