# 선착순 이벤트·한정 쿠폰 발급 — 설계와 단계별 구현

상태: **설계 단계 / 미구현**. 기준일: 2026-09-29.

이 문서는 현재 Loop 서버를 확인한 구현 계획이다. 쿠폰 코드·DB 테이블·API·테스트가 이미 존재하거나 검증됐다는 뜻이 아니다. 문서 단계에서는 패키지 설치, 서버 실행, DB 변경, 부하 테스트를 하지 않는다. 구현은 단계별로 검증한 뒤 진행한다.

## 1. 만들 기능과 학습 목표

관리자가 수량과 기간을 정한 이벤트를 만들고, 로그인한 사용자가 쿠폰 받기 버튼으로 참여한다. 같은 계정은 이벤트별로 한 장만 받을 수 있고, 많은 요청이 겹쳐도 정해진 수량을 넘겨 발급하지 않는다.

학습용 예시: **총 100장, 계정당 1장인 이벤트 쿠폰**. 1,000명이 참여해도 발급량은 최대 100장이다. 실제 돈·상품권·결제는 연결하지 않는다.

- 단순 CRUD와 다른 점: 마지막 한 장 경합, 중복 요청, 응답 유실, DB 장애에서도 발급 결과가 정확해야 한다.
- 선착순의 정의: DB에서 발급 조건을 통과해 커밋된 처리 순서다. 휴대폰 버튼 클릭 시각이나 네트워크 도착 순서의 엄격한 FIFO를 보장하지 않는다.
- 재시도는 새로운 참여가 아니다. 이미 발급됐다면 같은 쿠폰을 반환한다.
- 빠르게 실패하는 409/429 응답 수를 정상 발급 처리량으로 보고하지 않는다.

### 범위를 두 번으로 나눈다

| 구분       | 포함                                                                             | 완료 기준                                           |
| ---------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1차: 발급  | 관리자 이벤트 생성·활성/중지, 이벤트 조회, 내 쿠폰 발급·조회, 동시성·복구 테스트 | 초과/중복 발급 0건, 응답 유실 후 결과 확인 가능     |
| 후속: 사용 | 쿠폰을 포인트로 교환, 사용 이력·포인트 원장                                      | 중복 교환 0건, 출석과 동시 실행해도 포인트 유실 0건 |

1차 쿠폰은 발급·보관·만료 조회까지다. 포인트 지급이나 할인 적용은 하지 않으며 앱에도 사용할 수 있는 보상처럼 표시하지 않는다. 보상 종류·금액은 후속 단계에서 확정한다.

첫 단계부터 넣지 않는 것: Redis 재고 차감, 분산 락, 발급 대기 큐, SSE/WebSocket 잔여 수량 방송, FCM, 결제, 양도, 취소 후 재입고, 다계정 방지용 본인 인증. 필요성과 측정 결과가 생기면 별도 설계한다.

## 2. 현재 코드에서 확인한 출발점

아래 경로는 저장소 루트 기준이며 기존 파일이다.

| 위치                                                       | 현재 상태                                             | 이번 설계에 주는 제약                                             |
| ---------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| `src/users/entities/user.entity.ts`                        | 정수 `id`, 정수 `point`, 문자열 `role`                | 실제 컬럼명은 `point`; `points`가 아님                            |
| `src/users/services/users/users.service.ts`                | `addPoint()`가 조회·계산·save, `remove()`는 물리 삭제 | 기존 포인트 메서드를 쿠폰 교환 트랜잭션에 그대로 재사용하지 않음  |
| `src/attendance/services/attendance/attendance.service.ts` | 출석 저장과 포인트 지급이 별도 호출                   | 발급과 포인트 교환을 분리하는 이유                                |
| `src/upload/services/upload/upload.service.ts`             | 프로필 업로드 후 조회한 User를 save                   | 오래된 User 전체 저장도 포인트 갱신을 덮을 수 있어 후속 점검 필요 |
| `src/auth/strategies/jwt.strategy.ts`                      | 토큰에서 사용자 ID·role을 반환, DB 재조회 없음        | 삭제된 사용자·변경된 관리자 권한을 별도로 확인해야 함             |
| `src/common/decorators/current-user.decorator.ts`          | `@CurrentUser()`가 사용자 ID 숫자를 반환              | body의 userId를 신뢰하거나 받지 않음                              |
| `src/auth/guards/admin.guard.ts`                           | 토큰의 ADMIN 권한 확인                                | 신규 관리자 변경 작업은 DB의 현재 role도 확인                     |
| `src/app.module.ts`                                        | 엔티티 자동 탐색, 비운영 환경 synchronize 활성        | 엔티티 파일만 추가해도 재시작 시 DB 변경 가능                     |
| `src/config/throttler.config.ts`                           | 기본 60초 100회, 명시적 개발 부하 모드에서 해제       | 쿠폰 중복/재고 보장과 요청 제한은 서로 다른 문제                  |
| `test/integration/posts.integration-spec.ts`               | 실제 DB, 실행별 임시 스키마, 좁은 Nest 테스트 앱      | 쿠폰 통합 테스트의 격리 방식으로 재사용                           |

현재 별도 운영 migration DataSource·migration 스크립트는 없다. seed의 DataSource는 마이그레이션 체계를 대신하지 않는다. 현재 사용자 삭제는 관리자 `DELETE /users/:id`이며, 사용자 셀프 탈퇴가 구현됐다고 가정하지 않는다.

