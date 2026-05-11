import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'newuser@example.com',
    description: '회원가입 이메일',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '1234abcd', description: '비밀번호', minLength: 4 })
  @IsString()
  @MinLength(4)
  password!: string;

  @ApiProperty({ example: 'minchan', description: '닉네임' })
  @IsString()
  @IsNotEmpty()
  nickname!: string;
}
