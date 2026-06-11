import { Module } from '@nestjs/common';
// ConfigModule, ConfigService 추가 (환경변수 로드)
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PostsModule } from './posts/posts.module';
import { UploadModule } from './upload/upload.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      // NODE_ENV 값에 따라
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      // 모든 모듈에서 별도 import 없이 환경변수 사용 가능
      isGlobal: true,
    }),
    // forRootAsync - 환경변수가 로드된 후 DB 연결하도록 비동기로 설정
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule], // ConfigModule에서 환경변수를 가져올 수 있도록 등록
      inject: [ConfigService], // ConfigService를 useFactory 함수에 주입
      useFactory: (config: ConfigService) => ({
        type: 'postgres', // DB 종류
        host: config.get('DB_HOST'), // .env 파일의 DB_HOST 값
        port: config.get<number>('DB_PORT'), // .env 파일의 DB_PORT 값
        username: config.get('DB_USER'), // .env 파일의 DB_USER 값
        password: config.get('DB_PASSWORD'), // .env 파일의 DB_PASSWORD 값
        database: config.get('DB_NAME'), // .env 파일의 DB_NAME 값
        entities: [__dirname + '/**/*.entity{.ts,.js}'], // *.entity.ts 파일을 자동으로 찾아 테이블로 등록
        synchronize:
          config.get('DB_SYNC') === 'true' ||
          config.get('NODE_ENV') !== 'production', // 개발환경 또는 DB_SYNC=true일 때만 자동 반영
        ssl:
          config.get('NODE_ENV') === 'production'
            ? { rejectUnauthorized: false }
            : false, // 운영환경에서만 SSL 활성화
      }),
    }),
    UsersModule,
    AuthModule,
    PostsModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
