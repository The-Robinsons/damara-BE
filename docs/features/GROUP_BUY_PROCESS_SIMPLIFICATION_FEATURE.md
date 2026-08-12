# 모집글 거래 과정 단순화

## 작업 시점

```text
2026-08-13
브랜치: feature/simplify-group-buy-process
```

## 문제 배경

게시글 전체 상태와 참여자별 거래 상태가 독립적으로 존재하는 상황에서 게시글의
`closed`와 `in_progress`가 별도 사용자 행동을 요구했다. 참여자 상태의 기존 표시명도
버튼을 누른 결과인지 현재 대기 중인 업무인지 구분하기 어려웠다.

## 기획 방향

- 게시글 신규 상태 흐름을 `open -> closed -> completed`로 축소한다.
- 기존 `in_progress` 데이터는 완료 또는 취소할 수 있도록 읽기 호환성을 유지한다.
- 참여자별 상태는 기존 DB 값을 유지하면서 사용자용 라벨과 다음 행동을 명확히 한다.
- 모집글 상세에서 4단계 거래 안내를 제공한다.

## 구현 변경

### 게시글 상태

신규 상태 변경 요청에서 `in_progress`를 제거하고 `closed -> completed` 전이를 허용했다.
최종 완료는 참여자가 한 명 이상 존재하고 모든 참여자가 `received` 상태이며 미해결
예외가 없을 때만 가능하다.

### 참여자 상태 메타데이터

| 단계 | 내부 상태 | 표시 라벨 | 다음 행동 | 행동 주체 |
|---:|---|---|---|---|
| 1 | `participating` | 참여 신청 | 참여 확정하기 | 모집자 |
| 2 | `payment_pending` | 참여 확정 | 입금 확인하기 | 모집자 |
| 3 | `pickup_ready` | 입금 확인 | 수령 완료하기 | 참여자 |
| 4 | `received` | 수령완료 | 없음 | 없음 |

참여자 응답에 다음 필드를 추가했다.

```text
participantStatusStep
participantStatusTotalSteps
nextStatus
nextActionLabel
nextActionActor
```

모집글 상세 응답에는 `participantProcessGuide`를 추가했다.

## API/Swagger 영향

- 상태 변경 요청과 목록 필터의 공개 enum에서 `in_progress` 제거
- 참여자 프로필, 참여자 목록, 내 참여 공구 응답에 단계 메타데이터 추가
- 모집글 상세 응답에 거래 단계 안내 추가
- 생성된 `docs/openapi/openapi.json` 갱신

## ERD/DB 영향

이번 변경에는 DB 스키마 변경이 없다. 기존 데이터 호환을 위해 DB와 ORM의 posts.status
enum에는 `in_progress`를 유지하고 신규 API 입력에서만 차단한다. 운영 데이터 정리 후
별도 마이그레이션으로 enum을 제거할 수 있다.

## 검증

```text
npm.cmd run type-check
npx.cmd vitest --run tests/routes/participant-status.test.ts tests/routes/post-schemas.test.ts tests/routes/post-exception-schemas.test.ts
npx.cmd ts-node --transpile-only scripts/lint-openapi.ts docs/openapi/openapi.json
```

## 후속 작업

- 운영 DB의 기존 `in_progress` 게시글 수 확인 및 `closed` 변환
- 운영 데이터 변환 후 DB enum에서 `in_progress` 제거 검토
- 프론트엔드가 `nextActionLabel`과 `nextActionActor`를 기준으로 버튼을 노출하도록 연동
