# 게시글 DB·Redis 통합 테스트

## 목적과 범위

단위 테스트의 가짜 저장소 대신 실제 PostgreSQL과 Redis를 사용한다.
실제 PostsService, TypeORM Repository, CacheService를 실행한다.
AI와 알림 큐는 이번 검증 대상이 아니므로 mock으로 대체한다.
HTTP 인증·권한·요청 검증, 운영 마이그레이션, 동시 요청 성능은 별도 테스트 대상이다.

## 격리 방식

- `docker-compose.integration.yml`: 개발용 Compose와 다른 `loop-integration` 프로젝트.
- PostgreSQL: `127.0.0.1:55432`, DB 이름 `loop_integration_test`.
- Redis: `127.0.0.1:56379`, 테스트 전용 인스턴스.
- `.env.development`, `.env.production`, AppModule은 불러오지 않는다.
- PostgreSQL은 실행별 무작위 스키마에 User/Post 테이블을 만들고 종료 시 해당 스키마만 제거한다.
- Redis의 `posts:list:*` 키는 테스트마다 삭제하므로 반드시 테스트 전용 인스턴스만 사용한다.
- 두 컨테이너는 tmpfs를 사용하며 기존 개발 데이터 볼륨을 공유하지 않는다.
- 연결 주소를 개발/운영 주소로 바꾸지 않는다. 같은 포트를 사용하는 테스트를 동시에 실행하지 않는다.

## 실행 순서

Docker Desktop이 실행된 상태에서 프로젝트 루트에서 실행한다.

```bash
# 테스트 전용 컨테이너 실행 및 healthcheck 대기
npm run test:integration:up

# 실제 DB·Redis 통합 테스트 6개 실행
npm run test:integration

# 성공/실패 여부와 관계없이 테스트 종료 후 실행
npm run test:integration:down
```

첫 실행은 Docker 이미지 다운로드가 필요할 수 있다.
연결 오류가 나면 테스트를 건너뛰지 않고 실패한다. 컨테이너 상태와 포트 충돌을 확인한다.
`down`은 이 전용 Compose 프로젝트만 종료하며 일반 개발 컨테이너에는 적용하지 않는다.

## 검증 항목

1. 캐시 미적중 시 실제 SQL 조회 결과와 10초 TTL 저장.
2. 캐시 적중 시 SQL 생략, 미적중 때와 동일한 JSON 응답.
3. 동일 작성 시각을 포함한 45개 게시글을 20/20/5개로 중복·누락 없이 조회.
4. 빈 테이블에서 빈 마지막 페이지 반환.
5. 게시글 수정 후 기존 캐시 제거 및 최신 제목 재조회.
6. 짧은 TTL로 Redis의 실제 만료 동작 검증.

현재 데이터가 변하지 않는 조건의 페이지 순회를 검증한다.
조회 중 게시글 작성·삭제가 발생하는 동시성 시나리오와 처리량은 아직 검증하지 않는다.
TTL 테스트는 가짜 타이머가 아니라 실제 시간을 사용한다.
캐시 저장 시 Date가 문자열이 되므로 비교는 HTTP 응답 형태인 JSON 기준으로 한다.

## 기존 테스트와의 관계

`npm test`는 기존 단위 테스트만 실행한다.
통합 테스트는 `test/integration`에 분리했으며 기존 CI에는 자동 추가하지 않았다.
CI에서 실행하려면 테스트 DB·Redis 준비와 종료 단계를 먼저 구성해야 한다.

## 검증 상태

실제 Docker 기반 실행 결과는 아직 미확인이다. 위 명령의 테스트 통과 결과를 확인한 뒤 통합 검증 완료로 판단한다.
