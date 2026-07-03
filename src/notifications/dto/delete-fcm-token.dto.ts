import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeleteFcmTokenDto {
  @ApiProperty({
    description: '삭제할 현재 기기의 FCM 토큰',
    example: 'dZ2fcmTokenExample123...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;
}
