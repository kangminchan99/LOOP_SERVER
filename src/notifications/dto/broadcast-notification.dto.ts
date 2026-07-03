import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class BroadcastNotificationDto {
  @ApiProperty({
    example: '테스트 알림',
    description: '푸시 알림 제목',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @ApiProperty({
    example: '전체 푸시 테스트입니다.',
    description: '푸시 알림 내용',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body!: string;

  @ApiProperty({
    example: 'test',
    description: '알림 타입',
    required: false,
  })
  @IsOptional()
  @IsString()
  type?: string;
}
