import { config } from 'dotenv';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CreateCouponTables1790656113575 } from './migrations/1790656113575-CreateCouponTables';
import { CreateUserBlocks1793073086784 } from './migrations/1793073086784-CreateUserBlocks';

// 개발용 명령으로 실행했는지 먼저 확인한다.
if (process.env.NODE_ENV !== 'development') {
  throw new Error('개발 환경에서만 실행할 수 있습니다.');
}

// NestJS와 같은 개발 환경변수를 읽는다.
config({ path: '.env.development' });

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`환경변수 ${name}이 필요합니다.`);
  }

  return value;
}

export default new DataSource({
  type: 'postgres',
  host: requiredEnv('DB_HOST'),
  port: Number(requiredEnv('DB_PORT')),
  username: requiredEnv('DB_USER'),
  password: requiredEnv('DB_PASSWORD'),
  database: requiredEnv('DB_NAME'),

  // 이미 작성된 SQL 실행 전용이므로 엔티티 비교는 하지 않는다.
  entities: [],

  // 테스트용 users 생성은 제외하고 쿠폰 테이블만 등록한다.
  migrations: [CreateCouponTables1790656113575, CreateUserBlocks1793073086784],
  migrationsTableName: 'coupon_migrations',

  synchronize: false,
  dropSchema: false,
  migrationsRun: false,

  extra: {
    connectionTimeoutMillis: 3000,
  },
});
