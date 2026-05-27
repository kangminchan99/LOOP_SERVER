# NestJS 서버 구축

## 0.pgAdmin & Swagger

- pgAdmin: http://localhost:5050
  아이디: admin@example.com
  비밀번호: admin
- Swagger: http://localhost:3000/api-docs

## 1. NestJS CLI 설치

1. npm i -g @nestjs/cli

## 2. NestJS 프로젝트 생성

1. nest new . --skip-git
2. package manager: npm 선택

## 3. 필요 패키지 설치

[DB]
npm install @nestjs/typeorm typeorm pg

[인증]
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt

[환경변수]
npm install @nestjs/config

[유효성 검증]
npm install class-validator class-transformer

[파일 업로드 (S3)]
npm install @aws-sdk/client-s3 multer
npm install -D @types/multer

## 4. 환경변수 파일 생성

1. .env.development, .env.production, .env.example 파일 3개 생성
   [.env.development]
   NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=loop
DB_PASSWORD=loop1234
DB_NAME=loop_db

JWT_SECRET=dev_jwt_secret_key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=dev_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=loop-bucket-dev

## 5. package.json 실행 스크립트 수정

"start": "NODE_ENV=development nest start",
"start:dev": "NODE_ENV=development nest start --watch",
"start:debug": "NODE_ENV=development nest start --debug --watch",
"start:prod": "NODE_ENV=production node dist/main",

## 6. Docker Compose 파일 생성

[docker-compose.yml]
version: '3.8'
services:
postgres:
image: postgres:16
environment:
POSTGRES_USER: loop
POSTGRES_PASSWORD: loop1234
POSTGRES_DB: loop_db
ports: - '5432:5432'
volumes: - postgres_data:/var/lib/postgresql/data

volumes:
postgres_data:

## 7. Docker로 PostgreSQL 실행

[-d: 백그라운드에서 실행하여 터미널을 계속 점유 x]
docker compose up -d

## 8. NestJS와 DB 연결 설정

[NestJS .env 파일을 읽고 DB에 연결하도록 app.module.ts를 수정]

### 8-1. ConfigModule 추가 (환경변수 로드)

import { ConfigModule } from '@nestjs/config';

[app.module.ts의 imports: [] 안에 추가]
ConfigModule.forRoot({
envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
isGlobal: true,
}),

envFilePath → NODE_ENV 값에 따라 .env.development 또는 .env.production을 자동으로 읽음
isGlobal: true → 모든 모듈에서 별도 import 없이 환경변수 사용 가능

### 8-2 TypeOrmModule 추가 (DB 연결)

import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

[app.module.ts의 imports: [] 안에 추가]
TypeOrmModule.forRootAsync({
imports: [ConfigModule],
inject: [ConfigService],
useFactory: (config: ConfigService) => ({
type: 'postgres',
host: config.get('DB_HOST'),
port: config.get<number>('DB_PORT'),
username: config.get('DB_USER'),
password: config.get('DB_PASSWORD'),
database: config.get('DB_NAME'),
entities: [__dirname + '/**/*.entity{.ts,.js}'],
synchronize: config.get('NODE_ENV') !== 'production',
}),
}),

forRootAsync → 환경변수가 로드된 후 DB 연결하도록 비동기로 설정
entities → \*.entity.ts 파일을 자동으로 찾아서 DB 테이블로 등록
synchronize → 개발 환경에서만 Entity 바뀌면 DB에 자동 반영 (운영은 false)

## 9. 서버 실행 및 DB 연결 확인

npm run start:dev

## 10. User Entity 생성

src/users/entities/user.entity.ts

## 11. User 모듈/서비스/컨트롤러 생성

### User 모듈/서비스/컨트롤러 자동 생성

<!-- Module: 묶음(기능 단위의 독립 공간) -->

nest g module users

<!-- Service: 실제 동작(비즈니스 로직) -->

nest g service users/services/users

<!-- Controller: HTTP 요청/응답 처리 -->

nest g controller users/controllers/users

## 12. User CRUD 기본 구현

### users.module.ts에 Entity, Service, Controller 등록

### UsersService 구현

### UserController 구현

## 13. Swagger 구현 및 설정 추가

npm install @nestjs/swagger swagger-ui-express

## 14. Auth(인증) 모듈 구현

Auth 모듈 생성

- nest g module auth
- nest g service auth/services/auth
- nest g controller auth/controllers/auth

회원가입 시 비밀번호 해시(bcrypt)
로그인 시 비밀번호 검증
Access/Refresh 토큰 발급
JWT Guard로 보호 API 적용
Swagger에 Bearer 인증 버튼 연결

## 15. Posts(게시글) 기능 구현

<!-- 게시글 기능의 묶음 생성(관련 컨트롤러/서비스/엔티티를 한 도메인으로 관리) -->

nest g module posts

<!-- 비즈니스 로직 담당 클래스 생성(게시글 생성, 수정, 삭제 등 DB 레포 호출) -->

nest g service posts/services/posts

<!-- HTTP 요청/응답 입구 생성 -->

nest g controller posts/controllers/posts

## 16. Post 엔티티 만들기

- src/posts/entities/post.entity.ts

## 17. Post 엔티티를 posts 모듈에 연결

@Module({

   <!-- TypeORM에게 Post 엔티티를 대상으로 한 Repository를 생성하라고 알려줌 -->

imports: [TypeOrmModule.forFeature([Post])],
providers: [PostsService],
controllers: [PostsController],
})

## 18. CreatePostDto 만들기

<!-- 서비스 DTO 작성 단계 -->

- src/posts/dto/create-post.dto.ts

## 19. PostsService에 글쓰기 로직 추가

- posts.service.ts

## 20. 컨트롤러에 글쓰기 API 연결

- posts.controller.ts

## 21. 응답 DTO 분리

- src/posts/dto/post-response.dto.ts

컨트롤러 응답 타입 교체 (posts.controller.ts)

## 22. AWS S3 프로필 이미지 업로드 및 연동

- 1. AWS SDK 패키지 설치 npm (install @aws-sdk/client-s3 multer @types/multer uuid @types/uuid)
- 2. AWS IAM 키 발급 (root)
     root 계정 → IAM → 사용자 생성
     이름: admin (또는 본인 이름)
     권한: AdministratorAccess
     액세스 키 발급 후 저장
- 3. IAM 로그인 후 S3 버킷 생성
- 4. env.development에 액세스 키, 리전, 버킷 추가
- 5. 이미지 업로드 모듈/서비스/컨트롤러 생성
     nest g module upload
     nest g service upload/services/upload
     nest g controller upload/controllers/upload
