# 관리자 댓글 삭제 — 단계별 구현 가이드

## 상태와 진행 원칙

2026-09-14 코드 확인 기준, 관리자 댓글 삭제는 구현 전이다. 관리자 서비스와 Controller에는 목록 조회가 있다. 이 문서는 계획이며 구현 완료 또는 테스트 통과 기록이 아니다.

- 사용자가 소스 코드를 직접 수정하고 한 단계씩 확인한다. 별도 요청 전에는 에이전트가 소스 코드를 수정하지 않는다.
- [게시글 삭제 가이드](admin-post-delete.md)의 BFF·확인창·페이지 보정 구조를 참고한다.
- 기존 앱의 댓글 삭제는 작성자 본인인지 검사한다. 이 검사를 제거하거나 우회하지 않는다.
- 현재 댓글 조회는 Redis 캐시를 사용하지 않는다. 이번 삭제에 게시글 목록 캐시 무효화를 불필요하게 추가하지 않는다.
- 댓글 물리 삭제를 적용한다. 댓글 삭제가 부모 게시글이나 작성자를 삭제하는 것은 아니다.

## 목표 요청 흐름

삭제 확인 버튼 → deleteAdminComment(commentId)
→ Next.js DELETE /api/admin/comments/:id
→ NestJS DELETE /admin/comments/:id
→ JwtAuthGuard + AdminGuard → 서비스 → DB 삭제 → 204 → 웹 목록 갱신

Next.js는 쿠키의 토큰을 읽어 전달한다. 최종 관리자 권한 검증은 NestJS가 담당한다.

## 1단계 — 서비스 삭제 로직

수정: `src/admin/services/admin-comments.service.ts`

1. `NotFoundException`을 import한다.
2. 기존 `findList()` 아래에 `remove(commentId: number): Promise<void>`를 추가한다.
3. `commentsRepository.delete(commentId)`를 호출한다.
4. `affected === 0`이면 댓글이 없다는 404 예외를 발생시킨다.

기존 Comment Repository가 주입되어 있어 새 Repository나 모듈을 만들 필요는 없다. 아직 외부 API에 연결하지 않는 단계다.

## 2단계 — 관리자 Controller 연결

수정: `src/admin/controllers/admin-comments.controller.ts`

- `@Delete(':id')`, `@HttpCode(HttpStatus.NO_CONTENT)`를 추가한다.
- `@Param('id', ParseIntPipe)`로 변환 후 양의 안전한 정수인지 검증한다.
- `adminCommentsService.remove(id)`를 기다리고 본문 없이 204를 반환한다.
- 클래스의 `JwtAuthGuard + AdminGuard`를 유지한다.
- Swagger에 성공 204, 잘못된 ID 400, 인증 없음 401, 권한 없음 403, 대상 없음 404를 기록한다.
- 앱의 기존 댓글 삭제 Controller·Service는 변경하지 않는다.

## 3단계 — 서버 검증

- Mock 단위 테스트: 삭제 성공, affected 0이면 404, DB 오류 전달.
- 격리된 테스트 환경에서 무인증 401, 일반 사용자 403, 관리자 성공 204를 확인한다.
- 관리자가 다른 작성자의 테스트 댓글을 삭제할 수 있는지 확인한다.
- 잘못된 ID 400, 삭제한 ID 재요청 404를 확인한다.
- 댓글 목록에서 사라지고 부모 게시글·작성자는 남아 있는지 확인한다.
- 기존 작성자용 API의 권한이 유지되는지 확인한다.
- 운영 데이터는 삭제하지 않는다. 테스트 완료 전 서버 작업 전체가 검증됐다고 표시하지 않는다.

## 4단계 — Next.js Route Handler

신규: `/Volumes/T7/loop_admin/app/api/admin/comments/[id]/route.ts`

