import { join } from 'node:path';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CouponEvent } from '../coupons/entities/coupon-event.entity';
import { UserCoupon } from '../coupons/entities/user-coupon.entity';
import { User } from '../users/entities/user.entity';

// 지금은 테스트 DB 전용이다.
// 개발·운영 환경에서 잘못 실행하지 않도록 제한한다.
if (process.env.NODE_ENV !== 'test') {
  throw new Error(
    '이 마이그레이션 설정은 NODE_ENV=test에서만 사용할 수 있습니다.',
  );
}

export default new DataSource({
  type: 'postgres',

  // docker-compose.integration.yml의 테스트 전용 연결 정보
  // 실제 운영 계정이나 비밀번호를 여기에 넣지 않는다.
  host: '127.0.0.1',
  port: 55432,
  username: 'loop_test',
  password: 'loop_test_only',
  database: 'loop_integration_test',

  // 쿠폰의 소유자로 연결할 User부터 등록한다.
  // 쿠폰 엔티티를 만든 뒤 여기에 추가한다.
  // 마이그레이션에서 비교할 엔티티 목록
  entities: [User, CouponEvent, UserCoupon],

  // 나중에 만들 마이그레이션 파일의 위치
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],

  // 적용한 마이그레이션 이력을 기록할 테이블명
  migrationsTableName: 'coupon_migrations',

  // 연결만으로 테이블을 변경하거나 삭제하지 않는다.
  synchronize: false,
  dropSchema: false,

  // 마이그레이션은 명령어로 직접 실행한다.
  migrationsRun: false,

  extra: {
    connectionTimeoutMillis: 3000,
  },
});
