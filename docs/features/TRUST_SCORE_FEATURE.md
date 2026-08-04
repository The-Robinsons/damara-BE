# 신뢰학점 및 상호평가 기능 개발 보고서

## 1. 작업 시점

```text
2026-08-05
브랜치: feature/trust-score-v2-backend
정책 버전: trust-v2
관련 커밋: 커밋 전
```

## 2. 문제 배경

```text
기존 문제:
거래 완료와 취소만으로 신뢰점수가 변해 실제 거래 상대가 경험한 매너를 반영하기 어려웠다.
모집자는 참여자가 여러 명이므로 일대일 거래와 같은 방식으로 점수를 적용하면 모집 규모에 따라 점수가 과도하게 증가할 수 있었다.

사용자/운영자/프론트엔드 관점의 불편:
거래 상대를 평가하거나 받은 평가를 요약해서 확인할 API와 저장 구조가 없었다.
같은 완료·취소 요청이 재시도될 때 점수가 중복 반영될 가능성도 있었다.

이번 작업으로 해결하려는 것:
수령이 확인된 모집자와 참여자가 서로 평가할 수 있게 한다.
모집 단위 상한, 평가 공개 시점, 취소 단계별 감점, 중복 반영 방지 기준을 함께 적용한다.
```

## 3. 기획 방향

```text
내부 계산값: users.trust_score
범위: 0~100
기본값: 50

외부 표시값: trustGrade
범위: 2.5~4.5
기본값: 3.5
표시 단위: 소수점 첫째 자리

변환식:
trustGrade = 2.5 + (trustScore / 100) * 2.0
```

정상 거래와 상호평가 점수:

| 대상 | 행동점수 | 평가점수 | 완료 거래 합계 |
| --- | ---: | ---: | ---: |
| 모집자 | 모집 완료 +5 | 참여자 평가 합산 -10~+5 | -5~+10점 = 학점 -0.1~+0.2 |
| 참여자 | 수령 완료 +4 | 모집자 평가 -2~+1 | +2~+5점 = 학점 +0.04~+0.1 |

평가 선택값:

```text
positive = +1
neutral = 0
negative = -2
```

모집자는 참여자가 여러 명이어도 게시글 단위로 평가점수를 한 번만 합산한다. 원점수 합계가 범위를 벗어나면 `-10~+5`로 보정한다. 참여자는 모집자가 각 수령 완료 참여자를 개별 평가하며 거래별 점수를 적용한다.

취소 감점:

| 주체와 시점 | trustScore 변경 |
| --- | ---: |
| 참여자가 없는 모집글 취소·삭제 | 0 |
| 참여자가 있고 수령예정 전 모집자 취소 | -2 |
| 수령예정 또는 수령완료 참여자가 있는 모집자 취소 | -5 |
| 참여중 상태에서 수령까지 24시간 초과 남았을 때 취소 | 0 |
| 참여중 상태에서 수령까지 24시간 이내일 때 취소 | -1 |
| 입금대기 상태에서 참여 취소 | -3 |
| 수령예정 상태에서 참여 취소 | -4 |

수령 시각은 `pickupDate + pickupStartTime`을 한국 시간으로 계산하고, 값이 없으면 게시글 마감 시각을 사용한다. 수령완료 상태에서는 참여 취소할 수 없다.

## 4. 기존 구현과 비교

```text
기존 구현:
모집 완료, 모집 취소, 참여 취소 같은 행동 이벤트만 trust_events에 기록했다.
상호평가 저장소와 평가 API가 없었다.
신뢰점수 반영 요청을 유일하게 식별하는 키가 없었다.

변경 후 구현:
완료 행동점수와 상호평가 점수를 분리해서 기록한다.
수령완료 시각부터 7일 동안 모집자와 참여자가 서로 평가할 수 있다.
상대 평가가 모두 제출되면 즉시 공개하고, 한쪽만 제출하면 평가 기한 만료 후 공개한다.
모든 점수 이벤트에 멱등 키를 적용해 같은 요청의 재시도로 점수가 중복 반영되지 않게 한다.

호환성:
기존 trustScore와 trustGrade 필드 및 신뢰 이벤트 조회 API는 유지한다.
기존 신뢰 이벤트 타입도 이력 호환을 위해 유지한다.
```