## 3. 기본 정책과 반드시 유지할 조건

### 3.1 발급 정책

1. 로그인한 **현재 존재하는 계정**만 참여한다. USER와 ADMIN 모두 계정당 한 장이다.
2. 이벤트는 생성 후 조회할 수 있지만 기본 `isActive=false`로 발급은 중지한다. 비공개 초안 기능은 1차 범위 밖이다.
3. 발급 조건은 `isActive && startsAt <= DB시각 < endsAt && issuedCount < totalQuantity`다.
4. 기간·수량·쿠폰 만료일은 생성 후 변경하지 않는다. 조건 변경은 새 이벤트로 만든다.
5. 관리자는 활성/중지를 변경할 수 있다. 재활성화해도 기존 기간·수량 조건을 그대로 적용한다.
6. 중지는 신규 발급만 막으며 이미 발급한 쿠폰을 회수하지 않는다. 중지 전에 처리된 발급을 소급 취소하지 않는다.
7. 기발급 계정의 재요청은 품절·기간 종료·중지 이후에도 기존 쿠폰을 반환한다. 쿠폰 자체가 만료됐다면 만료 상태로 반환한다.
8. 쿠폰 수량·시간·활성 상태를 앱 계산이나 Redis 값만으로 확정하지 않는다.

### 3.2 데이터 불변 조건

```text
0 <= issuedCount <= totalQuantity
issuedCount = 해당 이벤트의 보존된 user_coupons 행 수
각 (eventId, userId)의 발급 행 수 <= 1  (userId가 있는 계정 기준)
```

쿠폰 한 장 생성과 `issuedCount + 1`은 반드시 함께 커밋하거나 함께 롤백한다. 만료·계정 삭제로 수량을 복구하지 않는다. 발급 이후 쿠폰/이벤트 물리 삭제 API는 제공하지 않는다. 개별 행의 CHECK만으로 두 테이블 간 건수 일치까지 보장되지는 않으므로 트랜잭션·통합 테스트·대사로 함께 확인한다.

### 3.3 시간과 결과의 의미

- DB는 `timestamptz(3)`, API는 밀리초 정밀도 UTC ISO 8601을 사용한다. 화면만 사용자 시간대에 맞게 표시한다.
- 입력은 timezone offset 또는 `Z`가 있는 날짜만 허용하고 `startsAt < endsAt < couponExpiresAt`를 검증한다.
- 이벤트 잠금 획득 후 DB의 `date_trunc('milliseconds', clock_timestamp())`를 한 번 읽어 발급 자격과 `issuedAt`에 사용한다. 밀리초 단위를 일치시키며, 트랜잭션 시작 시각인 `now()`만 사용하면 잠금 대기 중 종료된 이벤트를 잘못 승인할 수 있다.
- 마감 직전 자격 검사를 통과한 트랜잭션은 마감 뒤 커밋돼도 발급 성공이다. 이 정책을 테스트한다.
- 응답 전에 반드시 커밋이 끝나야 한다. 네트워크 시간 초과는 발급 실패의 증거가 아니다.

### 3.4 계정 삭제

- 쿠폰의 `userId`는 nullable FK, `ON DELETE SET NULL`로 설계한다. 계정이 삭제돼도 쿠폰 행·발급 수량을 유지한다.
- 소유자가 없어진 쿠폰은 조회·사용·재배정할 수 없다. 개인정보를 보존하기 위한 이메일/이름 복사본을 만들지 않는다.
- 이벤트 FK는 `ON DELETE RESTRICT`로 보호한다. 기존 다른 엔티티의 CASCADE를 그대로 복사하지 않는다.
- 이 정책은 계정 ID별 1회다. 탈퇴·재가입을 포함한 동일인 1회 보장은 별도 본인 확인 정책 없이는 할 수 없다.
- 기록 보존 기간과 파기 시 집계 유지 방식은 운영 공개 전에 정한다. 이 문서는 영구 개인정보 보관을 승인하는 정책이 아니다.

## 4. 구조와 DB 설계

```text
Flutter / Swagger
  → JWT 인증·DTO 검증
  → Controller → Service → Repository → PostgreSQL
                            └ 동일 트랜잭션의 manager 사용
```

기존 NestJS·TypeORM·PostgreSQL로 시작한다. 새 메시지 브로커나 락 패키지는 필요하지 않다. Redis는 발급 결과의 원본 저장소가 아니며, BullMQ 작업 완료를 기다려서 발급 성공을 결정하지 않는다.

### coupon_events — 이벤트 자체

| 필드                  | 타입/조건                | 설명                                |
| --------------------- | ------------------------ | ----------------------------------- |
| id                    | integer PK               | 기존 사용자 ID와 같은 API 숫자 정책 |
| title                 | varchar(100), NOT NULL   | 이벤트명                            |
| totalQuantity         | integer, 양수            | 발급 가능한 총량                    |
| issuedCount           | integer, default 0       | 커밋된 누적 발급량                  |
| startsAt / endsAt     | timestamptz(3), NOT NULL | 신규 발급 기간                      |
| couponExpiresAt       | timestamptz(3), NOT NULL | 쿠폰 자체의 만료일                  |
| isActive              | boolean, default false   | 신규 발급 허용 스위치               |
| createdAt / updatedAt | timestamptz(3)           | 기록 시각                           |

