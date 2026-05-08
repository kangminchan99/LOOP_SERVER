# Server Architecture

## 기술 스택

| 레이어            | 기술                         | 비고                        |
| ----------------- | ---------------------------- | --------------------------- |
| 앱                | Flutter + Riverpod           | 클라이언트                  |
| 백엔드 프레임워크 | NestJS (TypeScript)          | REST API                    |
| ORM               | TypeORM                      | DB 연동                     |
| 데이터베이스      | PostgreSQL                   | 로컬: Docker, 운영: AWS RDS |
| 파일 저장         | AWS S3                       | 이미지, 첨부파일            |
| 인증              | JWT (Access + Refresh Token) | NestJS Guards               |
| 서버 호스팅       | AWS EC2 or ECS (Docker)      | NestJS 배포                 |
| 컨테이너          | Docker + Docker Compose      | 로컬 개발 환경              |

---

## 아키텍처

```
Flutter App
    ↓ HTTPS REST API
NestJS 서버 (EC2 / ECS)
    ├── Auth Module     → JWT 발급/검증
    ├── User Module     → 유저 CRUD
    ├── Board Module    → 게시판 CRUD
    └── Upload Module   → S3 파일 업로드
         ↓
AWS RDS (PostgreSQL)   ← DB
AWS S3                 ← 파일 스토리지
```

---

## 로컬 개발 환경

### 사전 설치

