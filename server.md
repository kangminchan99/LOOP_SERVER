# NestJS 서버 구축

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

## 4.환경변수 파일 생성

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
