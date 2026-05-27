// NestJS 의존성 주입 데코레이터 + HTTP 예외 클래스
// Injectable: 이 클래스를 NestJS DI 컨테이너에 등록해 다른 곳에서 주입 가능하게 함
// InternalServerErrorException: S3 업로드 실패 시 500 응답으로 변환하는 데 사용
import { Injectable, InternalServerErrorException } from '@nestjs/common';

// NestJS 환경변수 접근 서비스
// .env 파일의 값을 타입 안전하게 읽을 수 있게 해줌 (process.env 직접 접근 대신 사용)
import { ConfigService } from '@nestjs/config';

// AWS SDK v3 S3 관련 클래스
// S3Client: S3와 통신하는 클라이언트 인스턴스
// PutObjectCommand: S3에 파일을 업로드하는 명령 객체 (SDK v3는 커맨드 패턴 사용)
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';

// Node.js 내장 path 모듈
// extname: 파일 경로에서 확장자만 추출 (예: 'photo.jpg' → '.jpg')
// import { extname } from 'path';

// UUID v4 생성 함수
// 파일명 충돌 방지용으로 사용 (같은 이름의 파일을 여러 번 올려도 S3에서 덮어쓰지 않음)
import { v4 as uuidv4 } from 'uuid';

interface UploadedImageFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
}

@Injectable()
export class UploadService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', '');
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET', '');

    // S3Client는 매 요청마다 새로 만들면 커넥션 비용이 발생하므로
    // 생성자에서 한 번만 만들고 인스턴스 전체에서 재사용한다.
    // credentials는 .env에서 읽어오기 때문에
    // 개발/운영 환경 코드 변경 없이 버킷만 달라진다.
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
          '',
        ),
      },
    });
  }

  async uploadImage(file: UploadedImageFile): Promise<string> {
    const key = this.buildObjectKey();

    try {
      // 테스트 용량 절감: 긴 변 최대 1080, WebP 품질 55
      const optimizedBuffer: Buffer = await sharp(file.buffer)
        .rotate()
        .resize({
          width: 1080,
          height: 1080,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 55, effort: 4 })
        .toBuffer();

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: optimizedBuffer,
          // ContentType을 명시하지 않으면 S3가 'application/octet-stream'으로
          // 저장해서 브라우저가 이미지로 렌더링하지 못하고 다운로드로 처리한다.
          ContentType: 'image/webp',
        }),
      );

      return this.buildPublicUrl(key);
    } catch {
      // AWS SDK 에러에는 계정 정보나 버킷 내부 구조가 포함될 수 있어
      // 그대로 노출하면 보안 위협이 되므로 일반 메시지로 변환한다.
      throw new InternalServerErrorException('이미지 업로드에 실패했습니다.');
    }
  }

  // 같은 원본 파일명으로 여러 번 업로드하면 S3에서 덮어쓰기가 발생한다.
  // uuid로 파일명을 교체하고 연/월 폴더로 분류하면
  // 충돌을 방지하고 S3 수명주기 정책을 날짜 기준으로 적용할 수 있다.
  private buildObjectKey(): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `profiles/${yyyy}/${mm}/${uuidv4()}.webp`;
  }

  // 현재는 S3 기본 URL을 반환한다.
  // 추후 CloudFront CDN을 붙이면 이 메서드만 수정하면 되므로
  // URL 생성 로직을 별도 메서드로 분리해뒀다.
  private buildPublicUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
