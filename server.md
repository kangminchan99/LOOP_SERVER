# NestJS 서버 구축

## 관리자 게시글 삭제

- [관리자 게시글 삭제 단계별 가이드](docs/admin-post-delete.md)
- 상태: 기본 구현 반영. 사용자 동작 확인 완료 보고; 세부 검증 범위는 가이드 참고.
- 기존 앱의 작성자 전용 삭제 API를 유지하고 관리자 전용 API를 추가했다.

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

## 22-2. CloudFront CDN 적용 계획

[목표]

S3에 저장된 프로필 이미지/게시글 이미지를 앱에서 직접 S3 URL로 조회하지 않고, CloudFront CDN URL로 조회하도록 변경한다.

```txt
현재 구조
Flutter App → S3 URL

목표 구조
Flutter App → CloudFront CDN → S3
```

[왜 적용하는가]

- 이미지 로딩 속도 개선
- S3 직접 노출 최소화
- 동일 이미지 반복 요청 시 CloudFront 캐시 사용
- 운영 환경에서 이미지/정적 파일 전달 구조를 실무 방식에 가깝게 개선

[적용 순서]

1. S3 버킷 상태 확인
   - 현재 업로드 경로 확인
   - 프로필 이미지 key 구조 확인
   - 게시글 이미지 key 구조 확인

2. CloudFront Distribution 생성

   AWS 콘솔 → CloudFront → Create distribution
   - Origin domain: 기존 S3 버킷 선택
   - Viewer protocol policy: Redirect HTTP to HTTPS
   - Allowed HTTP methods: GET, HEAD
   - Cache policy: CachingOptimized

3. S3 접근 정책 결정

   개발 단계에서는 둘 중 하나 선택:
   - 간단한 방식: S3 public read 유지 + CloudFront 연결
   - 실무 권장 방식: S3 private + CloudFront OAC(Origin Access Control)로만 접근 허용

   최종 목표는 S3 private + CloudFront OAC 구조.

4. 환경변수 추가

   `.env.development`, `.env.production`, `.env.example`에 추가:

   ```env
   CLOUDFRONT_DOMAIN=
   ```

   예시:

   ```env
   CLOUDFRONT_DOMAIN=https://dxxxxx.cloudfront.net
   ```

5. 서버 응답 URL 변경

   현재 S3 URL을 그대로 DB/응답에 내려주고 있다면, 조회 응답에서는 CloudFront URL로 변환한다.

   예시:

   ```txt
   S3 key: profiles/user-1.png
   응답 URL: https://dxxxxx.cloudfront.net/profiles/user-1.png
   ```

   실무적으로는 DB에 전체 URL보다 S3 key만 저장하는 방식이 좋다.

   ```txt
   DB 저장: profiles/user-1.png
   API 응답: CLOUDFRONT_DOMAIN + / + imageKey
   ```

6. UploadService 수정 방향
   - S3 업로드는 그대로 유지
   - 업로드 결과로 S3 URL 대신 `key` 또는 CloudFront URL 반환
   - User/Post 응답 DTO에서 CloudFront URL 조립

7. Flutter 앱 수정 방향
   - 앱은 서버가 내려주는 `profileImageUrl`, `postImageUrl`을 그대로 사용
   - Flutter는 S3/CloudFront 여부를 몰라도 되게 만든다
   - `cached_network_image`는 그대로 사용 가능

8. 캐시 무효화 전략

   이미지 파일명을 매번 새 UUID로 만들면 CloudFront invalidation을 자주 하지 않아도 된다.

   추천:

   ```txt
   profiles/{userId}/{uuid}.jpg
   posts/{postId}/{uuid}.jpg
   ```

   같은 key로 이미지를 덮어쓰는 방식은 캐시 때문에 앱에서 오래된 이미지가 보일 수 있다.

9. 배포 후 확인
   - CloudFront URL로 이미지 조회되는지 확인
   - S3 URL 직접 접근 차단 여부 확인
   - Flutter 앱에서 이미지 로딩 확인
   - 캐시 적용 후 재요청 속도 확인

[주의사항]

