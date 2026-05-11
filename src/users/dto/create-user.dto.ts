import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'test1@example.com', description: '유저 이메일' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: '1234abcd',
    description: '유저 비밀번호',
    minLength: 4,
  })
  @IsString()
  @MinLength(4)
  password!: string;

  @ApiProperty({ example: 'minchan', description: '유저 닉네임' })
  @IsString()
  @IsNotEmpty()
  nickname!: string;
}
