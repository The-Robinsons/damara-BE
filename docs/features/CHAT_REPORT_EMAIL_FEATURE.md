# 채팅 사용자 신고 이메일 전송 기능

## 1. 작업 시점

```text
작성일: 2026-08-13
브랜치: feature/chat-report-email
작업 범위: 채팅 사용자 신고 API 및 운영 메일 전송 설계
참고 화면: 신고 카테고리 선택 후 상세 내용을 작성하는 사용자 신고 흐름
```

## 2. 문제 배경

현재 채팅에는 부적절한 사용자를 운영진에게 신고하는 기능이 없다. 사용자가 채팅 중 문제를 겪어도 신고 사유, 관련 사용자, 채팅방을 한 번에 전달할 표준 경로가 없어 운영진이 사실관계를 확인하기 어렵다.

기존 회원가입 이메일 인증은 `src/common/mail/EmailSender.ts`의 공용 `EmailSender`와 SMTP 설정을 사용한다. 신고 기능 때문에 별도의 메일 계정이나 SMTP 연결을 추가하지 않고 이 전송 기반을 그대로 사용한다.

## 3. 기획 방향

### 사용자 흐름

1. 채팅 화면에서 신고할 사용자의 메뉴를 열고 `신고하기`를 선택한다.
2. 신고 사유 카테고리를 하나 선택하거나 `선택 안 함` 상태로 다음 단계로 이동한다.
3. 상세 내용을 자유롭게 작성한다.
4. 제출 전에 신고 대상과 입력 내용을 확인한다.
5. 서버가 채팅 참여 권한과 입력값을 검증한 후 운영 메일로 전송한다.
6. 성공 시 신고 접수 완료 안내를 표시한다.

카테고리와 상세 내용은 각각 선택 사항이지만 둘 다 비어 있는 신고는 허용하지 않는다. 즉, 사용자는 카테고리만 선택하거나 상세 내용만 작성하거나 둘 다 입력할 수 있다.

### 기본 카테고리

| API 값 | 화면 문구 | 설명 |
| --- | --- | --- |
| `COMMERCIAL_SPAM` | 전문 판매자 또는 스팸 같아요 | 반복 홍보, 도배, 무관한 광고 |
| `MANNER` | 비매너 사용자예요 | 거래 방해, 약속 불이행 등 |
| `ABUSIVE_LANGUAGE` | 욕설이나 혐오 표현을 해요 | 욕설, 비방, 차별·혐오 표현 |
| `SEXUAL_HARASSMENT` | 성희롱을 해요 | 성적 발언 또는 불쾌한 접근 |
| `TRANSACTION_DISPUTE` | 거래 또는 환불 문제가 있어요 | 거래 조건 불이행, 환불 분쟁 |
| `FRAUD` | 사기당했어요 | 금전 요구, 사기 의심 행위 |
| `DATING_ATTEMPT` | 연애 목적의 대화를 시도해요 | 서비스 목적과 무관한 만남 요구 |
| `OTHER` | 다른 문제가 있어요 | 위 항목에 포함되지 않는 문제 |

카테고리를 선택하지 않은 경우 API에는 `category`를 생략하거나 `null`로 보내며, 이메일에는 `선택 안 함`으로 표시한다. 카테고리 문구는 FE에서 임의로 보내지 않고 BE enum과 FE 상수의 API 값을 맞춰 관리한다.

## 4. 메일 주소 하나로 해결하는 방법

### 권장안

기존 인증메일 계정을 발신자이자 신고 수신자로 함께 사용한다.

```text
SMTP 로그인 계정: SMTP_USER
인증메일 발신 주소: MAIL_FROM
신고메일 발신 주소: MAIL_FROM
신고메일 수신 주소: REPORT_RECIPIENT_EMAIL (미설정 시 MAIL_FROM)
```

운영 환경에서 `SMTP_USER`와 `MAIL_FROM`을 실제 운영 메일 하나로 동일하게 설정하고, `REPORT_RECIPIENT_EMAIL`을 설정하지 않으면 그 주소가 자신에게 신고메일을 보내고 같은 받은편지함에서 수신한다. 따라서 메일 계정은 하나만 필요하다.

예시:

```dotenv
MAIL_PROVIDER=smtp
MAIL_FROM=damara.service@example.com
MAIL_FROM_NAME=DAMARA
SMTP_USER=damara.service@example.com
SMTP_PASSWORD=********

# 생략하면 MAIL_FROM을 사용한다.
# REPORT_RECIPIENT_EMAIL=damara.service@example.com
```

`REPORT_RECIPIENT_EMAIL`은 계정을 추가하기 위한 값이 아니라 향후 운영팀 주소가 분리될 때 코드 수정 없이 수신처만 바꾸기 위한 선택 설정이다. MVP에서는 설정하지 않아도 된다.

