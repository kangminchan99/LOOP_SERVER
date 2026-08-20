import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class SendChatMessageDto {
  @ApiProperty({
    example: 3,
    description: '메시지를 보낼 채팅방 ID',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roomId!: number;

  @ApiProperty({
    example: '안녕하세요',
    description: '메시지 내용',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content!: string;
}