DB CHECK: `totalQuantity > 0`, `issuedCount >= 0`, `issuedCount <= totalQuantity`, `startsAt < endsAt`, `endsAt < couponExpiresAt`. DTO에서도 동일한 검증과 운영 상한을 둔다. 예시 상한은 100,000장으로 시작하되 운영 처리 능력을 증명하는 값은 아니다.

### user_coupons — 실제 발급한 쿠폰

| 필드      | 타입/조건                | 설명                               |
| --------- | ------------------------ | ---------------------------------- |
| id        | integer PK               | 쿠폰 식별자; 비밀 교환 코드가 아님 |
| eventId   | integer FK, NOT NULL     | 어떤 이벤트에서 받았는가           |
| userId    | integer FK, nullable     | 현재 소유 계정; 삭제 시 NULL       |
| issuedAt  | timestamptz(3), NOT NULL | 발급 자격 통과 시각                |
| expiresAt | timestamptz(3), NOT NULL | 이벤트의 만료일을 발급 시 복사     |

- DB UNIQUE `(eventId, userId)`로 계정별 중복을 방어한다. 이름을 지정해 특정 제약 위반만 식별한다.
- `expiresAt > issuedAt` CHECK를 둔다. `ISSUED / EXPIRED`는 조회 시 DB 시각으로 계산하고, 만료 상태를 바꾸는 크론은 처음부터 만들지 않는다.
- 내 쿠폰 목록 인덱스: `(userId, issuedAt DESC, id DESC)`.
- 이벤트 목록 인덱스: `(createdAt DESC, id DESC)`. 조회 패턴과 EXPLAIN으로 추가 인덱스 필요성을 판단한다.
- FK·유니크·CHECK·인덱스가 실제 DB에 생성됐는지 검증한다. 엔티티에 적힌 것만으로 완료 처리하지 않는다.

## 5. API 계약 — 구현 예정

모든 사용자 쿠폰 API는 JWT가 필요하며 응답은 `Cache-Control: private, no-store`로 시작한다. 사용자 쿠폰 정보를 공용 게시글 캐시에 섞지 않는다.

| 메서드 | 경로                                       | 권한   | 결과                                           |
| ------ | ------------------------------------------ | ------ | ---------------------------------------------- |
| POST   | `/admin/coupon-events`                     | ADMIN  | 이벤트 생성, 201, 기본 발급 비활성             |
| PATCH  | `/admin/coupon-events/:eventId/activation` | ADMIN  | `{ isActive: boolean }` 변경, 200              |
| GET    | `/coupon-events?limit=20&cursor=...`       | 로그인 | 이벤트 최신순 목록                             |
| GET    | `/coupon-events/:eventId`                  | 로그인 | 이벤트 조건, 잔여량 스냅샷, serverTime         |
| PUT    | `/coupon-events/:eventId/my-coupon`        | 로그인 | 본인 쿠폰 최초 발급 201 / 기존 쿠폰 반환 200   |
| GET    | `/coupon-events/:eventId/my-coupon`        | 로그인 | 응답 유실 시 본인 발급 결과 재조회, 없으면 404 |
| GET    | `/coupons/me?limit=20&cursor=...`          | 로그인 | 본인 쿠폰 발급 최신순 목록                     |

- PUT의 대상은 해당 이벤트에서 **나에게 속한 한 장**이다. body의 사용자 ID·수량·발급 수·발급 시각은 받지 않는다. body는 생략 또는 빈 객체만 허용하며 다른 필드는 400으로 거부한다.
- 멱등성은 `(eventId, authenticatedUserId)`라는 업무 키로 보장한다. 이 고정 의미의 요청에 별도 `Idempotency-Key` 저장소를 먼저 만들지 않는다. 이후 다른 payload나 결제를 추가하면 계약을 다시 설계한다.
- 최초/재요청 응답 코드는 달라도 추가 발급 효과는 같다. 응답 쿠폰에는 `id, eventId, eventTitle, issuedAt, expiresAt, status`를 담고, 공통 `serverTime`을 제공한다.
- 이벤트 `remainingQuantity`는 조회 시점 참고 값이다. 화면에 1장이 보여도 다른 요청이 먼저 발급받으면 실패할 수 있다.
- 커서는 이벤트 `(createdAt, id)`, 쿠폰 `(issuedAt, id)`의 내림차순으로 사용한다. 기본 limit 20, 최대 50, `limit + 1` 조회 후 `items / nextCursor / hasNext`를 반환한다.
- DTO는 요청과 응답을 분리한다. 양의 PostgreSQL integer 범위 ID, limit, 커서 형식, 제목 trim/길이, 날짜 순서, 명시적 boolean을 검증한다. 문자열 `"false"`를 truthy boolean으로 변환하지 않는다.
- 기존 `createValidationPipe()`와 `@CurrentUser()`를 재사용한다. 엔티티 전체나 SQL 오류를 그대로 응답하지 않는다.
- 발급 PUT의 멱등성이 관리자 생성 POST까지 보장하는 것은 아니다. 생성 응답 유실 시 자동 재생성하지 않고 이벤트 목록으로 먼저 확인한다. 관리자 생성 재시도를 지원할 때는 별도 요청 키를 설계한다.

### 오류와 재시도 계약