주의: 메일 제공자가 자기 자신에게 보내는 메일을 받은편지함에서 숨기거나 보낸편지함에만 표시할 수 있으므로 운영 계정에서 1회 실전 테스트해야 한다. 해당 문제가 있으면 같은 계정의 수신 별칭(alias)을 사용하거나 메일 제공자의 필터 규칙을 설정한다. 별칭은 별도 SMTP 계정이 아니다.

### 기존 메일 모듈 재사용 방식

`EmailSender`는 이미 `to`, `subject`, `html`, `text`를 받으므로 SMTP transporter를 새로 만들 필요가 없다. 인증메일은 기존 템플릿을 유지하고, 신고 기능은 `ReportEmailTemplate`만 별도로 둔다.

```text
EmailSender (공통 SMTP 연결)
├─ EmailVerificationService -> 인증번호 템플릿 -> 가입 사용자
└─ ChatReportService        -> 신고 템플릿     -> 운영 메일
```

## 5. API 계약 초안

### 신고 접수

```http
POST /api/chat/rooms/:chatRoomId/reports
Authorization: Bearer <access-token>
Content-Type: application/json
```

요청 본문:

```json
{
  "reportedUserId": "신고 대상 사용자 UUID",
  "category": "ABUSIVE_LANGUAGE",
  "details": "채팅에서 반복적으로 욕설을 했습니다."
}
```

검증 규칙:

- `reportedUserId`: 필수 UUID이며 로그인 사용자 자신을 지정할 수 없다.
- `category`: 선택 사항이며 위 enum 중 하나만 허용한다.
- `details`: 선택 사항, 앞뒤 공백 제거 후 최대 1,000자이다.
- `category`와 공백을 제거한 `details`가 모두 없으면 `REPORT_REASON_REQUIRED`를 반환한다.
- 신고자와 신고 대상 모두 해당 채팅방의 게시글 작성자 또는 참여자여야 한다.
- 클라이언트가 전달한 닉네임, 이메일, 게시글 제목은 신뢰하지 않고 서버가 ID로 다시 조회한다.

성공 응답:

```http
202 Accepted
```

```json
{
  "message": "CHAT_REPORT_ACCEPTED"
}
```

오류 응답:

| 상태 | 오류 코드 | 조건 |
| --- | --- | --- |
| 400 | `REPORT_REASON_REQUIRED` | 카테고리와 상세 내용이 모두 없음 |
| 400 | `CANNOT_REPORT_SELF` | 자기 자신을 신고함 |
| 401 | `UNAUTHORIZED` | 로그인 정보가 없음 |
| 403 | `CHAT_REPORT_FORBIDDEN` | 신고자 또는 대상이 채팅 구성원이 아님 |
| 404 | `CHAT_ROOM_NOT_FOUND` | 채팅방이 없음 |
| 404 | `REPORTED_USER_NOT_FOUND` | 신고 대상 사용자가 없음 |
| 429 | `CHAT_REPORT_RATE_LIMITED` | 단시간 반복 신고 제한 |
| 502 | `REPORT_EMAIL_DELIVERY_FAILED` | 메일 제공자 전송 실패 |

API가 접수 결과를 명확히 표현하도록 `202 Accepted`를 사용한다. 단, 최초 구현을 동기 메일 전송으로 만든다면 실제 전송 성공 이후에만 202를 반환한다.

## 6. 이메일 구성

제목은 받은편지함 필터링과 검색이 쉽도록 고정 접두사와 카테고리를 포함한다.

```text
[DAMARA 신고] 욕설이나 혐오 표현을 해요 / 채팅방 <짧은 ID>
```

본문은 HTML과 plain text를 모두 생성하며 다음 순서로 정리한다.

| 구역 | 포함 정보 |
| --- | --- |
| 접수 정보 | 접수 시각(KST), 신고 ID, 카테고리 |
| 신고자 | 사용자 ID, 닉네임, 가입 이메일 |
| 신고 대상 | 사용자 ID, 닉네임, 가입 이메일 |
| 관련 정보 | 채팅방 ID, 게시글 ID, 게시글 제목 |
| 신고 내용 | 사용자가 작성한 상세 내용 또는 `작성 안 함` |

사용자가 입력한 내용은 HTML escape 후 출력해 메일 본문 삽입 공격을 막는다. SMTP 비밀번호, 인증번호, 액세스 토큰은 절대 포함하거나 로그로 남기지 않는다.

채팅 전체 내용은 MVP 이메일에 자동 첨부하지 않는다. 관계없는 참여자의 개인정보까지 외부 메일 시스템에 복제될 수 있기 때문이다. 특정 메시지 신고가 필요해지면 후속 API에 `messageId`를 추가하고, 서버가 해당 메시지 한 건과 앞뒤 최소 문맥만 조회하는 방식으로 확장한다.