- CloudFront는 생성 후 배포 완료까지 시간이 걸릴 수 있다.
- S3를 private으로 바꾸기 전, CloudFront OAC 접근이 정상 동작하는지 먼저 확인한다.
- 이미지 수정이 잦은 경우 같은 파일명 재사용보다 UUID 기반 새 key 저장이 안전하다.
- CloudFront 비용이 발생할 수 있으므로 개인 실습 시 사용량을 확인한다.

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
           규칙 2 추가: HTTP, 포트 80, 0.0.0.0/0 (Nginx HTTP)
           규칙 3 추가: HTTPS, 포트 443, 0.0.0.0/0 (Nginx HTTPS)
           규칙 4 선택: 사용자 지정 TCP, 포트 3000, 내 IP (초기 NestJS 직접 테스트용)

           실무에서는 3000번 포트를 0.0.0.0/0으로 열지 않는다.
           외부 요청은 80/443으로 받고, Nginx가 내부의 NestJS 3000번 포트로 전달한다.

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

### 23-1. 운영 API 도메인 연결: `https://api.<도메인>`

Flutter 앱에서 운영 서버를 호출할 때는 EC2 IP를 직접 넣는 것보다 도메인을 사용한다.

```env
API_URL=https://api.<내도메인>
```

예시:

```env
API_URL=https://api.loop-example.com
```

최종 구조:

```txt
Flutter 앱
→ https://api.<내도메인>
→ EC2 Nginx 443
→ Docker NestJS 127.0.0.1:3000
→ RDS / S3 / Redis
```

#### 1. Elastic IP 연결

EC2 퍼블릭 IP는 인스턴스를 중지/시작하면 바뀔 수 있으므로 운영에서는 Elastic IP를 연결한다.

```txt
AWS 콘솔
→ EC2
→ 탄력적 IP
→ 탄력적 IP 주소 할당
→ 작업
→ 탄력적 IP 주소 연결
→ loop-server EC2 선택
```

#### 2. DNS A 레코드 생성

도메인 관리 서비스(Route 53, Cloudflare, Gabia 등)에서 API 서브도메인을 EC2 Elastic IP로 연결한다.

```txt
Type: A
Name: api
Value: <EC2 Elastic IP>
TTL: Auto 또는 300
```

예시:

```txt
api.loop-example.com → 3.39.xxx.xxx
```

#### 3. EC2 보안 그룹 확인

운영 API 도메인 구조에서는 외부에 80, 443만 공개한다.

```txt
22   SSH    내 IP만 허용
80   HTTP   0.0.0.0/0
443  HTTPS  0.0.0.0/0
3000 NestJS 외부 공개 X
```

3000번은 Nginx가 EC2 내부에서만 접근하게 만드는 것이 안전하다.

#### 4. EC2에 Nginx 설치

EC2 접속 후 실행:

```bash
sudo apt update
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

Nginx 역할:

```txt
https://api.<내도메인> 요청 수신
→ http://127.0.0.1:3000 NestJS 서버로 전달
```

#### 5. NestJS Docker 컨테이너를 내부 포트로 실행

Nginx를 앞에 둘 때는 3000번을 외부 전체에 열지 않고 EC2 내부에서만 접근 가능하게 실행한다.

```bash
docker stop loop-server
docker rm loop-server

docker run -d \
--name loop-server \
--env-file .env.production \
-p 127.0.0.1:3000:3000 \
--restart always \
loop-server
```

차이:

```txt
-p 3000:3000
→ 외부에서 http://EC2_IP:3000 직접 접근 가능