| HTTP | code 예시                                                               | 앱 처리                                         |
| ---- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| 400  | `INVALID_COUPON_REQUEST`                                                | 입력 수정; 자동 재시도 안 함                    |
| 401  | `UNAUTHORIZED`                                                          | 로그인/기존 토큰 갱신 흐름; 삭제된 계정도 거부  |
| 403  | `ADMIN_REQUIRED`                                                        | 관리자 작업 중단                                |
| 404  | `EVENT_NOT_FOUND`, `MY_COUPON_NOT_FOUND`                                | 없는 이벤트 / 아직 확인되는 쿠폰 없음           |
| 409  | `EVENT_DISABLED`, `EVENT_NOT_STARTED`, `EVENT_ENDED`, `COUPON_SOLD_OUT` | 원인별 안내, 요청 폭주 재시도 금지              |
| 429  | `RATE_LIMITED`                                                          | Retry-After를 따름; 재고 소진으로 표시하지 않음 |
| 503  | `COUPON_TEMPORARILY_UNAVAILABLE`                                        | 제한적 재시도와 발급 여부 조회                  |

현재 공통 오류 래퍼는 없다. 위 code는 신규 쿠폰 API의 목표 계약이며 기존 모든 API 오류 형식을 바꾸지 않는다. Guard/ValidationPipe/Throttler 오류도 이 계약으로 변환하려면 쿠폰 범위 필터/어댑터를 구현·테스트한다. HTTP status와 code를 함께 해석하고, 예상하지 못한 오류는 일반 500으로 처리한다.

동시에 여러 조건이 실패하면 기존 쿠폰 확인이 우선이다. 미발급 사용자에게는 비활성 → 시작 전 → 종료 → 품절 순서로 판단한다. 단, 429/인증 실패는 서비스 진입 전에 발생할 수 있다.

## 6. 중복·초과 발급을 막는 트랜잭션

Service가 `DataSource.transaction('READ COMMITTED', ...)` 경계를 소유한다. Repository의 모든 읽기·쓰기 메서드는 해당 `EntityManager`를 전달받는다. 트랜잭션 밖에서 주입받은 Repository로 일부 작업을 실행하지 않는다.

### 순서

1. 트랜잭션 안에서 사용자 존재를 확인하고 `FOR KEY SHARE`로 삭제와의 경합을 제어한다. 없는 사용자는 401이다.
2. 이벤트 행을 `SELECT ... FOR UPDATE`로 잠근다. 없으면 404다.
3. 같은 계정의 기존 쿠폰을 조회한다. 있으면 수량을 바꾸지 않고 반환한다.
4. 잠금 획득 후 DB 시각을 읽고 활성·기간·재고를 검증한다.
5. 쿠폰 INSERT와 이벤트 `issuedCount + 1`을 같은 트랜잭션으로 실행한다.
6. 커밋 성공 후 응답한다. 어느 단계든 실패하면 두 변경 모두 롤백한다.

락 획득 순서는 **사용자 → 이벤트 → 쿠폰**을 기본으로 한다. 이벤트 상태를 바꾸는 관리자도 먼저 관리자 계정/현재 권한을 확인하고 같은 이벤트 행을 잠근다. 계정 삭제와 후속 쿠폰 사용까지 고려해 잠금 순서를 일관되게 유지한다. 역할 변경까지 잠금으로 보호해야 하는 관리자 검사는 읽은 role의 변경을 막는 잠금 모드를 별도로 적용한다.

### 왜 이렇게 하는가

