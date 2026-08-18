import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CreateDirectChatRoomDto {
  @ApiProperty({
    example: 7,
    description: '1:1 채팅을 시작할 상대 유저 ID',
  })
  @IsInt()
  @Min(1)
  targetUserId!: number;
}
