# 관리자 게시글 삭제 — 단계별 구현 가이드

## 진행 방식과 현재 상태

기본 구현이 반영되었으며 사용자가 동작 확인 완료를 보고했다. 아래 단계는 구현 순서를 재사용하기 위한 가이드다. 구현 상태와 테스트 통과 여부는 구분한다.

- 코드 확인: 관리자 DELETE API, BFF, API 함수, 확인창, 테이블 연결, 완료 안내와 페이지 보정이 반영되어 있다.
- 에이전트 실행 기록: 삭제 버튼 수정 시 해당 파일 ESLint 및 관리자 웹 TypeScript 검사 통과. 이후 테이블·페이지 변경까지 포함한 전체 lint/build는 이 문서 갱신에서 실행하지 않았다.
- 사용자 확인 보고의 개별 테스트 케이스 범위는 확인되지 않았다. 아래 3·8단계 전체가 자동으로 통과한 것으로 간주하지 않는다.

- 기존 `DELETE /posts/:id`는 `PostsService.remove()`에서 작성자 본인인지 검사한다. 이 검사를 제거하지 않는다.
- `AdminPostsController`에는 목록 조회와 삭제가 있으며 클래스에 `JwtAuthGuard + AdminGuard`가 적용되어 있다.
- 기존 게시글 삭제는 물리 삭제이며 `posts:list:*` 캐시를 무효화한다.
- 댓글의 게시글 관계에는 `onDelete: CASCADE`가 선언되어 있다. 실제 DB 제약도 확인해야 한다.
- 관리자 테이블은 `loop_admin/src/features/posts/components/admin-posts-table.tsx`에 있다.

## 목표 흐름

삭제 확인창 → 브라우저 DELETE /api/admin/posts/:id → Next.js Route Handler
→ NestJS DELETE /admin/posts/:id → 인증·관리자 권한 확인 → DB 삭제 → 목록 캐시 무효화 → 웹 목록 갱신

최종 권한 검증은 NestJS가 담당한다. 웹에서 버튼을 숨기는 것만으로 보호하지 않는다.

## 1단계 — 관리자 서비스에 삭제 로직 추가

대상: `src/admin/services/admin-posts.service.ts`

1. `NotFoundException`과 `CacheService`를 import한다.
2. 기존 생성자에 `private readonly cacheService: CacheService`를 추가한다. 기존 Repository 주입은 유지한다.
3. `remove(postId: number): Promise<void>`를 추가한다.
4. `postsRepository.delete(postId)`의 `affected`가 0이면 404를 반환한다.
5. 삭제 성공 후 `cacheService.deleteByPattern('posts:list:*')`를 호출한다.

현재 CacheModule은 전역 모듈이다. 기존 앱 모듈 등록을 유지한다. 이 단계에서는 Controller를 변경하지 않으며 외부에서 삭제를 호출할 수 없다.

## 2단계 — 관리자 DELETE API 연결

대상: `src/admin/controllers/admin-posts.controller.ts`

- `@Delete(':id')`와 `@HttpCode(HttpStatus.NO_CONTENT)`를 추가한다.
- `@Param('id', ParseIntPipe)`로 숫자 변환하고 양의 안전한 정수인지 검증한다.
- 서비스 `remove(id)`를 기다리고 본문 없이 204를 반환한다.
- 기존 클래스의 두 Guard를 유지한다. 클라이언트에서 authorId를 받아 권한을 우회하지 않는다.
- Swagger에 204, 400, 401, 403, 404를 문서화한다.

## 3단계 — 서버 검증

- Mock 기반 테스트: 삭제 성공, 대상 없음, 캐시 무효화 호출 및 실패.
- 테스트 환경에서 무인증 401, 일반 사용자 403, 관리자 204, 없는 대상 404를 확인한다.
- 기존 작성자용 삭제 API의 권한이 그대로인지 확인한다.
- 댓글 FK와 삭제 후 목록 캐시 갱신을 확인한다. 운영 게시글은 테스트로 삭제하지 않는다.
- DB 삭제와 Redis 삭제는 하나의 트랜잭션이 아니다. Redis 실패 응답만으로 게시글이 남아 있다고 판단하지 않는다.

