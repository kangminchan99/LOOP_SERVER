import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    example: '첫 게시글 제목',
    description: '게시글 제목',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @ApiProperty({
    example: '게시글 본문입니다.',
    description: '게시글 내용',
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}