- 이벤트별로 재고를 확인하는 구간을 직렬화해 마지막 한 장을 동시에 두 명에게 발급하지 않는다.
- 유니크 제약은 누락된 코드 경로가 생겨도 중복 행을 막는 마지막 방어선이다.
- 프로세스 메모리의 boolean/Set은 서버가 여러 개면 공유되지 않는다. 버튼 비활성화도 서버의 보장을 대신하지 않는다.
- FCM·Redis·외부 HTTP·파일 업로드를 잠금 보유 구간에서 실행하지 않는다. 트랜잭션을 짧게 유지한다.
- DB 트랜잭션/행 잠금 동작과 TypeORM manager 사용 규칙은 [PostgreSQL](https://www.postgresql.org/docs/16/explicit-locking.html), [TypeORM](https://typeorm.io/docs/advanced-topics/transactions/) 공식 문서를 기준으로 한다.

### 재시도·장애 복구

- 교착상태 `40P01`, 직렬화 실패 `40001` 등 재시도 가능한 오류만 전체 트랜잭션 단위로 최대 2회 추가 재시도한다. 짧은 지수 백오프·jitter·전체 시간 예산을 둔다.
- 잠금/문장/풀 대기는 무제한으로 두지 않는다. 테스트 시작값으로 lock 1초, statement 3초, HTTP 처리 예산 5초를 검토하되 중첩 재시도로 예산을 초과하지 않게 한다. 운영값은 측정 후 확정한다.
- 설정은 가능하면 트랜잭션 로컬 범위로 적용해 커넥션 풀의 다음 요청에 유출하지 않는다. HTTP 연결을 닫는 것만으로 DB 쿼리가 취소됐다고 가정하지 않는다.
- UNIQUE 오류가 나면 실패한 트랜잭션을 먼저 롤백한다. **지정한 중복 발급 제약**인 경우에만 새 트랜잭션에서 기발급 쿠폰을 확인한다. 모든 DB 오류를 중복/품절로 감추지 않는다.
- 커밋 후 응답 유실: 같은 PUT 또는 본인 쿠폰 GET으로 확인한다. GET이 잠시 404여도 이전 요청이 아직 진행 중일 수 있으므로 실패 확정으로 처리하지 않는다.
- 앱 자동 재시도는 유한하게 제한하고 계정이 바뀌면 중단한다. 운영자도 응답이 불명확하다고 수동 추가 발급하지 않는다.

## 7. 수량 보장과 트래픽 처리는 별개

이 설계는 여러 서버 인스턴스가 같은 PostgreSQL을 사용할 때도 같은 이벤트 행을 통해 조정한다. 하지만 한 이벤트의 발급이 직렬화되므로 **무제한 처리량 또는 수백만 동시 요청 대응을 보장하지 않는다**.

먼저 측정할 것: 정상 신규 발급/초, 기발급 재조회/초, p95/p99, 이벤트 락 대기, DB 풀 대기, CPU, DB 연결 수, 오류·타임아웃·대사 불일치.

- 기존 Throttler의 기본 식별은 IP 기준이다. 같은 Wi-Fi 사용자를 한 명으로 볼 수 있으므로 행사 참여에는 인증된 계정 기준 제한과 IP/진입단 제한을 분리 검토한다. 글로벌 Guard 실행 순서상 아직 `request.user`가 없을 수 있으므로 계정별 제한의 실행 위치도 테스트한다.
- 인스턴스별 메모리 rate limit은 전체 서버 합산 제한이 아니다. 수평 확장 전에 공유 저장소/게이트웨이 정책을 정한다. 클라이언트가 보내는 userId로 제한 키를 만들지 않는다.
- 처리 가능 범위를 넘으면 대기 시간을 무한정 늘리기보다 429/503으로 제어하고 Retry-After를 안내한다.
- Redis는 이후 이벤트 설명 캐시·공유 rate limit 등에 도입할 수 있다. 캐시의 잔여 수량으로 발급 확정하지 않는다.
- 큐가 필요해지면 요청 접수(202)와 발급 확정을 분리하고 대기열 순서·중복 소비·DB 커밋 후 워커 장애까지 다시 설계한다. 기존 동기 API에 큐만 붙여 성공 의미를 바꾸지 않는다.
- 발급 후 알림의 확실한 전달이 필요할 때는 DB outbox를 별도 도입한다. DB 커밋 후 단순 enqueue 실패를 발급 실패로 되돌려 응답하지 않는다.

관측 지표에 userId·couponId를 label로 넣지 않는다. 이벤트도 무제한 고유 ID label을 만들지 않는다. 구조화 로그는 correlation ID·결과·지연 위주이며 JWT·이메일·쿠폰 비밀값을 남기지 않는다. 관리자 생성/활성 변경은 누가 무엇을 언제 바꿨는지 감사 기록을 남기는 운영 기준을 정한다.

## 8. 파일 배치 — 전부 신규 예정

```text
src/coupons/
  coupons.module.ts
  entities/
    coupon-event.entity.ts
    user-coupon.entity.ts
  repositories/
    coupon-events.repository.ts
    user-coupons.repository.ts
  services/
    coupon-events.service.ts
    coupon-claims.service.ts
  controllers/
    coupon-events.controller.ts
    my-coupons.controller.ts
  dto/
    create-coupon-event.dto.ts
    update-coupon-event-activation.dto.ts
    get-coupon-events-query.dto.ts
    get-my-coupons-query.dto.ts
    coupon-event-response.dto.ts
    coupon-event-list-page.dto.ts
    user-coupon-response.dto.ts
    user-coupon-list-page.dto.ts

src/admin/controllers/admin-coupon-events.controller.ts
src/database/data-source.ts
src/database/migrations/<timestamp>-CreateCouponTables.ts
test/integration/coupons.integration-spec.ts
```

- 사용자 Controller와 Repository는 CouponsModule이 소유한다. `TypeOrmModule.forFeature([CouponEvent, UserCoupon, User])`를 연결한다.
- 관리자 Controller는 기존 AdminModule이 소유하며, AdminModule은 CouponsModule의 이벤트 관리 Service를 import해서 사용한다. 같은 Controller를 두 모듈에 중복 등록하지 않는다.
- AppModule에 CouponsModule을 연결한다. 기존 출석·게시글 모듈의 동작은 발급 단계에서 변경하지 않는다.
- 별도 추상 Repository 인터페이스와 구현 클래스를 의무적으로 둘로 늘리지는 않는다. Repository는 DB 접근, Service는 정책·트랜잭션 조합, Controller는 HTTP 계약을 담당한다.

## 9. 단계별 작업 순서와 완료 기준

### 1단계 — 격리된 DB와 마이그레이션 준비

- 현재 실행 중인 감시 서버와 연결 DB를 확인한다. 엔티티 자동 탐색·synchronize가 개발 데이터를 바꾸지 않게 새 엔티티 작성 전에 실행 환경부터 격리한다.
- migration용 DataSource와 명시적인 환경 선택을 준비한다. 기존 운영/개발 사용자 데이터에서 시험하지 않는다.
- 현재 설정은 비운영 환경에서 `DB_SYNC=false`만 넣어도 synchronize가 꺼지는 구조가 아니다. 이를 확인하고 자동 동기화와 migration이 충돌하지 않는 설정으로 정리한다.
- 배포 DB는 `synchronize:false`, 명시적인 migration 실행을 원칙으로 한다. 기존 users 등의 스키마 기준선이 없는 새 DB와 기존 DB를 구분해 적용 절차를 만든다.
- 완료: 테스트 DB 식별·연결 확인, 자동 동기화 비활성 확인, migration 실행/조회 체계 확보. 쿠폰 테이블은 아직 만들지 않아도 된다.

### 2단계 — 엔티티와 실제 DB 제약

- 두 Entity와 migration을 작성한다. 기존 users 스키마의 FK 타입과 맞춘다.
- 자동 생성 SQL에 기존 테이블 삭제/불필요한 변경이 섞이지 않았는지 검토한다.
- 격리 DB에 적용하고 UNIQUE/CHECK/FK/인덱스를 직접 확인한다. invalid 수량·기간·중복 행이 DB에서도 거부되는지 확인한다.
- 완료: 테이블 생성과 제약 검증. 운영 rollback에 DROP을 바로 사용하지 않는다. 실제 발급 이력이 생긴 뒤에는 기능 중지와 forward migration을 우선한다.

### 3단계 — DTO·Module·Repository

- 요청/응답 모델, 안전한 ID·커서 검증, 모듈 DI를 구성한다.
- Repository의 트랜잭션 메서드에 manager를 명시적으로 전달한다. 이벤트 잠금, 계정 확인, 기존 쿠폰 조회, 발급 저장 기능을 나눈다.
- 완료: 타입 검사·단위 테스트·DI 생성 성공. HTTP로 발급할 단계는 아니다.

### 4단계 — 관리자 이벤트 생성·활성화

- 관리자 API를 연결하고 JWT+AdminGuard 및 현재 DB 권한을 검사한다.
- Swagger에서 테스트 이벤트를 기본 비활성으로 만들고 활성/중지를 확인한다.
- 완료: 일반 계정 거부, 잘못된 수량/기간 거부, 허용되지 않은 재고 수정 거부. 같은 PATCH 반복도 발급 수량을 바꾸지 않는다.

### 5단계 — 발급 트랜잭션과 API

- 6절의 순서대로 쿠폰 발급 Service와 PUT API를 연결한다.
- 중간 실패 롤백·기발급 반환·삭제된 사용자·중지/기간/품절 처리를 포함한다.
- 완료: 한 사용자 반복 요청에 같은 쿠폰 ID와 한 번의 수량 증가. 한 번 눌러 성공한 것만으로 동시성 완료로 판단하지 않는다.

### 6단계 — 이벤트·내 쿠폰 조회와 복구

- 상세·커서 목록·본인 쿠폰 재조회를 구현한다. 다른 계정의 쿠폰은 노출하지 않는다.
- 같은 발급 시각을 가진 데이터에서도 커서 중복/누락 없이 순회한다. 사용자 목록은 인증 ID를 항상 조건에 포함한다.
- 완료: 발급 후 응답 유실을 재현해 재조회/동일 PUT으로 같은 결과를 확인한다.

### 7단계 — 실제 PostgreSQL 동시성·HTTP 통합 테스트

- 아래 10절 시나리오를 구현한다. Mock Repository 테스트만으로 락/트랜잭션을 검증했다고 하지 않는다.
- 완료: 재고·중복·원자성·권한·시간 경계·삭제 경합을 DB 최종 상태로 확인한다.

### 8단계 — 제한된 부하와 과부하 복구

- 여러 사용자로 신규 발급 부하를 만들고, 동일 사용자 재요청 부하는 별도 측정한다.
- 요청 제한이 켜진 보호 테스트와 격리 환경의 처리 성능 테스트를 나눈다.
- 완료: 부하별 p95/p99, 처리량, DB 대기와 정합성 대사 결과 기록. 이때 필요한 최적화만 결정한다.

### 9단계 — Flutter 연결

- 서버 계약 안정화 후 `/Volumes/T7/loop/lib/src/features/coupons/`에 기존 앱 구조에 맞춘 model → datasource → repository → usecase → notifier/state → 화면 순서로 연결한다.
- 이벤트 목록·상세·쿠폰 받기·내 쿠폰함을 만든다. 진입 메뉴/라우터 위치는 앱 문서와 현재 파일을 확인한 뒤 확정한다.
- 네트워크 오류를 곧바로 실패로 표시하지 않고 `결과 확인 중` 상태에서 본인 쿠폰을 조회한다. 발급 완료 전에는 성공 애니메이션이나 잔고 증가를 확정하지 않는다.
- 중복 탭은 막되 서버 멱등성은 유지한다. 타이머는 화면 표시용이고 발급 가능 여부는 서버가 판정한다.
- 화면 dispose/계정 전환 후 이전 응답 무시, 401·409·429·503 문구 ARB 분리, 큰 글씨·테마·뒤로 가기·앱 재시작 복구를 검증한다.
- 완료: 정상 발급뿐 아니라 요청 중 종료/재진입과 로그인 변경 후에도 다른 계정 결과가 섞이지 않는다.

### 10단계 — 관리자 웹과 운영 준비

- 먼저 Swagger로 검증한다. 관리자 웹 UI는 후속으로 기존 BFF·HttpOnly 쿠키·권한·반응형 구조에 맞춘다.
- 이벤트 목록·생성·발급 중지·재고/발급량 조회만 제공하고 직접 카운트 수정 UI는 만들지 않는다.
- migration 사전 적용, 기능 기본 중지, 소량 공개, 감사 기록, 불일치 경보·중단 절차를 확인한다.
- 완료: 장애 시 신규 발급 중지 → 처리 중 트랜잭션 종료 확인 → 건수 대사 → 원인 해결 → 재개 순서를 수행할 수 있다.

## 10. 테스트와 완료 판정

### 환경

기존 [PostgreSQL·Redis 통합 테스트 가이드](posts-integration-test.md)의 격리를 사용한다.

- `docker-compose.integration.yml`의 PostgreSQL `127.0.0.1:55432`와 `loop_integration_test`만 사용한다.
- 쿠폰 테스트마다 무작위 스키마를 만들며 User/CouponEvent/UserCoupon만 필요한 기준선과 migration으로 준비한다. 쿠폰 제약을 synchronize만으로 검증하지 않는다.
- AppModule·실제 환경변수·FCM·OpenAI·S3를 로드하지 않는다. 인증과 공통 ValidationPipe는 실제 구현을 사용한다.
- 기본 쿠폰 발급에는 Redis가 필요 없다. 기존 Compose가 Redis도 띄우더라도 쿠폰 재고를 Redis에 저장하지 않는다.
- timeout을 이유로 테스트를 skip하지 않는다. 테스트 앱·모든 DataSource·컨테이너를 성공/실패 모두 정리하고 개발 DB는 초기화하지 않는다.

테스트 파일 구현 후 사용할 **기존 명령**:

```bash
npm run test:integration:up
npm run test:integration -- --runTestsByPath test/integration/coupons.integration-spec.ts
npm run test:integration:down
```

현재 쿠폰 테스트 파일은 없으므로 지금 실행해도 쿠폰 검증은 되지 않는다. 테스트가 실패해도 마지막 종료 명령은 별도로 실행한다. 새 부하 스크립트나 migration 명령은 실제로 추가한 뒤 정확한 실행법을 기록한다.

### 반드시 검증할 시나리오

| 시나리오                                               | 기대 결과                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| 수량 100 / 서로 다른 사용자 300명, 동시성 상한 50      | 장애 없는 조건에서 고유 발급 100개, 나머지는 품절, 초과 0       |
| 마지막 1장에 서로 다른 사용자 20명 경합                | 신규 쿠폰 정확히 1개                                            |
| 같은 계정 동시 요청 20개                               | 하나의 쿠폰 ID, issuedCount 1 증가; 재응답도 성공일 수 있음     |
| 서버 인스턴스 2개·서로 다른 DB 풀에서 같은 이벤트 접근 | 단일 프로세스와 같은 정합성 유지                                |
| 쿠폰 INSERT 직후/카운트 변경 후 강제 예외              | 쿠폰과 카운트 모두 롤백; 테스트 전용 주입 지점만 사용           |
| 서버 저장 후 클라이언트 응답 수신 차단                 | 조회/재요청으로 같은 쿠폰 확인; 새 쿠폰 없음                    |
| 시작 전·시작 일치·종료 일치·잠금 대기 중 종료          | `[startsAt, endsAt)`와 자격 판정 시각 정책 일치                 |
| 발급 중 관리자 중지                                    | 동일 이벤트 잠금 순서대로 결과 결정; 기존 발급 취소 없음        |
| 계정 삭제와 발급 경합                                  | 사용자 존재 조건에 따라 성공/거부, 고아 FK 없음, 보존 수량 불변 |
| 같은 이벤트 발급자 두 명 삭제                          | userId가 NULL인 두 행을 정상 보존, 발급 수량 유지               |
| 품절/종료/중지 후 기존 발급자 재요청                   | 같은 쿠폰 반환, 카운트 불변                                     |
| 무인증·만료·refresh 토큰·userId 위조·관리자 강등       | 권한/검증 계약대로 거부, DB 변화 없음                           |
| 락 대기 제한·DB 연결 장애·풀 포화                      | 안전한 오류, 무한 대기/무한 재시도 없음                         |

동시성 테스트는 실제 여러 연결과 짧은 대기 barrier로 겹치는 실행을 만든다. 같은 연결에서 순차 호출한 뒤 동시성 검증이라고 부르지 않는다. 시간 경계 테스트는 큰 sleep 대신 테스트용 clock/통제된 잠금으로 재현하되 DB 시간 사용 자체도 실제 PostgreSQL에서 검증한다.

### 최종 데이터 대사

요청 전송 중단 후 진행 중 요청·DB 트랜잭션이 끝난 것을 확인하고 다음을 조회한다.

1. 각 이벤트 `issuedCount`와 `user_coupons` 전체 행 수가 같은가? 삭제된 사용자로 인해 userId가 NULL인 행도 포함한다.
2. `issuedCount > totalQuantity`, 음수 재고가 0건인가? `(eventId, userId)` 중복 검사는 `WHERE userId IS NOT NULL`인 행만 대상으로 한다. 같은 이벤트의 NULL 소유자 행 여러 개는 정상이다.
3. 기발급 재요청의 쿠폰 ID가 바뀌지 않았는가?
4. 시간 초과·연결 종료 요청의 실제 결과를 DB와 본인 조회 API로 확인했는가?

HTTP 2xx 수에는 같은 쿠폰을 반환한 재요청도 들어간다. 성공 응답 개수를 신규 발급 건수로 해석하지 않는다. 장애가 있는 시험에서 100장 미만 발급은 가능하지만, 원인과 미확정 요청을 모두 분류해야 한다.

### 부하 진행과 기록

- 전용 테스트 계정·이벤트만 사용하고 실제 보상·푸시를 연결하지 않는다. 토큰은 사전 생성해 로그인 부하와 발급 부하를 분리한다.
- 신규 발급은 사용자별로 다른 토큰을 사용한다. autocannon에 동일 JWT 하나를 넣고 반복하면 대부분 기발급 조회 성능만 측정하게 된다.
- 동시성 10 → 25 → 50으로 작은 단계부터 진행하고 각 회차에 새 이벤트/데이터를 준비한다. 수치 증가는 검증 후 결정한다.
- 정상 발급 201, 재응답 200, 업무 거절 409, 보호 거절 429, 시스템 오류 5xx, 네트워크 오류를 분리 집계한다.
- 1건이라도 초과/중복/불일치가 생기거나 DB 풀 고갈·지속 오류가 생기면 중단한다. RPS를 높이기 위해 정합성 검증을 제거하지 않는다.
- 기록: 커밋, Node/DB 버전, 장비, 인스턴스 수, DB 풀 크기, 사용자/재고/요청 수, 동시성, 요청 제한 상태, 지연 백분위, DB 대기, 대사 결과, 복구 시간.
- CI의 기존 unit test 성공은 쿠폰 통합 테스트 성공과 다르다. 전용 PostgreSQL 준비·migration 적용·테스트·종료를 CI에 별도로 연결한다.

## 11. 후속 포인트 교환의 선행 조건

포인트 교환은 쿠폰 발급이 검증된 다음 별도 단계로 구현한다.

1. 기존 `UsersService.addPoint()`의 read-modify-save를 원자적 증가 방식으로 전환한다.
2. 출석 기록·보상·포인트 변경을 같은 트랜잭션으로 묶고 모든 User 저장 경로를 점검한다. 프로필 변경도 오래된 point를 함께 save하지 않도록 필요한 컬럼만 수정한다.
3. 포인트 원장을 추가한다. 쿠폰 ID 등 업무 키에 UNIQUE를 두고 원장·잔액·쿠폰 사용 상태가 함께 커밋되게 한다. 기존 point 잔액은 시작 잔액으로 대사하는 이행 계획이 필요하다.
4. 사용자 → 쿠폰 순서로 잠금을 획득해 계정 삭제와 역순 교착을 줄인다. 이미 사용한 쿠폰은 동일 결과를 반환하고 재지급하지 않는다.
5. 쿠폰 사용 시 소유자·만료·보상 정책을 서버에서 확인한다. 클라이언트가 보상 금액을 결정하지 못하게 한다. 기존 integer 잔액의 범위 초과도 검증한다.
6. 출석+쿠폰 교환+프로필 변경+중복 교환을 동시에 실행한 실제 DB 테스트로 잔액과 원장을 대조한다.

쿠폰 교환만 안전하게 만들고 기존 포인트 쓰기를 남겨두면 잔액 유실이 발생할 수 있다. 이 선행 조건이 끝나기 전에는 사용/포인트 지급 버튼을 공개하지 않는다.

## 12. 진행 체크리스트

- [x] 기존 코드 확인 및 문서 설계
- [ ] 격리 DB·마이그레이션 체계
- [ ] 이벤트·쿠폰 엔티티와 DB 제약
- [ ] DTO·Module·Repository
- [ ] 관리자 생성·활성/중지
- [ ] 멱등 발급 트랜잭션
- [ ] 이벤트·내 쿠폰 조회·복구
- [ ] 실제 DB 동시성·권한·롤백 테스트
- [ ] 제한된 부하와 최종 데이터 대사
- [ ] Flutter 이벤트·쿠폰함 연결
- [ ] 관리자 웹·운영 중단/복구 절차
- [ ] 후속 포인트 교환 설계·기존 지급 경로 정리

## 13. 관련 문서와 공식 자료

- [서버 작업 안내](../server.md), [운영 학습 로드맵](production-operations-roadmap.md): 전체 학습 순서와 관측·장애 복구 연결.
- [게시글 부하 테스트](posts-load-test.md): 환경 격리·지표 기록 방식 참고. 읽기 부하 명령을 쿠폰 발급 검증에 그대로 사용하지 않는다.
- [PostgreSQL 16 행 잠금·교착상태](https://www.postgresql.org/docs/16/explicit-locking.html)
- [PostgreSQL 16 제약·외래키](https://www.postgresql.org/docs/16/ddl-constraints.html)
- [PostgreSQL 16 현재 시각 함수](https://www.postgresql.org/docs/16/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT)
- [TypeORM 트랜잭션](https://typeorm.io/docs/advanced-topics/transactions/), [마이그레이션](https://typeorm.io/docs/advanced-topics/migrations/)
- [NestJS 요청 제한](https://docs.nestjs.com/security/rate-limiting)

구현 시점에는 설치된 버전과 공식 API를 다시 확인한다. 이 설계는 Loop의 첫 구현을 위한 선택이며 모든 서비스에 같은 잠금·수량·시간 제한값이 적합하다는 뜻은 아니다.
