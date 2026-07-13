import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  // Redis 서버와 통신하는 클라이언트 객체
  // get, set, del 같은 Redis 명령을 실행할 때 사용한다.
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    // .env의 REDIS_HOST, REDIS_PORT 값을 사용해 Redis에 연결한다.
    // maxRetriesPerRequest는 Redis 장애 시 요청을 너무 오래 붙잡지 않도록 제한한다.
    this.redis = new Redis({
      host: this.config.getOrThrow<string>('REDIS_HOST'),
      port: Number(this.config.getOrThrow<string>('REDIS_PORT')),
      maxRetriesPerRequest: 2,
    });
  }

  // Redis에 저장된 JSON 문자열을 꺼내 객체로 변환한다.
  // 캐시가 없으면 null을 반환한다.
  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  // 객체를 JSON 문자열로 변환해서 Redis에 저장한다.
  // ttlSeconds가 지나면 Redis에서 자동으로 삭제된다.
  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  // 특정 패턴에 해당하는 캐시 키들을 찾아 삭제한다.
  // 예: posts:list:* 로 게시글 목록 캐시를 한 번에 무효화할 수 있다.
  async deleteByPattern(pattern: string): Promise<void> {
    // KEYS 명령은 키가 많을 때 Redis를 멈추게 할 수 있으므로,
    // SCAN 기반 stream으로 조금씩 순회한다.
    const stream = this.redis.scanStream({
      match: pattern,
      count: 100,
    });

    for await (const keys of stream) {
      const redisKeys = keys as string[];

      if (redisKeys.length > 0) {
        await this.redis.del(...redisKeys);
      }
    }
  }

  // Nest 애플리케이션이 종료될 때 Redis 연결을 정상적으로 닫는다.
  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
