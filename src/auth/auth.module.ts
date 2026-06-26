import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadModule } from '../upload/upload.module';
import { User } from '../users/entities/user.entity';
import { AuthController } from './controllers/auth/auth.controller';
import { SocialAccount } from './entities/social-account.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './services/auth/auth.service';
import { GoogleAuthService } from './services/google/google-auth.service';
import { KakaoAuthService } from './services/kakao/kakao-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    // AuthService에서 User Repository를 쓰기 위해 User 엔티티 등록
    TypeOrmModule.forFeature([User, SocialAccount]),
    UploadModule,

    // JWT 설정을 환경변수 기반으로 등록
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    KakaoAuthService,
    GoogleAuthService,
  ],
  exports: [JwtAuthGuard],
  controllers: [AuthController],
})
export class AuthModule {}