- [Node.js](https://nodejs.org) 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [NestJS CLI](https://docs.nestjs.com): `npm i -g @nestjs/cli`

### 1. NestJS 프로젝트 생성

```bash
nest new loop-server
cd loop-server
```

### 2. 필요 패키지 설치

```bash
# DB
npm install @nestjs/typeorm typeorm pg

# 인증
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt

# 환경변수
npm install @nestjs/config

# 파일 업로드 (S3)
npm install @aws-sdk/client-s3 multer @types/multer
```

### 3. Docker Compose로 PostgreSQL 실행

`docker-compose.yml` (loop-server 루트에 생성):

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: loop
      POSTGRES_PASSWORD: loop1234
      POSTGRES_DB: loop_db
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

```bash
docker-compose up -d
```

### 4. 환경변수 (dev/prod 분리)

환경별로 파일을 분리해서 관리해요:

```
loop-server/
├── .env.development     ← 로컬 개발용 (Git에 올리지 않음)
├── .env.production      ← 배포용     (Git에 올리지 않음)
└── .env.example         ← 샘플 파일  (Git에 올림)
```

**`.env.development`** (로컬 Docker DB 연결)

```env
NODE_ENV=development

# DB (Docker)
DB_HOST=localhost
DB_PORT=5432
DB_USER=loop
DB_PASSWORD=loop1234
DB_NAME=loop_db

# JWT
JWT_SECRET=dev_jwt_secret_key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=dev_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

# AWS
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=loop-bucket-dev
```

**`.env.production`** (AWS RDS 연결)

```env
NODE_ENV=production

# DB (AWS RDS)
DB_HOST=xxxx.ap-northeast-2.rds.amazonaws.com
DB_PORT=5432
DB_USER=loop
DB_PASSWORD=your_rds_password
DB_NAME=loop_db

# JWT
JWT_SECRET=prod_jwt_secret_key_very_strong
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=prod_refresh_secret_very_strong
JWT_REFRESH_EXPIRES_IN=7d

# AWS
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=loop-bucket-prod
```

**`.env.example`** (Git에 올리는 샘플)

```env
NODE_ENV=

DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=

JWT_SECRET=
JWT_EXPIRES_IN=
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRES_IN=

AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
```

**실행 명령어**

```bash
npm run start:dev    # .env.development 자동 로드
npm run start:prod   # .env.production 자동 로드
```

### 5. NestJS 모듈 구조 (클린 아키텍처)

> **계층 규칙**: Controller → Service → Repository → Entity 단방향 의존

```
src/
├── auth/
│   ├── controllers/
│   │   └── auth.controller.ts        ← HTTP 요청/응답만 담당
│   ├── services/
│   │   └── auth.service.ts           ← 비즈니스 로직
│   ├── repositories/
│   │   └── auth.repository.ts        ← DB 접근 전담
│   ├── entities/
│   │   └── refresh-token.entity.ts   ← DB 테이블 정의
│   ├── dto/
│   │   ├── login.dto.ts              ← 요청 데이터 유효성 검증
│   │   └── register.dto.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── jwt-refresh.strategy.ts
│   ├── guards/
│   │   └── jwt-auth.guard.ts
│   └── auth.module.ts
├── users/
│   ├── controllers/
│   │   └── users.controller.ts
│   ├── services/
│   │   └── users.service.ts
│   ├── repositories/
│   │   └── users.repository.ts
│   ├── entities/
│   │   └── user.entity.ts
│   ├── dto/
│   │   └── update-user.dto.ts
│   └── users.module.ts
├── board/
│   ├── controllers/
│   │   └── board.controller.ts
│   ├── services/
│   │   └── board.service.ts
│   ├── repositories/
│   │   └── board.repository.ts
│   ├── entities/
│   │   └── post.entity.ts
│   ├── dto/
│   │   ├── create-post.dto.ts
│   │   └── update-post.dto.ts
│   └── board.module.ts
├── upload/
│   ├── controllers/
│   │   └── upload.controller.ts
│   ├── services/
│   │   └── upload.service.ts         ← S3 업로드 로직
│   └── upload.module.ts
├── common/                           ← 전역 공통 모듈
│   ├── filters/
│   │   └── http-exception.filter.ts  ← 에러 응답 포맷 통일
│   ├── interceptors/
│   │   └── response.interceptor.ts   ← 성공 응답 포맷 통일
│   └── decorators/
│       └── current-user.decorator.ts ← @CurrentUser() 커스텀 데코레이터
├── config/
│   └── database.config.ts            ← DB 설정 분리
├── app.module.ts
└── main.ts
```

---

## AWS 운영 환경

### RDS (PostgreSQL) 설정

1. AWS 콘솔 → RDS → 데이터베이스 생성
2. 엔진: PostgreSQL 16
3. 인스턴스: `db.t3.micro` (프리티어)
4. VPC Security Group에서 EC2 → RDS 5432 포트 허용
5. `.env`의 `DB_HOST`를 RDS 엔드포인트로 변경

### S3 버킷 설정

1. AWS 콘솔 → S3 → 버킷 생성
2. 퍼블릭 액세스 설정 (업로드는 서버에서만, 조회는 CloudFront 또는 Presigned URL 사용)
3. IAM 사용자 생성 → S3 권한 부여 → Access Key 발급

### EC2 배포 (간단한 방법)

```bash
# 서버에서
git clone <repo>
cd loop-server
npm install
npm run build
npm run start:prod
```

### ECS 배포 (Docker, 권장)

`Dockerfile` (loop-server 루트에 생성):

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["node", "dist/main"]
```

---

## API 엔드포인트 설계

### Auth

| Method | URL              | 설명                |
| ------ | ---------------- | ------------------- |
| POST   | `/auth/register` | 회원가입            |
| POST   | `/auth/login`    | 로그인 (JWT 발급)   |
| POST   | `/auth/refresh`  | Access Token 재발급 |
| POST   | `/auth/logout`   | 로그아웃            |

### Board

| Method | URL          | 설명                    |
| ------ | ------------ | ----------------------- |
| GET    | `/posts`     | 게시글 목록             |
| GET    | `/posts/:id` | 게시글 상세             |
| POST   | `/posts`     | 게시글 작성 (인증 필요) |
| PATCH  | `/posts/:id` | 게시글 수정             |
| DELETE | `/posts/:id` | 게시글 삭제             |

### Upload

| Method | URL             | 설명             |
| ------ | --------------- | ---------------- |
| POST   | `/upload/image` | S3 이미지 업로드 |

---

## Flutter 연동

```yaml
# pubspec.yaml에 추가
dependencies:
  dio: ^5.7.0 # HTTP 클라이언트
  flutter_secure_storage: ^9.2.2 # JWT 토큰 저장
```

- Dio interceptor로 Access Token 자동 첨부
- 401 응답 시 Refresh Token으로 자동 재발급 처리
- Riverpod Provider로 API 서비스 관리

---

## .gitignore

```gitignore
# 환경변수 (절대 Git에 올리면 안 됨)
.env.development
.env.production

# 빌드 결과물
dist/

# 패키지 (npm install로 재생성 가능)
node_modules/

# 로그
*.log
logs/

# macOS 시스템 파일
.DS_Store

# IDE
.idea/
.vscode/

# TypeScript 캐시
*.tsbuildinfo
```

> `.env.example`은 Git에 올려요 (실제 값 없이 키 이름만 포함)
