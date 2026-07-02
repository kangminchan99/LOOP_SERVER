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

## 22-1. Presigned URL 생성 준비

npm install @aws-sdk/s3-request-presigner

## 23. AWS 연동 EC2 + Docker

- 1. Dockerfile 작성 (로컬)
     node_modules 전체를 이미지에 담지 않고 빌드 결과물(dist)만 최종 이미지에 포함시켜서 이미지 크기를 크게 줄인다. + .dockerignore생성하여 불필요 파일 제거

- 2. .env.production 작성
     JWT 랜덤 시크릿 생성 방법 (터미널에서): node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 이 명령어를 두 번 실행해서 JWT_SECRET과 JWT_REFRESH_SECRET에 각각 사용

- 3. AWS RDS 생성 (Database)
     AWS 콘솔 → RDS → 데이터베이스 생성 클릭 후 아래대로 설정

     생성 방식 - 전체 구성

     엔진 - PostgreSQL 버전: PostgreSQL 18.x (최신 18 선택)

     템플릿 - 샌드 박스(단일 AZ DB 인스턴스) 개발/테스트이므로 비용 절감을 위해

     설정 - DB 인스턴스 식별자: loop-db-prod
     마스터 사용자 이름: loop
     마스터 암호: .env.production의 DB_PASSWORD와 동일하게

     인스턴스 유형 - db.t4g.micro

     스토리지 - 20 GiB (기본값 유지)
     스토리지 자동 조정: 체크 해제 (비용 예측을 위해)

     연결 (중요) - 퍼블릭 액세스: 아니요 ← EC2에서만 접근, 외부 노출 차단
     VPC: 기본 VPC
     가용 영역: 기본값

     데이터베이스 이름 (추가 구성 펼치기) - 초기 데이터베이스 이름: loop_db

     생성 완료 후 엔드포인트 주소를 복사해서 .env.production의 DB_HOST에 붙여넣기
     ex) 예시: loop-db-prod.xxxxxx.ap-northeast-2.rds.amazonaws.com

- 4.  EC2 생성 (AWS 가상 서버)
      AWS 콘솔 검색창에 EC2 검색 → 인스턴스 시작 클릭

           이름 - loop-server

           AMI (운영체제) - Ubuntu Server 26.04 LTS (64비트 x86)
           [Docker, Node.js 등 설치 명령어가 인터넷에 Ubuntu 기준으로 가장 많음]

           인스턴스 유형 - t3.micro

           키 페어 (중요)
           새 키 페어 생성 클릭
           이름: loop-key
           유형: RSA
           형식: .pem
           → 생성 버튼 → .pem 파일 자동 다운로드

           네트워크 설정 → 보안 그룹 편집
           규칙 1 (기본): SSH, 포트 22, 내 IP (SSH 접속)
           규칙 2 추가: 사용자 지정 TCP, 포트 3000, 0.0.0.0/0 (NestJS 서버 포트)

           스토리지
           8 GiB (기본값 유지)

- 5. RDS 보안 그룹에 EC2 접근 허용 (EC2 → RDS 5432 포트 통신을 허용)

     EC2 보안 그룹 ID 확인
     EC2 콘솔 → 만든 loop-server 인스턴스 클릭 → 하단 보안 탭 → 보안 그룹 클릭 → 상단에 있는 보안 그룹 ID 복사

     RDS 보안 그룹에 규칙 추가

     RDS 콘솔 → loop-db-prod 클릭 → 연결 & 보안 탭 → VPC 보안 그룹 클릭 → 인바운드 규칙 탭 → 인바운드 규칙 편집 클릭

     규칙 추가
     유형 - PostgreSQL
     프로토콜 - TCP
     포트 - 5432
     소스 유형 - 사용자 지정
     소스 - 위에서 복사한 EC2 보안 그룹 ID
     설명 - EC2에서 RDS 접근