## 4단계 — Next.js Route Handler

신규: `loop_admin/app/api/admin/posts/[id]/route.ts`

- 기존 유저 삭제 Route Handler를 참고한다.
- DELETE만 제공하고 Origin, 양의 안전한 정수 ID, accessToken 쿠키를 확인한다.
- HttpOnly 쿠키의 토큰으로 NestJS `DELETE /admin/posts/:id`를 호출한다.
- 성공은 본문 없는 204로 반환한다. 빈 응답에 `response.json()`을 호출하지 않는다.
- 요청 시간 제한과 안전한 오류 메시지를 적용한다. 토큰이나 서버 내부 오류를 브라우저에 노출하지 않는다.
- 삭제 요청을 자동 재시도하지 않는다. 네트워크 오류는 삭제 결과 확인 불가로 안내한다.

## 5단계 — 브라우저 API 함수

신규: `loop_admin/src/features/posts/api/delete-admin-posts.ts` (함수명: `deleteAdminPost`)

- 같은 출처 `/api/admin/posts/${id}`로 DELETE 요청을 보낸다.
- 성공 시 void, 실패 시 사용자에게 표시할 Error를 전달한다.
- 서버 주소나 인증 토큰을 브라우저 코드에서 직접 처리하지 않는다.

## 6단계 — 삭제 확인 버튼

신규: `loop_admin/src/features/posts/components/delete-post-button.tsx`

- 버튼과 확인창만 Client Component로 작성한다.
- 제목과 게시글 ID, 되돌릴 수 없는 삭제 및 댓글 삭제 영향을 안내한다.
- 유저 삭제 UI와 동일하게 ID 입력으로 대상을 확인한다.
- 요청 중 중복 클릭을 차단하고 취소·오류·성공 상태를 구분한다.
- 키보드 포커스, Escape 동작, 좁은 화면에서의 폭과 터치 영역을 확인한다.
- 구현 전 `loop_admin/docs/SECURITY.md`, `docs/RESPONSIVE_LAYOUT.md`와 설치된 Next.js 문서를 확인한다.

## 7단계 — 테이블 및 목록 갱신

대상:

- `loop_admin/src/features/posts/components/admin-posts-table.tsx`
- `loop_admin/app/(admin)/posts/page.tsx`

관리 열에 삭제 버튼을 배치한다. 페이지와 테이블 전체를 Client Component로 전환하지 않는다.
삭제 성공 후 검색어·limit를 유지하고 목록을 갱신한다. 마지막 페이지의 마지막 게시글 삭제 시 유효한 이전 페이지로 보정한다.
실패하면 성공 안내나 낙관적 목록 제거를 하지 않는다. 404 또는 결과 불명확 시 목록을 다시 확인할 수 있게 한다.

## 8단계 — 완료 검증

- 서버 및 관리자 웹 lint, build, 관련 테스트.
- Mock으로 BFF 인증·Origin·오류 전달·204 빈 응답 테스트.
- 테스트 게시글로 확인창 취소, 중복 클릭, 만료된 로그인, 마지막 페이지 보정 확인.
- 모바일 375px와 데스크톱에서 테이블 스크롤 및 확인창 확인.
- Flutter의 기존 작성자 삭제·목록 새로고침이 유지되는지 확인.

## 범위 및 남은 위험

- S3 파일 삭제, 전체 알림 삭제, 과거 통계 재집계, 앱 로컬 캐시 즉시 원격 삭제는 자동 추가하지 않는다.
- 이미 발송된 알림은 회수되지 않는다. 삭제된 글로 이동하면 앱에서 404를 처리해야 한다.
- 캐시 SCAN 무효화는 기존 구현을 따른다. 동시 목록 조회가 오래된 캐시를 재생성하는 경쟁 조건까지 완전히 해결하지는 않는다.
- 운영 고도화 시 삭제 감사 로그, 소프트 삭제/복구 정책, 안정적인 캐시 무효화 및 재처리를 별도 설계한다.