-p 127.0.0.1:3000:3000
→ EC2 내부에서만 3000 접근 가능
→ 외부는 Nginx를 통해서만 접근
```

#### 6. Nginx API 프록시 설정

설정 파일 생성:

```bash
sudo nano /etc/nginx/sites-available/loop-api
```

내용:

```nginx
server {
    listen 80;
    server_name api.<내도메인>;

    location / {
        proxy_pass http://127.0.0.1:3000;

        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

설정 활성화:

```bash
sudo ln -s /etc/nginx/sites-available/loop-api /etc/nginx/sites-enabled/loop-api
sudo nginx -t
sudo systemctl reload nginx
```

확인:

```bash
curl http://api.<내도메인>
```

#### 7. HTTPS 인증서 적용

Let's Encrypt 인증서를 사용하면 무료로 HTTPS를 적용할 수 있다.

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.<내도메인>
```

성공 후 확인:

```bash
curl https://api.<내도메인>
```

인증서 자동 갱신 확인:

```bash
sudo certbot renew --dry-run
```

#### 8. NestJS CORS 운영 도메인 설정

관리자 웹 또는 웹뷰가 API를 호출한다면 운영 도메인을 CORS에 추가한다.

`.env.production`

```env
ADMIN_WEB_ORIGIN=https://admin.<내도메인>
APP_WEB_ORIGIN=https://app.<내도메인>
```

앱은 네이티브 HTTP 요청이라 일반적으로 브라우저 CORS의 직접 대상은 아니지만,
Next.js 관리자 웹이나 웹뷰/웹 환경에서는 CORS 설정이 필요하다.

#### 9. Flutter 운영 API_URL 변경

Flutter 앱의 운영 환경 `.env`에 API 도메인을 넣는다.

```env
API_URL=https://api.<내도메인>
```

로컬/운영 구분:

```env
# Android emulator
API_URL=http://10.0.2.2:3000

# iOS simulator
API_URL=http://localhost:3000

# production
API_URL=https://api.<내도메인>
```

앱 요청 흐름:

```txt
DioNetwork
→ API_URL + /auth/login
→ https://api.<내도메인>/auth/login
→ Nginx
→ NestJS Docker
```

#### 10. 운영 확인 체크리스트

```bash
docker ps
docker logs loop-server
sudo nginx -t
sudo systemctl status nginx
curl https://api.<내도메인>
curl https://api.<내도메인>/api-docs-json
```

체크 포인트:

```txt
1. DNS가 EC2 Elastic IP를 바라보는지
2. EC2 보안 그룹에서 80/443이 열려 있는지
3. Docker 컨테이너가 127.0.0.1:3000으로 실행 중인지
4. Nginx가 127.0.0.1:3000으로 프록시하는지
5. HTTPS 인증서가 정상 발급됐는지
6. Flutter API_URL이 https://api.<내도메인>인지
7. 로그인/토큰 재발급/이미지 업로드/웹소켓이 운영 주소에서 동작하는지
```

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

## 26. FCM 고도화 (Redis)

[게시글 작성 시 FCM 푸시 발송을 Redis Queue 기반 백그라운드 작업으로 분리]

- 1. Redis Docker 설정
- 2. BullMQ/Nest 패키지 설치
- 3. QueueModule 생성
- 4. NotificationQueueService 생성
- 5. NotificationProcessor 생성
- 6. PostsService에서 직접 FCM 호출 제거하고 queue add로 변경
- 7. Worker가 FCM 발송 처리

## 27. 알림 목록 + 읽음 처리 + 읽지 않은 개수

- 1. Notification 엔티티 만들기
- 2. NotificationsModule에 Notification 엔티티 등록
- 3. NotificationResponseDto 만들기
- 4. NotificationsService에 알림 로직 추가
- 5. NotificationsController에 알림 API 추가

## 28. 댓글 기능 추가

- 1. Comment Entity 만들기
- 2. CommentsModule / Service / Controller 생성
- 3. CommentsModule에 TypeOrmModule 등록
- 4. PostsModule / UsersModule 관계 확인
- 5. CreateCommentDto 만들기
- 6. CommentResponseDto 만들기
- 7. 댓글 작성 API 만들기
- 8. 댓글 목록 조회 API 만들기
- 9. 댓글 삭제 API 만들기
- 10. 댓글 목록 cursor pagination 적용
- 11. 댓글 작성 시 게시글 작성자에게 알림 연결
- 12. Swagger 테스트
- 13. Flutter 상세 페이지에 댓글 UI 연결

## 29. 게시글 작성 시 OpenAI API로 AI 자동 요약 기능

- 1. OpenAI API Key 발급
- 2. 서버 .env에 OPENAI_API_KEY, AI_MODEL 추가
- 3. OpenAI 패키지 설치
- 4. AiModule 생성
- 5. OpenAiService 생성
- 6. 게시글 요약 프롬프트 작성
- 7. posts 테이블에 summary 관련 컬럼 추가
- 8. 게시글 작성 후 AI 요약 생성
- 9. 실패 처리
- 10. 앱에서 summary 표시

## 30. CI (GitHub에 push/PR 할 때 서버 코드가 자동으로 설치·빌드·테스트되는지 확인)

[CI]

- 1. workflow 폴더 만들기
- 2. server-ci.yml 만들기
- 3. lint / lint:fix 분리
- 4. 로컬에서 CI 명령어 테스트

---

[CD]

- 1. EC2에 프로젝트 clone

/home/ubuntu/loop_server

- 2. EC2에 .env.production 생성

- 3. EC2에서 최초 수동 실행 확인

npm ci
npm run build
pm2 start dist/main.js --name loop-server
pm2 save

- 4. GitHub Secrets 등록

EC2_HOST
EC2_USER
EC2_SSH_KEY
EC2_PROJECT_PATH

- 5. server-cd.yml 생성

.github/workflows/server-cd.yml

- 6. main 브랜치 push 시 실행되도록 설정

- 7. CD 실행 명령어 작성

cd $EC2_PROJECT_PATH
git pull origin main
npm ci
npm run build
pm2 restart loop-server

- 8. main 브랜치에 push

- 9. GitHub Actions 탭에서 Server CD 성공 확인

- 10. EC2에서 배포 상태 확인

pm2 list
pm2 logs loop-server

## 31. API 보안 점검

- 1. 관리자 권한 구조 만들기
- 2. AdminGuard 생성
- 3. JWT에 role을 포함
- 4. 전체 푸시 API 보호
- 5. UsersController 보안 정리
- 6. Refresh token role 갱신 정책
- 7. 관리자 API 테스트

## 32. 채팅 기능

[채팅방 생성 API]

- 1. ChatModule 생성
- 2. ChatRoomEntity 생성
- 3. ChatRoomParticipant Entity 생성
- 4. ChatMessage Entity 생성
- 5. ChatModule에 Entity 등록
- 6. CreateDirectChatRoomDto 생성
- 7. ChatRoomResponseDto 생성
- 8. ChatRoomsService 생성
- 9. ChatRoomsController 생성

[채팅방 목록 조회 API]

- 1. ChatRoomsService에 목록 조회 메서드 추가
- 2. ChatRoomsController에 목록 조회 API 추가

[채팅 메시지 목록 조회 API]

- 1. 메시지 조회 Query DTO 만들기
- 2. ChatMessageResponseDto 생성
- 3. ChatMessagesService 생성
- 4. Controller에 메시지 목록 조회 API를 추가
- 5. ChatGateway 생성

[WebSocket]

- 1. WebSocket으로 보낼 메시지 DTO (SendChatMessageDto)
- 2. ChatMessagesService.createMessage() 추가
- 3. WebSocket 패키지 설치
- 4. ChatGateway 생성
- 5. Gateway에 연결 인증 추가
- 6. chat:join 참여자 권한 검증

[WebSocket 실무 적용 시 수정/점검할 부분]

- 1. 로컬 주소를 운영 주소로 변경
     - 로컬: `ws://localhost:3000` 또는 `http://localhost:3000`
     - 운영: `wss://api.example.com`
     - Flutter 앱의 socket 연결 URL을 운영 API 도메인으로 변경

- 2. WebSocket CORS 설정 제한
     - 현재 개발 중에는 `origin: '*'` 사용 가능
     - 운영에서는 허용할 앱/웹 도메인만 명시

```ts
@WebSocketGateway({
  cors: {
    origin: ['https://admin.example.com', 'https://app.example.com'],
  },
})
```

- 3. Nginx 또는 로드밸런서에서 WebSocket Upgrade 설정
     - EC2 + Nginx 배포 시 `/socket.io/` 요청을 NestJS 서버로 프록시
     - `Upgrade`, `Connection` 헤더가 있어야 WebSocket 연결 유지 가능

```nginx
location /socket.io/ {
  proxy_pass http://localhost:3000/socket.io/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
}
```

- 4. 연결 시 JWT 인증 유지
     - Flutter에서 socket 연결 시 `auth.token`으로 accessToken 전달
     - 서버 `ChatGateway.handleConnection()`에서 토큰 검증
     - 성공 시 `client.data.userId` 저장
     - 실패 시 `client.disconnect(true)`

```dart
IO.io(
  'wss://api.example.com',
  IO.OptionBuilder()
      .setTransports(['websocket'])
      .setAuth({'token': accessToken})
      .build(),
);
```

- 5. `chat:join`에서도 참여자 권한 검증
     - 현재 메시지 전송은 `createMessage()`에서 참여자 검증
     - 운영에서는 room 입장도 검증 필요
     - 참여자가 아닌 유저가 임의 roomId로 입장하지 못하게 막아야 함

```txt
chat:join
→ userId 확인
→ roomId 참여자인지 검사
→ 맞으면 client.join()
→ 아니면 WsException
```

- 6. 서버 여러 대 운영 시 Redis Adapter 적용
     - 서버 1대: socket room이 서버 메모리에만 있어도 동작
     - 서버 2대 이상: Redis Adapter 필요
     - 이유: A 유저는 서버1, B 유저는 서버2에 붙으면 기본 emit만으로 전달 안 될 수 있음

```txt
Nest 서버 1
Nest 서버 2
    ↓
Redis Pub/Sub
```

- 7. Access Token 만료 처리
     - WebSocket은 한 번 연결되면 오래 유지됨
     - 운영에서는 토큰 만료 정책 필요
     - 기본 방식:
       1. 연결 시 accessToken 검증
       2. 만료되면 연결 실패
       3. 앱에서 refresh 후 socket 재연결

- 8. 오프라인 유저 FCM 처리
     - 상대가 socket room에 접속 중이면 WebSocket으로 즉시 전달
     - 상대가 오프라인이면 FCM 푸시 발송
     - 메시지는 항상 DB에 먼저 저장

```txt
chat:send
→ DB 저장
→ 온라인 유저에게 WebSocket emit
→ 오프라인 유저에게 FCM 발송
```

- 9. 운영 로그/모니터링 추가
     - 연결 성공/실패
     - room join
     - 메시지 전송 실패
     - 인증 실패
     - 추후 Sentry 또는 OpenTelemetry와 연결 가능

- 10. 운영 전 테스트 순서
      1. 로컬 socket.io-client 테스트
      2. Flutter 앱에서 로컬 WebSocket 연결
      3. 서버 배포 후 `wss://` 연결 확인
      4. Nginx/ALB WebSocket 연결 유지 확인
      5. 앱 백그라운드/재접속 확인
      6. 토큰 만료 후 refresh + 재연결 확인
      7. 오프라인 유저 FCM 확인

## 33. SSE

- 1. SSE 모듈/컨트롤러 생성
- 2. SSE로 내려줄 응답 DTO 만들기
- 3. 서버 상태 데이터를 만드는 Service 만들기
- 4. @Sse() 컨트롤러 만들기

## 대용량 데이터 처리 및 동시 요청 성능 개선

- 1. 대량 seed 데이터 만들기
- 2. 게시글 목록 조회 성능 확인
- 3. 커서 페이지네이션 점검/개선
- 4. DB 인덱스 추가
- 5. 검색 API 성능 개선
     1. 검색 Query DTO 만들기
     2. PostsController에 검색 API 추가
     3. PostsService에 기본 검색 로직 추가
     4. 검색 결과도 cursor pagination 적용
     5. 검색 API 동작 확인
     6. 검색 성능 측정
     7. PostgreSQL pg_trgm extension 추가
     8. title/content 검색용 GIN index 추가
     9. 검색 성능 재측정
- 6. 동시 요청 테스트 (npx autocannon -c 100 -d 30 "http://127.0.0.1:3000/posts?limit=20")
     -c 100
     → 동시에 100개 연결

     -d 30
     → 30초 동안 테스트

     /posts?limit=20
     → 게시글 목록 API 테스트

     [서버 응답 속도와 처리량이 어느 정도인지 확인]

- 7. Redis 캐시 적용
     1. ioredis 확인
     2. CacheModule 생성
     3. CacheService 생성
     4. AppModule에 CacheModule 등록
     5. build 확인
- 8. BullMQ로 무거운 작업 분리 (서버가 어떤 무거운 일을 바로 처리하지 않고, Redis에 “나중에 처리할 일”로 넣어두는 구조)
     1. NotificationQueue job 이름 추가
     2. NotificationQueueService에 cleanup job 등록 메서드 추가
     3. NotificationsService에 오래된 읽은 알림 삭제 로직 추가
     4. NotificationProcessor에서 cleanup job 처리
     5. 테스트용/관리자용 API 추가
     6. Swagger에서 job 등록 확인
- 9. DB connection pool 조정
- 10. API rate limit 적용
      1. @nestjs/throttler 설치
      2. AppModule에 ThrottlerModule 등록
      3. 전역 ThrottlerGuard 등록
      4. 기본 제한값 설정
      5. 특정 API별 제한값 커스텀
      6. 로그인/검색 API 제한 강화
      7. 테스트로 429 응답 확인
      8. 운영 환경 주의사항 정리
