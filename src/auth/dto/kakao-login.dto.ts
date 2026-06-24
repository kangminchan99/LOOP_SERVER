import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class KakaoLoginDto {
  @ApiProperty({
    description: 'Flutter 카카오 SDK에서 발급받은 Access Token',
    example: 'abcdef123456...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  kakaoAccessToken!: string;
}
