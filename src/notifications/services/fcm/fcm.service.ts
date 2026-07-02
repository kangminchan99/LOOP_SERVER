import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cert,
  getApps,
  initializeApp,
  ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync } from 'fs';
import { resolve } from 'path';

@Injectable()
export class FcmService implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  // NestJS 모듈이 초기화될 때 자동으로 실행된다.
  // 서버가 시작될 때 Firebase Admin SDK를 한 번만 초기화하기 위한 메서드.
  onModuleInit(): void {
    // Firebase Admin 앱이 이미 초기화되어 있으면 다시 초기화하지 않는다.
    // 중복 initializeApp() 호출을 막기 위한 방어 코드.
    if (getApps().length > 0) {
      return;
    }

    // .env.development 또는 .env.production에서
    // FIREBASE_SERVICE_ACCOUNT_PATH 값을 읽는다.
    // 예: FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json
    const serviceAccountPath = this.configService.getOrThrow<string>(
      'FIREBASE_SERVICE_ACCOUNT_PATH',
    );

    // 상대 경로로 들어온 서비스 계정 파일 경로를
    // 현재 서버 실행 위치 기준의 절대 경로로 변환한다.
    const absolutePath = resolve(process.cwd(), serviceAccountPath);

    // Firebase Admin SDK 서비스 계정 JSON 파일을 읽어서 객체로 변환한다.
    // 이 파일에는 Firebase 서버 권한이 있으므로 절대 Git에 올리면 안 된다.
    const serviceAccount = JSON.parse(
      readFileSync(absolutePath, 'utf8'),
    ) as ServiceAccount;

    // Firebase Admin SDK 초기화.
    // 이 서버가 Firebase 프로젝트에 관리자 권한으로 접근할 수 있게 만든다.
    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  // 특정 기기 하나에 FCM 푸시 알림을 보낸다.
  // token은 Flutter 앱에서 FirebaseMessaging.getToken()으로 받은 FCM 토큰.
  async sendToToken(params: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<string> {
    // Firebase Cloud Messaging으로 메시지를 전송한다.
    // 성공하면 Firebase가 messageId 문자열을 반환한다.
    return getMessaging().send({
      token: params.token,
      notification: {
        title: params.title,
        body: params.body,
      },
      data: params.data,
    });
  }
}
