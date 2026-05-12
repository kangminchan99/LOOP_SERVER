import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty, IsString } from 'class-validator';

// /auth/refresh 요청 바디를 검증하는 DTO
export class RefreshTokenDto {
  // 클라이언트가 보낸 Refresh Token 문자열
  @ApiProperty({
    description: 'Refresh Token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  @IsJWT()
  refreshToken!: string;
}
