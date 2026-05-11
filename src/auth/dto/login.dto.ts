import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'newuser@example.com', description: '로그인 이메일' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '1234abcd', description: '비밀번호', minLength: 4 })
  @IsString()
  @MinLength(4)
  password!: string;
}