## 7. 백엔드 구현 범위

예상 파일:

```text
src/types/chat-report.ts
src/services/ChatReportService.ts
src/common/mail/ReportEmailTemplate.ts
src/controllers/chat-report.controller.ts
src/routes/chat/ChatRoutes.ts
src/routes/common/validation/chat-report-schemas.ts
src/common/constants/ENV.ts
config/.env.example
src/config/swagger.ts
docs/api/SWAGGER_CHANGELOG.md
tests/services/chatReportService.test.ts
tests/routes/chat-report-schemas.test.ts
```

처리 순서:

1. 인증 미들웨어에서 로그인 사용자 ID를 얻는다.
2. Zod로 경로와 본문을 검증한다.
3. 채팅방, 게시글 작성자, 참여자, 신고 대상 사용자를 조회한다.
4. 신고자와 대상의 채팅 참여 관계 및 자기 신고 여부를 검사한다.
5. 서버에서 이메일 표시 데이터를 구성하고 HTML escape한다.
6. 공용 `emailSender.send()`로 운영 주소에 전송한다.
7. 성공 시 `CHAT_REPORT_ACCEPTED`를 반환한다.

## 8. DB/ERD 영향

MVP는 신고 내용을 이메일로 전달하는 것이 목적이므로 신규 테이블 없이 구현할 수 있다. 다만 이메일만 사용하면 전송 후 상태 추적, 중복 판단, 운영 처리 이력을 관리하기 어렵다.

초기 구현에서는 UUID 신고 ID를 요청마다 생성해 이메일과 구조화 로그에 함께 기록한다. 운영자 처리 화면이나 제재 자동화를 도입할 때 `chat_reports` 테이블을 추가한다.

권장 후속 컬럼:

```text
id, chat_room_id, reporter_id, reported_user_id,
category, details, status, created_at, reviewed_at, reviewed_by
```

현재 단계의 ERD 변경은 없다.

## 9. 보안 및 운영 정책

- 인증된 사용자만 신고할 수 있다.
- 신고자와 대상이 실제 채팅 구성원인지 서버에서 확인한다.
- 사용자별·IP별 rate limit을 적용한다. 초기 권장값은 사용자당 1시간 5회, IP당 1시간 20회이다.
- 같은 신고자, 대상, 채팅방 조합의 짧은 시간 내 중복 제출을 제한한다.
- 메일 전송 오류의 상세 SMTP 응답을 클라이언트에 노출하지 않는다.
- 신고 내용과 이메일 주소가 포함된 로그는 운영 접근 권한과 보존 기간을 제한한다.
- 신고 접수만으로 자동 제재하지 않으며 운영자 검토 대상으로 취급한다.

## 10. 프론트엔드 영향

화면은 두 단계로 구성한다.

1. 카테고리 선택: 단일 선택이며 선택 없이 진행 가능
2. 상세 내용 작성: 최대 1,000자, 현재 글자 수 표시

제출 버튼은 카테고리와 상세 내용이 모두 비어 있을 때 비활성화한다. 전송 중에는 중복 클릭을 막고, 성공 시 모달을 닫은 뒤 접수 완료 토스트를 표시한다. 429 응답에는 잠시 후 다시 시도하라는 안내를 표시한다.

FE가 보내는 값은 `reportedUserId`, `category`, `details`뿐이며 신고자 정보와 게시글 정보는 BE가 채운다.

## 11. 검증 방법

- 카테고리만 있는 신고가 전송되는지 확인
- 상세 내용만 있는 신고가 전송되는지 확인
- 둘 다 있는 신고가 전송되는지 확인
- 둘 다 없는 요청이 400인지 확인
- 자기 신고, 비참여자 신고, 존재하지 않는 채팅방을 차단하는지 확인
- HTML 문자가 포함된 상세 내용이 escape되는지 확인
- 이메일 subject, HTML, text에 필요한 필드가 정리되어 있는지 단위 테스트
- `MAIL_PROVIDER=json`에서 외부 발송 없이 생성 내용을 검증
- 실제 운영 SMTP에서 동일 주소 발신·수신이 가능한지 1회 통합 테스트
- `npm run build` 및 관련 테스트 실행

## 12. 후속 작업

1. 이 문서의 API 계약에 맞춰 BE 신고 엔드포인트를 구현한다.
2. Swagger와 `docs/api/SWAGGER_CHANGELOG.md`를 갱신한다.
3. FE의 카테고리 선택 및 상세 내용 모달을 구현한다.
4. 운영 SMTP에서 자기 자신에게 보낸 메일의 수신함 노출 여부를 확인한다.
5. 신고 처리량이 늘면 DB 저장, 관리자 처리 상태, 신고자 결과 알림을 추가한다.