평가 규칙:

```text
평가 자격:
게시글이 completed이고 참여자의 participantStatus가 received여야 한다.
모집자와 해당 참여자 사이의 평가만 허용한다.
본인 평가와 참여자 간 평가는 허용하지 않는다.

평가 기간:
post_participants.received_at부터 7일

태그:
positive와 negative는 역할에 맞는 태그를 1~5개 선택한다.
neutral은 태그를 보내지 않는다.
허용 태그는 평가 자격 조회 API 응답을 사용한다.

공개:
상호 제출 완료 시 두 평가를 즉시 published로 변경한다.
상호 제출이 없으면 expiresAt이 지난 pending 평가를 자동 공개한다.
공개 전 pending 평가만 수정할 수 있다.
```

참여 상태는 아래 순서로만 변경한다.

```text
participating -> payment_pending -> pickup_ready -> received

모집자: participating부터 pickup_ready까지 진행 처리
참여자 본인: pickup_ready에서 received로 수령 확정
같은 상태 재요청: 허용
단계 생략 또는 역방향 변경: 거부
```

## 5. 코드 변경 요약

```text
주요 변경 파일:
src/services/TrustService.ts
src/services/TradeReviewService.ts
src/services/PostService.ts
src/models/TrustEvent.ts
src/models/TradeReview.ts
src/models/PostParticipant.ts
src/repos/TradeReviewRepo.ts
src/controllers/trade-review.controller.ts
src/routes/reviews/ReviewRoutes.ts
src/routes/posts/PostRoutes.ts
src/routes/users/UserRoutes.ts
src/jobs/TradeReviewPublicationJob.ts

핵심 로직:
TrustService가 사용자 row를 잠근 뒤 0~100 범위로 점수를 반영한다.
idempotencyKey가 같은 이벤트는 기존 결과를 반환한다.
실제로 반영된 점수는 scoreChange와 effectiveScoreChange에 기록한다.
TradeReviewService가 평가 자격, 역할별 태그, 블라인드 공개와 점수 반영을 관리한다.
서버 시작 시와 15분 간격으로 만료 평가 공개 및 미반영 점수 복구 작업을 수행한다.
게시글 완료는 수령완료 참여자가 1명 이상이고 미해결 예외가 없을 때만 허용한다.
```

주요 신규 신뢰 이벤트:

```text
participant_received
post_review_aggregate_author
trade_review_participant
```

`participant_no_show` 등 기존 이벤트 타입은 이력 호환을 위해 남아 있지만, 신고·확인 절차가 없는 노쇼 자동 감점은 이번 정책에서 사용하지 않는다.

## 6. API/Swagger 영향

```text
변경 여부: 있음

신규 API:
GET  /api/users/me/pending-reviews
GET  /api/users/{id}/review-summary
GET  /api/posts/{id}/reviews/eligibility
POST /api/posts/{id}/reviews
PUT  /api/reviews/{id}

관련 기존 API:
PATCH /api/posts/{id}/status
PATCH /api/posts/{id}/participants/{userId}/status
POST  /api/posts/{id}/participants
DELETE /api/posts/{id}/participants/{userId}

인증 기준:
세션 사용자를 우선 사용한다.
개발·연동 환경에서는 X-User-Id 헤더를 대체 수단으로 사용한다.
요청 body의 사용자 ID만으로 점수 관련 작업을 수행하지 않는다.

Swagger 변경 이력 문서:
docs/api/SWAGGER_CHANGELOG.md
OpenAPI 산출물:
docs/openapi/openapi.json
```

평가 등록 요청:

```json
{
  "revieweeId": "{userId}",
  "rating": "positive",
  "tags": ["ON_TIME", "KIND_COMMUNICATION"]
}
```

평가 수정 요청에는 평가 대상 변경을 막기 위해 `revieweeId`를 받지 않고 `rating`, `tags`만 받는다. 공개 평가 요약은 작성자 신원을 노출하지 않으며 전체 집계와 `organizer`, `participant` 역할별 집계를 반환한다.

## 7. ERD/DB 영향

```text
변경 여부: 있음

신규 테이블:
trade_reviews

post_participants 신규 컬럼:
received_at

trust_events 확장 컬럼:
source_review_id
policy_version
effective_score_change
occurred_at
expires_at
idempotency_key

주요 제약:
trade_reviews는 post_id + reviewer_id + reviewee_id 조합을 유일하게 유지한다.
trust_events.idempotency_key는 유일 값이다.

마이그레이션 필요 여부:
운영 DB 반영 필요

ERD 문서:
docs/architecture/ERD.md
ERD 변경 이력 문서:
docs/architecture/ERD_CHANGELOG.md
```

`trade_reviews.status`는 `pending`, `published`, `hidden`, `disputed`, `invalidated`를 저장할 수 있다. 현재 자동 흐름에서는 `pending`, `published`를 사용하며 나머지는 운영자 분쟁 처리 기능을 위한 예약 상태다.

## 8. 프론트엔드 영향

```text
필수 화면:
거래 완료 후 평가 대상 목록
모집자 평가 화면
참여자별 평가 화면
내 평가 대기 목록
사용자 공개 평가 요약

평가 화면 순서:
1. GET /api/posts/{id}/reviews/eligibility 호출
2. 응답의 revieweeRole과 allowedTags로 선택지 렌더링
3. positive, neutral, negative 중 하나 선택
4. positive/negative이면 태그 1~5개 선택
5. POST /api/posts/{id}/reviews 제출

표시 상태:
not_submitted = 평가 가능
pending = 제출 완료, 공개 전이며 수정 가능
published = 공개 완료, 수정 불가
expired = 평가 기간 종료

주의사항:
태그 목록과 평가 기간을 프론트에 상수로 복제하지 않는다.
trustGrade는 서버 응답값을 사용한다.
모집자는 수령 완료 참여자마다 평가 UI를 제공한다.
공개 프로필에는 익명 집계만 표시한다.
```

## 9. 검증 방법

```bash
npx tsc --noEmit
npx vitest run
npm run openapi:generate
npm run openapi:lint
git diff --check
```

검증 결과:

```text
TypeScript 타입 검사 통과
테스트 20개 파일, 90개 테스트 통과
OpenAPI 생성 및 린트 통과
git diff --check 통과
```

PowerShell에서는 기존 `npm run build`의 자산 복사 단계가 Unix 전용 `mkdir -p`, `cp` 명령 때문에 실패할 수 있다. TypeScript 검증은 위의 `npx tsc --noEmit`으로 별도 확인했다.

## 10. 남은 작업

```text
후속 기능:
최근 1년 평가 가중치
동일 사용자 반복 거래에 대한 점수 조작 방지
신고, 이의제기, 운영자 숨김·무효화 처리
노쇼 신고와 상대 확인 또는 운영자 판정 기반 감점

운영/배포 주의점:
운영 DB에 trade_reviews 테이블과 관련 컬럼·ENUM을 먼저 반영한다.
TradeReviewPublicationJob이 한 서버에서 중복 실행되어도 멱등 키로 점수 중복은 방지되지만,
다중 인스턴스 운영 시에는 전용 스케줄러 또는 분산 락 적용을 권장한다.

테스트 보강:
실제 DB를 사용하는 평가 동시 제출 통합 테스트
평가 만료 배치와 서버 재시작 복구 통합 테스트
권한 위조와 상태 전이 API 통합 테스트

문서 보강:
운영자 분쟁 처리 정책이 확정되면 상태 전이와 API 계약을 추가한다.
```