- 기존 게시글 삭제 Route Handler를 참고한다.
- Origin·양의 안전한 정수 ID·accessToken 쿠키를 확인한다.
- 서버에서 NestJS `DELETE /admin/comments/:id`를 Bearer 인증으로 호출한다.
- 시간 제한, 리다이렉트 차단, 안전한 오류 메시지를 적용한다.
- 성공은 본문 없는 204로 반환한다. 성공 시 JSON을 파싱하지 않는다.
- 삭제 요청을 자동 재시도하지 않는다. 통신 실패는 실제 삭제 여부가 불명확할 수 있음을 안내한다.

## 5단계 — 브라우저 API 함수

신규: `/Volumes/T7/loop_admin/src/features/comments/api/delete-admin-comment.ts`

- `deleteAdminComment(id: number): Promise<void>`를 export한다.
- 같은 출처 `/api/admin/comments/${id}`에 DELETE 요청을 보낸다.
- 성공은 void, 실패는 안전하게 추출한 메시지로 Error를 발생시킨다.
- 토큰을 직접 읽거나 NestJS 주소를 브라우저에 연결하지 않는다.

## 6단계 — 삭제 버튼과 확인창

신규: `/Volumes/T7/loop_admin/src/features/comments/components/delete-comment-button.tsx`

- 게시글 삭제 버튼 구조를 참고하되 댓글 ID·내용과 `/comments` 경로를 사용한다.
- 버튼만 Client Component로 만든다. 페이지·테이블은 Server Component로 유지한다.
- 댓글 ID 입력 확인, 취소, 요청 중 비활성화, 동기적인 중복 요청 차단, 오류 표시를 제공한다.
- 삭제한 댓글은 복구할 수 없다는 안내를 표시한다. 부모 게시글 삭제 경고를 복사하지 않는다.
- 긴 댓글 줄바꿈, 모바일 폭, 터치 영역, 키보드 포커스, Escape 동작을 확인한다.
- 현재 프로젝트의 Tailwind 표기에 맞춰 `wrap-break-word`, `bg-white/4` 등 정규 클래스 표기를 사용한다.

## 7단계 — 테이블 연결과 페이지 보정

수정:

- `/Volumes/T7/loop_admin/src/features/comments/components/admin-comments-table.tsx`
- `/Volumes/T7/loop_admin/app/(admin)/comments/page.tsx`

관리 열에 삭제 버튼을 연결하고 각 댓글 ID·내용을 전달한다.
성공 후 검색어·limit를 유지하며 목록과 전체 건수를 갱신한다.
현재 페이지가 새 마지막 페이지보다 크면 마지막 유효 페이지로 이동한다. 전체 0건이면 1페이지 빈 목록으로 처리한다.
완료 안내용 `deleted=1`은 삭제 성공을 증명하거나 권한을 부여하는 값이 아니다.

## 8단계 — 최종 검증 및 문서 갱신

- 서버와 관리자 웹에서 lint·build 및 관련 테스트를 실행하고 실제 결과를 기록한다.
- BFF의 Origin·인증·ID·204 빈 응답·권한 거부·통신 실패를 Mock으로 테스트한다.
- 확인창 취소, 잘못된 ID 입력, 중복 클릭, 만료된 로그인, 없는 댓글을 확인한다.
- 마지막 페이지 마지막 행 삭제, 전체 0건, 검색 조건 유지, 성공·오류 안내를 확인한다.
- 모바일 375px와 데스크톱에서 테이블 스크롤·확인창을 확인한다.
- 구현 후 관리자 웹 PROJECT.md·docs/SECURITY.md·docs/TESTING.md와 이 문서의 상태를 갱신한다.
- 자동 테스트가 없거나 수동 검증하지 않은 항목은 통과로 기록하지 않는다.

## 범위 밖 및 운영 후속 과제

- 삭제 감사 로그, 소프트 삭제·복구 정책은 별도 설계한다.
- 기존 발송 알림 회수, 과거 집계 통계 재계산, 앱 로컬 캐시 즉시 삭제는 이번 작업에 포함하지 않는다.
- 앱 화면에 이미 로드된 댓글을 실시간으로 제거하려면 별도 동기화가 필요하다. 이번 기능은 서버 삭제와 웹 목록 갱신까지다.
