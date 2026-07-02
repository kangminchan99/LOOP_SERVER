import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { DevicePlatform } from '../entities/fcm-token.entity';

export class RegisterFcmTokenDto {
  @ApiProperty({
    description:
      'Flutter 앱에서 FirebaseMessaging.getToken()으로 받은 FCM 토큰',
    example: 'dZ2fcmTokenExample123...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;

  @ApiProperty({
    description: '토큰이 발급된 기기 플랫폼',
    enum: DevicePlatform,
    example: DevicePlatform.ANDROID,
  })
  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;
}