- 6. EC2 SSH 접속 후 Docker 설치 (로컬이랑 EC2 환경이 완전히 동일하게 보장)

     .pem 파일 권한 설정 (최초 1회)
     chmod 400 ~/Downloads/loop-key.pem

     EC2 접속
     ssh -i ~/Downloads/loop-key.pem ubuntu@<EC2 퍼블릭 IP>
     접속 후 Are you sure you want to continue connecting? 나오면 yes 입력

     Docker 설치 (EC2 안에서 실행)
     sudo apt update && sudo apt upgrade -y

     sudo apt install -y ca-certificates curl gnupg

     curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

     echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

     sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io

     sudo usermod -aG docker ubuntu

     접속 재시작 (권한 적용)
     exit

     다시 접속: ssh -i ~/Downloads/loop-key.pem ubuntu@<EC2 퍼블릭 IP>

     Docker 설치 확인: docker --version (Docker version 2x.x.x 나오면 성공이니 exit)

     재접속 후 권한 확인: docker ps (permission denied 없이 빈 목록이 나오면 성공)

- 7.  코드 EC2에 올리고 컨테이너 실행 [로컬 맥 터미널에서 실행 (EC2 접속 끊고 나온 상태)]
      [실무에선 TypeORM Migration으로 테이블 변경 코드로 관리해야한다]

      .env.production을 EC2로 전송
      scp -i ~/Downloads/loop-key.pem /Volumes/T7/loop_server/.env.production ubuntu@3.39.xxx.xxx:~/.env.production

      코드를 EC2로 전송
      scp -i ~/Downloads/loop-key.pem -r /Volumes/T7/loop_server ubuntu@3.39.xxx.xxx:~/loop_server

      EC2 다시 접속
      ssh -i ~/Downloads/loop-key.pem ubuntu@3.39.xxx.xxx

      .env.production을 프로젝트 폴더로 이동
      mv ~/.env.production ~/loop_server/.env.production

      프로젝트 폴더로 이동
      cd ~/loop_server

      Docker 이미지 빌드
      docker build -t loop-server .

      컨테이너 실행
      docker run -d \
      --name loop-server \
      --env-file .env.production \
      -p 3000:3000 \
      --restart always \
      loop-server

      컨테이너 상태 확인 - docker ps

      서버 로그 확인 - docker logs loop-server
      [AWS CloudWatch 또는 Datadog / Sentry / Grafana]

      RDS 테이블 확인 방법 (EC2 터미널에서 직접 접속)
      sudo apt install -y postgresql-client
      psql -h <RDS 엔드포인트> -U loop -d loop*db
      \dt -- 테이블 목록 확인
      SELECT * FROM users;
      SELECT \_ FROM posts;
      \q -- 종료

## 24. 소셜 로그인(kakao) (이메일 로그인 → 이메일로 사용자를 찾음 → user.id로 JWT 발급 카카오 로그인 → 카카오 ID로 사용자를 찾음 → user.id로 JWT 발급)

- 1. openssl rand -hex 64 명령어로 Access, Refresh Token 저장

- 2. auth.service.ts 수정

- 3. social_accounts 엔티티 설계

- 4. SocialAccount Repository 등록

- 5. 카카오 로그인 요청 DTO 생성

- 6. 카카오 앱 ID 환경변수 설정 및 로그인 활성화(카카오 Developers 콘솔)

- 7. KakaoAuthService 생성 후 카카오 로그인 구현

## 24-1. 소셜 로그인(google)

- 1. google-auth-library 설치
- 2. .env에 GOOGLE_CLIENT_ID 추가
- 3. SocialProvider에 GOOGLE 추가
- 4. GoogleLoginDto 생성
- 5. GoogleAuthService 생성
- 6. AuthService.googleLogin() 추가
- 7. AuthController에 POST /auth/google 추가
- 8. AuthModule에 GoogleAuthService 등록
- 9. Swagger/build 확인

## 25. FCM (알림)

- 1. firebase-admin 설치
- 2. Firebase Admin 초기화 서비스 만들기
- 3. FCM 토큰 저장 엔티티 만들기
- 4. FCM 토큰 등록/삭제 API 만들기
- 5. 푸시 발송 서비스 만들기
- 6. 나중에 이벤트 발생 시 발송 연결
