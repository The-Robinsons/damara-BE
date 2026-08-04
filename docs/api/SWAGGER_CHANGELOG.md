# Swagger/OpenAPI 변경 이력

이 문서는 Swagger 문서가 코드 변경과 함께 어떻게 바뀌었는지 남기는 기록이다.

Swagger는 프론트엔드와 백엔드가 API 계약을 맞추는 기준점이다. 따라서 라우트, 요청 바디, 응답 스키마, 에러 응답, 서버 URL 동작이 바뀌면 이 문서에도 변경 내용을 추가한다.

## 업데이트 원칙

Swagger 관련 변경이 생기면 다음 순서로 기록한다.

1. 변경 날짜와 브랜치를 적는다.
2. 변경 전 기준 커밋을 적는다.
3. 어떤 스키마나 엔드포인트가 바뀌었는지 적는다.
4. 프론트엔드에 영향이 있는지 적는다.
5. 배포 후 확인할 Swagger URL이나 curl 명령을 적는다.

확인 기준은 다음 파일이다.

```text
src/config/swagger.ts
src/routes/**/*.ts
```

## 2026-08-05 - 신뢰학점 2.0 상호평가 API 추가

### 변경 요약

수령 완료 거래의 모집자·참여자 상호평가, 평가 대기 목록, 공개 평가 요약을 제공하는 API를 추가했다. 평가 작성자 ID는 세션을 우선 사용하고 기존 연동 호환을 위해 `X-User-Id` 헤더도 지원한다.

평가 가능 여부 응답의 각 대상에는 역할별 `allowedTags.positive`, `allowedTags.neutral`, `allowedTags.negative`를 포함하므로 프런트엔드는 태그 목록을 별도로 하드코딩하지 않아도 된다.

공개 평가 요약은 전체 통계와 함께 `roles.organizer`, `roles.participant` 통계를 제공해 모집자·참여자 역할별 평가를 구분한다.

### 신규 API

```text
GET  /api/users/me/pending-reviews
GET  /api/users/{id}/review-summary
GET  /api/posts/{id}/reviews/eligibility
POST /api/posts/{id}/reviews
PUT  /api/reviews/{id}
```

평가 수정 요청은 평가 대상 ID를 다시 받지 않으며 `rating`, `tags`만 변경한다. 작성자와 대상은 저장된 평가 관계를 기준으로 검증한다.

### 기존 API 변경

```text
PATCH /api/posts/{id}/participants/{userId}/status
- received는 참여자 본인만 확정
- participating → payment_pending → pickup_ready는 모집자가 순서대로 변경
- pickup_ready → received는 참여자 본인이 확정하며 단계 건너뛰기와 역행을 차단
- body.actorUserId를 제거하고 세션 또는 X-User-Id 인증 사용자를 기준으로 권한 확인

PATCH /api/posts/{id}/status
- completed 전환에는 received 참여자 1명 이상과 미해결 예외 0건 필요
- body.authorId를 제거하고 세션 또는 X-User-Id 인증 사용자를 기준으로 권한 확인

PUT /api/posts/{id}
- status 변경 요청은 400 POST_STATUS_ENDPOINT_REQUIRED

DELETE /api/posts/{id}
- 참여자가 있으면 409 POST_HAS_PARTICIPANTS_CANCEL_REQUIRED
- 작성자 본인만 삭제 가능

POST /api/posts/{id}/participate
- 세션 또는 X-User-Id 인증 사용자만 본인 계정으로 참여 가능

DELETE /api/posts/{id}/participate/{userId}
- 세션 또는 X-User-Id 인증 사용자와 path userId가 같은 경우만 취소 가능
```

### 점수 정책

모집자는 완료 +5점과 모집 단위 평가 합산 -10~+5점, 참여자는 수령 +4점과 모집자 평가 -2~+1점을 적용한다. 같은 사건은 멱등 키로 한 번만 적용된다.

참여 취소는 수령 예정 시각을 기준으로 24시간 이내 여부를 판단하며, 수령 일시가 없는 기존 게시글은 모집 마감 시각을 대체 기준으로 사용한다.

## 2026-08-04 - 명지대학교 이메일 도메인 검증 강화

### 변경 요약

회원가입 이메일 인증에 사용하는 주소를 `@mju.ac.kr` 도메인으로 제한했다. 발송, 인증번호 확인, 회원가입 요청은 모두 이메일의 앞뒤 공백을 제거하고 소문자로 변환한 뒤 같은 도메인 규칙을 적용한다.

### 영향 API

```text
POST /api/auth/email-verifications/send
POST /api/auth/email-verifications/verify
POST /api/users
```

비명지대 이메일은 메일 발송과 회원 생성 전에 `400 VALIDATION_ERROR` 또는 서비스 방어 검증의 `400 INVALID_MJU_EMAIL`로 거부된다. 인증 토큰은 인증된 이메일과 회원가입 이메일이 일치할 때만 소비된다.

배포 환경에서는 다음 URL로 최종 OpenAPI JSON을 확인한다.

```text
https://be.damara.bluerack.org/api-docs.json
```

## 2026-07-24 - 회원가입 이메일 인증 API 추가

### 변경 요약

회원가입 전에 이메일로 6자리 인증번호를 발송하고 확인하는 API를 추가했다.
인증 성공 시 15분 동안 유효한 일회성 토큰을 반환하며, `POST /api/users` 요청에는 이 토큰이 필수로 추가된다.

### 신규 API

```text
POST /api/auth/email-verifications/send
POST /api/auth/email-verifications/verify
```

### 회원가입 요청 변경

```text
user.emailVerificationToken: string (required)
```

신규 상태 코드는 발송 제한 `429`, 메일 전송 실패 `502`, 인증번호 또는 토큰 만료 `410`, 인증 시도 초과 `423`이다.

## 2026-06-01 - 마이페이지 프로필 이미지 API 추가

브랜치:

```text
feature/user-profile-image-api
```

변경 전 기준 커밋:

```text
82f8a91
```

### 변경 요약

기존에는 이미지 업로드 API와 사용자 `avatarUrl` 수정 API를 프론트에서 조합해야 했다.

마이페이지에서 프로필 이미지를 바로 추가/교체/제거할 수 있도록 사용자 전용 프로필 이미지 API를 추가했다.

### 신규 API

```text
POST /api/users/{id}/profile-image
PUT /api/users/{id}/profile-image
```

### 요청 스키마

`POST /api/users/{id}/profile-image`는 프로필 이미지 파일을 업로드하고 사용자 `avatarUrl`에 즉시 반영한다.

```text
Content-Type: multipart/form-data
image: File
```

`PUT /api/users/{id}/profile-image`는 두 가지 방식으로 수정할 수 있다.

```text
Content-Type: multipart/form-data
image: File
```

또는

```json
{
  "avatarUrl": "/uploads/images/abc123.png"
}
```

프로필 이미지를 제거하려면 다음처럼 보낸다.

```json
{
  "avatarUrl": null
}
```

### 응답 스키마

신규 `UserProfileImageResponse` 스키마를 추가했다.

```json
{
  "avatarUrl": "/uploads/images/abc123.png",
  "image": {
    "imageUrl": "/uploads/images/abc123.png",
    "url": "/uploads/images/abc123.png",
    "filename": "abc123.png"
  },
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "nickname": "홍길동",
    "avatarUrl": "/uploads/images/abc123.png"
  }
}
```

`image`는 파일 업로드 요청에서만 포함된다.

### 프론트엔드 영향

마이페이지 프로필 이미지 추가는 `POST /api/users/{id}/profile-image`를 사용하면 된다.

프로필 이미지 교체는 `PUT /api/users/{id}/profile-image`에 새 파일을 보내면 된다.

이미지 URL을 직접 지정하거나 제거할 때도 같은 `PUT` API를 사용한다.

### 확인 방법

```bash
curl -X POST "https://be.damara.bluerack.org/api/users/{id}/profile-image" \
  -F "image=@profile.png"

curl -X PUT "https://be.damara.bluerack.org/api/users/{id}/profile-image" \
  -H "Content-Type: application/json" \
  -d '{"avatarUrl":null}'
```

## 2026-06-01 - 기본 공지사항 데이터 및 category 응답 정리

브랜치:

```text
feature/default-service-notices
```

변경 전 기준 커밋:

```text
ef8b3f1
```

### 변경 요약

공지사항 API는 존재하지만 운영 DB에 공지 데이터가 없으면 프론트 공지 화면이 비어 보이는 문제가 있었다.

서버 시작 시 DAMARA 기본 공지사항 8개를 자동 보정하고, 프론트가 탭/배지를 바로 표시할 수 있도록 공지 응답에 `category` 필드를 명시했다.

### 변경된 API

```text
GET /api/notices
GET /api/notices/{id}
```

### 응답 스키마 변경

`Notice` 응답에 다음 필드를 추가했다.

```text
category: string
```

`category`는 `summary`가 있으면 `summary` 값을 사용하고, 없으면 `type`에 따른 표시 라벨을 사용한다.

예시:

```json
{
  "title": "DAMARA 베타 서비스 오픈 안내",
  "summary": "서비스 안내",
  "category": "서비스 안내",
  "type": "service",
  "isPinned": true
}
```

### 프론트엔드 영향

공지 목록과 상세 화면에서 `category`를 그대로 표시하면 된다.

초기 운영 DB에 공지가 없거나 일부 기본 공지가 누락되어도 서버가 title 기준으로 없는 기본 공지만 생성하므로 중복 공지 생성 가능성을 줄였다.

### 확인 방법

```bash
curl -s https://be.damara.bluerack.org/api/notices
curl -s https://be.damara.bluerack.org/api-docs.json
```

## 2026-05-31 - 다마라존 공식 접선지 API 추가

브랜치:

```text
feature/damara-pickup-zones
```

변경 전 기준 커밋:

```text
main
```

### 변경 요약

게시글 수령 장소를 자유 입력만 받던 구조에서,
직접 입력(`custom`)과 공식 접선지인 다마라존(`damara_zone`)을 선택할 수 있는 구조로 확장했다.

### 신규 API

```text
GET /api/pickup-zones
GET /api/pickup-zones/{id}
```

`GET /api/pickup-zones`는 등록 화면에서 사용할 공식 접선지 목록을 반환한다.

응답 예시:

```json
{
  "items": [
    {
      "id": "s2810",
      "name": "S2810",
      "campus": "natural",
      "campusLabel": "자연캠퍼스",
      "displayName": "자연캠퍼스 S2810"
    }
  ],
  "total": 1
}
```

### 변경된 API

```text
POST /api/posts
PUT /api/posts/{id}
GET /api/posts
GET /api/posts/{id}
```

### 요청 바디 변경

`POST /api/posts`, `PUT /api/posts/{id}`의 `post` 객체에 다음 계약을 추가한다.

```text
pickupType: custom | damara_zone
pickupZoneId: string | null
pickupLocation: string | null
```

직접 입력 예시:

```json
{
  "post": {
    "pickupType": "custom",
    "pickupLocation": "명지대 정문 앞"
  }
}
```

다마라존 선택 예시:

```json
{
  "post": {
    "pickupType": "damara_zone",
    "pickupZoneId": "s2810"
  }
}
```

`pickupType=damara_zone`이면 서버가 `pickupLocation`을 다마라존 표시명으로 채운다.

### 응답 스키마 변경

Post 응답에 다음 필드가 추가된다.

```text
pickupType
pickupZoneId
pickupZone
```

### 프론트엔드 영향

등록 화면에서 수령 장소 선택지를 다음처럼 구성하면 된다.

```text
직접 입력
다마라존 선택
```

다마라존 선택 시 `/api/pickup-zones`에서 받은 `id`를 `pickupZoneId`로 전송한다.

## 2026-05-30 - 모이면 싸지는 공구 거래 방식 추가

브랜치:

```text
main
```

변경 전 기준 커밋:

```text
5a9d625
```

### 변경 요약

선모집형/후모집형 A/B 구조를 백엔드 계약으로 정리하고,
선모집형의 1차 세부 모드로 `price_unlock`을 추가했다.

`price_unlock`은 목표 참여 인원에 도달하면 목표 가격이 적용되는
"모이면 싸지는 공구" 방식이다.

### 변경된 API

```text
GET /api/posts
GET /api/posts/{id}
POST /api/posts
PUT /api/posts/{id}
POST /api/posts/{id}/participate
DELETE /api/posts/{id}/participate/{userId}
GET /api/posts/student/{studentId}
GET /api/users/{userId}/my-posts
GET /api/users/{userId}/favorites
```

### 요청 바디 변경

`POST /api/posts`, `PUT /api/posts/{id}`의 `post` 객체에 다음 계약을 추가한다.

```text
groupBuyType: pre_recruit | post_recruit
groupBuyMode: normal | price_unlock
targetParticipants: number | null
targetPrice: number | null
```

`price_unlock`은 `groupBuyType=pre_recruit`에서만 유효하다.

요청 예시:

```json
{
  "post": {
    "authorId": "a87522bd-bc79-47b0-a73f-46ea4068a158",
    "title": "물티슈 공동구매",
    "content": "도톰한 물티슈를 같이 구매합니다.",
    "price": 5000,
    "minParticipants": 3,
    "deadline": "2026-06-17T23:59:59.000Z",
    "pickupLocation": "명지대 정문",
    "groupBuyType": "pre_recruit",
    "groupBuyMode": "price_unlock",
    "targetParticipants": 5,
    "targetPrice": 4500
  }
}
```

### 응답 스키마 변경

Post 응답에 다음 계산 필드가 추가된다.

```text
currentPrice
participantsToUnlock
priceUnlocked
dealMessage
```

예시:

```json
{
  "groupBuyType": "pre_recruit",
  "groupBuyMode": "price_unlock",
  "price": 5000,
  "targetParticipants": 5,
  "targetPrice": 4500,
  "currentPrice": 5000,
  "participantsToUnlock": 2,
  "priceUnlocked": false,
  "dealMessage": "2명만 더 모이면 4,500원"
}
```

### 프론트엔드 영향

프론트엔드는 최소 구현에서 `dealMessage`만 표시해도 된다.

```text
2명만 더 모이면 4,500원
```

등록 화면에서는 가격 해금 조건을 사용하는 경우 다음 필드만 추가로 받으면 된다.

```text
할인 조건 사용 여부
목표 인원
목표 달성 가격
```

### 배포 확인

```bash
curl -s "https://be.damara.bluerack.org/api-docs.json" | grep -A20 '"groupBuyMode"'
curl -s "https://be.damara.bluerack.org/api/posts?limit=1"
```

## 2026-05-25 - 운영 API 도메인 be 서브도메인 기준 정리

브랜치:

```text
feature/post-exceptions-api
```

변경 전 기준 커밋:

```text
c001aea
```

### 변경 요약

프론트엔드 운영 API base URL을 `https://be.damara.bluerack.org/api`로
고정하기 위해 Swagger/OpenAPI 서버 URL과 배포 기본 환경변수를
`https://be.damara.bluerack.org` 기준으로 정리했다.

런타임 Swagger는 `API_BASE_URL`이 설정되어 있으면 자동 감지 URL보다
설정 URL을 먼저 노출한다. 따라서 Swagger UI에서 HTTPS 운영 서버가
기본 선택된다.

### 영향 API

REST path, request body, response body, status code 변경은 없다.

OpenAPI `servers` 값의 운영 URL이 다음처럼 바뀐다.

```text
기존: https://damara.bluerack.org
변경: https://be.damara.bluerack.org
```

### 프론트엔드 영향

프론트엔드 운영 환경변수는 다음 기준을 사용한다.

```text
VITE_API_BASE_URL=https://be.damara.bluerack.org/api
VITE_API_BASE=https://be.damara.bluerack.org
VITE_API_URL=https://be.damara.bluerack.org/api
```

프론트 코드에서 endpoint에 `/api`를 다시 붙이면 `/api/api/...`가 되어
404가 날 수 있으므로, `.../api` base에는 `/posts`, `/users`처럼 리소스
path만 붙인다.

### 배포 확인

```bash
curl -s https://be.damara.bluerack.org/api-docs.json | grep -A8 '"servers"'
curl -s https://be.damara.bluerack.org/api/posts?limit=1
```

## 2026-05-21 - 알림 삭제 Socket 이벤트 추가

브랜치:

```text
feature/notification-delete-event
```

변경 전 기준 커밋:

```text
cbd32d2
```

### 변경 요약

알림 목록에서 삭제된 항목을 여러 화면/탭에 실시간 반영할 수 있도록 Socket.io 이벤트 계약에 `notification:delete`를 추가했다.

REST 삭제 API와 Socket 삭제 이벤트 모두 같은 서비스 로직을 사용하며, 삭제 성공 결과는 사용자 알림 룸 `user:{userId}`로 브로드캐스트된다.

### 영향 이벤트

```text
notification:delete
```

### 요청 이벤트

```typescript
socket.emit("notification:delete", {
  notificationId: "123e4567-e89b-12d3-a456-426614174000",
  userId: "a87522bd-bc79-47b0-a73f-46ea4068a158"
});
```

### 수신 이벤트

```typescript
socket.on("notification:delete", ({ userId, notificationId }) => {});
```

### REST 영향

REST path, request body, response body 변경은 없다.

기존 `DELETE /api/notifications/{id}`도 Socket.io 구독자에게 같은 삭제 이벤트를 발행한다.

## 2026-05-21 - 알림 읽음 Socket 이벤트 추가

브랜치:

```text
feature/notification-read-events
```

변경 전 기준 커밋:

```text
6374c4f
```

### 변경 요약

알림 화면에서 읽음 상태를 실시간으로 동기화할 수 있도록 Socket.io 이벤트 계약에 `notification:read`, `notification:readAll`을 추가했다.

REST 읽음 처리 API와 Socket 이벤트 모두 같은 서비스 로직을 사용하며, 처리 결과는 사용자 알림 룸 `user:{userId}`로 브로드캐스트된다.

### 영향 이벤트

```text
notification:read
notification:readAll
```

### 요청 이벤트

```typescript
socket.emit("notification:read", {
  notificationId: "123e4567-e89b-12d3-a456-426614174000",
  userId: "a87522bd-bc79-47b0-a73f-46ea4068a158"
});

socket.emit("notification:readAll", {
  userId: "a87522bd-bc79-47b0-a73f-46ea4068a158"
});
```

### 수신 이벤트

```typescript
socket.on("notification:read", (notification) => {});
socket.on("notification:readAll", ({ userId, updatedCount }) => {});
```

### REST 영향

REST path, request body, response body 변경은 없다.

다만 기존 REST 읽음 처리도 Socket.io 구독자에게 같은 실시간 이벤트를 발행한다.

## 2026-05-20 - Socket.io 이벤트 계약 정리

브랜치:

```text
feature/socket-event-contract
```

변경 전 기준 커밋:

```text
7e539f6
```

### 변경 요약

팜플렛 기준 프론트엔드 WebSocket 이벤트 이름을 네임스페이스형 계약으로 정리했다.

기존 이벤트는 호환 alias로 유지하고, 신규 클라이언트는 `chat:*`, `notification:*`, `socket:error` 이벤트를 사용한다.

### 영향 이벤트

```text
chat:join
chat:send
chat:read
chat:leave
chat:message
chat:joined
chat:left
notification:subscribe
notification:new
socket:error
```

### 호환 유지 이벤트

```text
join_chat_room
send_message
mark_message_read
leave_chat_room
receive_message
user_joined
user_left
message_read
error
```

### 프론트엔드 영향

신규 화면은 `chat:join`, `chat:send`, `chat:read`, `notification:subscribe`를 emit 기준으로 사용한다.

수신 이벤트는 `chat:message`, `chat:joined`, `chat:left`, `chat:read`, `notification:new`, `socket:error`를 사용한다.

### 확인 문서

```text
docs/api/WEBSOCKET_GUIDE.md
```

## 2026-05-20 - 채팅 UI 응답 계약 보강

브랜치:

```text
feature/chat-ui-contract
```

변경 전 기준 커밋:

```text
282ca81
```

### 변경 요약

프론트엔드 채팅 탭과 채팅 상세 오버레이가 목데이터 없이 렌더링할 수 있도록 채팅방 목록과 메시지 목록 응답 계약을 보강했다.

채팅 목록은 게시글 카드에 필요한 상태, 수령 장소, 마감일, 썸네일, 마지막 메시지 정보를 함께 반환한다.

채팅 메시지 목록은 배열 단독 응답 대신 페이지네이션 메타가 포함된 객체 응답으로 변경한다.

### 영향 API

```text
GET /api/chat/rooms/user/{userId}
GET /api/chat/rooms/{chatRoomId}/messages
POST /api/chat/messages
```

### 채팅방 목록 응답 변경

`GET /api/chat/rooms/user/{userId}`의 각 `chatRooms[]` 항목에 다음 필드를 보강했다.

```json
{
  "post": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "물티슈 공동구매",
    "status": "open",
    "pickupLocation": "명지대 정문앞",
    "deadline": "2026-05-20T18:00:00.000Z",
    "thumbnailUrl": "https://example.com/image.png",
    "authorId": "123e4567-e89b-12d3-a456-426614174000"
  },
  "lastMessage": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "content": "오늘 오후 5시까지 수령 가능해요.",
    "senderId": "123e4567-e89b-12d3-a456-426614174000",
    "messageType": "text",
    "createdAt": "2026-05-20T00:00:00.000Z"
  },
  "hasNext": false
}
```

### 메시지 목록 응답 변경

`GET /api/chat/rooms/{chatRoomId}/messages` 응답을 다음 형태로 변경했다.

```json
{
  "messages": [],
  "total": 0,
  "limit": 50,
  "offset": 0,
  "hasNext": false
}
```

### 메시지 타입 변경

메시지 타입에 `system`을 추가했다.

```text
text
image
file
system
```

### 프론트엔드 영향

채팅 메시지 목록 화면은 이제 응답 배열 대신 `response.messages`를 사용해야 한다.

채팅방 목록은 `post.thumbnailUrl`, `post.status`, `post.pickupLocation`, `post.deadline`, `lastMessage.messageType`을 바로 사용할 수 있다.

### 검증 방법

```bash
npm run build
npm run openapi:generate
npm run openapi:lint
curl -s "http://localhost:3000/api/chat/rooms/user/{USER_ID}?limit=20&offset=0"
curl -s "http://localhost:3000/api/chat/rooms/{CHAT_ROOM_ID}/messages?limit=50&offset=0"
```

## 2026-05-20 - 신뢰 요약 API 추가

브랜치:

```text
feature/trust-summary-api
```

변경 전 기준 커밋:

```text
fb3354b
```

### 변경 요약

마이페이지 프로필 카드, 안전거래 프로필, 공구 상세 판매자/참여자 카드에서 현재 신뢰 정보를 별도 호출로 조회할 수 있도록 신뢰 요약 API를 추가했다.

### 신규 API

```text
GET /api/users/{id}/trust-summary
```

### 응답 스키마

신규 `TrustSummaryResponse` 스키마를 추가했다.

```json
{
  "trustScore": 86,
  "trustGrade": 4.3,
  "gradeLabel": "매너 학생",
  "rankPercent": 15,
  "completedTradeCount": 12,
  "responseRate": 92,
  "avgResponseMinutes": 10,
  "cancelCount": 1,
  "noShowCount": 0,
  "badges": ["꼼꼼해요", "친절해요", "약속시간 잘 지켜요"]
}
```

### 계산 기준

`completedTradeCount`는 완료된 작성 공구 수, 수령완료 참여 수, 신뢰 이벤트 완료 수 중 현재 데이터에서 가장 보수적으로 사용할 수 있는 값을 기준으로 계산한다.

`responseRate`는 완료/취소/노쇼 이력 기반 완료 거래 비율이다.

`rankPercent`, `avgResponseMinutes`는 별도 랭킹/응답시간 테이블이 생기기 전까지 내부 신뢰점수와 신뢰학점 기반 추정값으로 제공한다.

### 프론트엔드 영향

신뢰 점수 단독 카드가 필요한 화면은 `GET /api/users/{id}/trust-summary`를 호출하면 된다.

마이페이지 첫 렌더링만 필요한 경우 기존 `GET /api/users/{id}/summary`를 계속 사용할 수 있다.

### 검증 방법

```bash
npm run build
npm run openapi:generate
npm run openapi:lint
curl -s "http://localhost:3000/api/users/{id}/trust-summary"
```

## 2026-05-20 - FAQ API 추가

브랜치:

```text
feature/faqs-api
```

변경 전 기준 커밋:

```text
2eb657e
```

### 변경 요약

마이페이지 FAQ 화면에서 프론트 임시 데이터를 제거하고 서버 데이터로 질문/답변 목록을 조회할 수 있도록 FAQ 목록 API를 추가했다.

### 신규 API

```text
GET /api/faqs
```

활성화된 FAQ만 반환하며, `order ASC`, `createdAt DESC` 순서로 정렬한다.

### 요청 스키마

`GET /api/faqs`는 쿼리 파라미터를 받는다.

```text
limit: number, default 20, min 1, max 100
offset: number, default 0
category: trade | account | payment | pickup | etc
```

### 응답 스키마

신규 `Faq`, `FaqListResponse` 스키마를 추가했다.

```json
{
  "faqs": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "category": "trade",
      "question": "공구 참여는 어떻게 하나요?",
      "answer": "공구 상세 화면에서 참여하기를 누르면 됩니다.",
      "order": 1,
      "isActive": true,
      "createdAt": "2026-05-20T00:00:00.000Z",
      "updatedAt": "2026-05-20T00:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "hasNext": false
}
```

### 프론트엔드 영향

FAQ 화면은 `GET /api/faqs`를 사용한다. 카테고리 탭이 필요하면 `category` 쿼리를 사용한다.

잘못된 카테고리는 `INVALID_FAQ_CATEGORY` 400 응답을 반환한다.

### 검증 방법

```bash
npm run build
npm run openapi:generate
npm run openapi:lint
curl -s "http://localhost:3000/api/faqs"
curl -s "http://localhost:3000/api/faqs?category=trade"
curl -s "http://localhost:3000/api/faqs?category=invalid"
```

## 2026-05-19 - 공지사항 API 추가

브랜치:

```text
feature/notices-api
```

변경 전 기준 커밋:

```text
6949395
```

### 변경 요약

마이페이지/서비스 화면에서 공지사항, 이벤트, 점검, 정책 안내를 서버에서 조회할 수 있도록 공지사항 읽기 API를 추가했다.

### 신규 API

```text
GET /api/notices
GET /api/notices/{id}
```

`GET /api/notices`는 고정 공지를 먼저 노출하고, 같은 조건 안에서는 최신순으로 정렬한다.

### 요청 스키마

`GET /api/notices`는 쿼리 파라미터를 받는다.

```text
limit: number, default 20, min 1, max 100
offset: number, default 0
type: service | event | maintenance | policy
```

### 응답 스키마

신규 `Notice`, `NoticeListResponse` 스키마를 추가했다.

```json
{
  "notices": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "서비스 점검 안내",
      "summary": "5월 20일 새벽 서비스 점검이 진행됩니다.",
      "content": "안정적인 서비스 제공을 위해 점검을 진행합니다.",
      "type": "maintenance",
      "isPinned": true,
      "createdAt": "2026-05-19T00:00:00.000Z",
      "updatedAt": "2026-05-19T00:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "hasNext": false
}
```

### 프론트엔드 영향

공지사항 목록 화면은 `GET /api/notices`를 사용한다. 공지 유형 탭이 필요하면 `type` 쿼리를 사용한다.

공지 상세 화면은 목록의 `id`로 `GET /api/notices/{id}`를 호출한다.

### 검증 방법

```bash
npm run build
npm run openapi:generate
npm run openapi:lint
curl -s "http://localhost:3000/api/notices"
curl -s "http://localhost:3000/api/notices?type=service"
curl -s "http://localhost:3000/api/notices/{id}"
```

## 2026-05-19 - 사용자 설정 API 추가

브랜치:

```text
feature/user-settings-api
```

변경 전 기준 커밋:

```text
b194ece
```

### 변경 요약

마이페이지 설정 화면에서 사용하던 프론트 임시 상태를 실제 서버 데이터로 저장할 수 있도록 사용자별 설정 API를 추가했다.

### 신규 API

```text
GET /api/users/{id}/settings
PUT /api/users/{id}/settings
```

`GET`은 사용자 설정이 아직 없으면 기본 설정을 생성해 반환한다.

### 요청 스키마

`PUT /api/users/{id}/settings`는 `settings` 객체를 받는다. 모든 필드는 optional이며 전달된 값만 저장한다.

```json
{
  "settings": {
    "pushEnabled": true,
    "chatNotificationEnabled": true,
    "postNotificationEnabled": true,
    "marketingNotificationEnabled": false,
    "quietHoursEnabled": true,
    "quietHoursStart": "23:00",
    "quietHoursEnd": "08:00"
  }
}
```

`quietHoursStart`, `quietHoursEnd`는 `HH:mm` 형식만 허용한다.

### 응답 스키마

신규 `UserSettings` 스키마를 추가했다.

```json
{
  "pushEnabled": true,
  "chatNotificationEnabled": true,
  "postNotificationEnabled": true,
  "marketingNotificationEnabled": false,
  "quietHoursEnabled": false,
  "quietHoursStart": "23:00",
  "quietHoursEnd": "08:00"
}
```

### 프론트엔드 영향

마이페이지 설정 화면의 토글과 방해금지 시간 입력은 `GET /api/users/{id}/settings`로 초기화하고, 변경 시 `PUT /api/users/{id}/settings`로 저장할 수 있다.

### 검증 방법

```bash
npm run build
npm run openapi:generate
npm run openapi:lint
curl -s "http://localhost:3000/api/users/{id}/settings"
curl -s -X PUT "http://localhost:3000/api/users/{id}/settings" \
  -H "Content-Type: application/json" \
  -d '{"settings":{"quietHoursEnabled":true,"quietHoursStart":"23:00","quietHoursEnd":"08:00"}}'
```

## 2026-05-17 - 마이페이지 통합 요약 API 추가

브랜치:

```text
feature/user-summary-api
```

변경 전 기준 커밋:

```text
617845b
```

### 변경 요약

마이페이지 첫 렌더링에 필요한 사용자 프로필, 공구/채팅/알림 카운트, 신뢰 요약을 한 번에 조회할 수 있도록 신규 API를 추가했다.

기존에는 프론트엔드가 `GET /api/users/{id}`, `GET /api/users/{userId}/my-posts/summary`, 채팅방 목록, 알림 unread API 등을 조합해야 했다.

### 신규 API

```text
GET /api/users/{id}/summary
```

### 응답 스키마

신규 `UserSummaryResponse` 스키마를 추가했다.

```json
{
  "user": {
    "id": "a87522bd-bc79-47b0-a73f-46ea4068a158",
    "nickname": "노승민",
    "studentId": "20241234",
    "department": "컴퓨터공학과",
    "avatarUrl": "https://example.com/avatar.jpg",
    "trustScore": 86,
    "trustGrade": 4.3
  },
  "counts": {
    "createdPostCount": 5,
    "participatedPostCount": 2,
    "favoriteCount": 8,
    "unreadChatCount": 3,
    "unreadNotificationCount": 4
  },
  "trust": {
    "label": "신뢰도 좋은 거래 파트너예요",
    "badges": ["꼼꼼해요", "친절해요", "약속시간 잘 지켜요"],
    "completedTradeCount": 12,
    "responseRate": 92,
    "cancelCount": 1,
    "noShowCount": 0
  }
}
```

### 프론트엔드 영향

마이페이지 상단 프로필, 공구 카운트, unread badge, 신뢰도 카드는 `GET /api/users/{id}/summary` 하나로 구성할 수 있다.

`user` 객체에는 `passwordHash`와 `email`을 포함하지 않는다. 사용자 화면에서는 `trustGrade`를 우선 표시하고, `trustScore`는 내부 정책 점수 확인이 필요한 경우에만 사용한다.

`responseRate`는 현재 별도 응답 시간 데이터가 없으므로 완료/취소/노쇼 이력 기반 완료 거래 비율로 계산한다.

### 검증 방법

```bash
npm run build
npm run openapi:generate
npm run openapi:lint
curl -s "http://localhost:3000/api/users/{id}/summary"
```

## 2026-05-17 - 내 공구 탭별 리스트 API 추가

브랜치:

```text
feature/my-posts-list-api
```

변경 전 기준 커밋:

```text
b1e7b96
```

### 변경 요약

내 공구 화면의 등록한 공구, 참여한 공구, 관심 공구 탭 카드 목록을 하나의 API에서 조회할 수 있도록 신규 API를 추가했다.

기존 `GET /api/users/{userId}/my-posts/summary`는 탭 상단 카운트만 제공했다. 이번 변경은 탭 본문 카드 리스트를 페이지네이션, 검색어, 상태 필터와 함께 제공한다.

### 신규 API

```text
GET /api/users/{userId}/my-posts
```

### Query Parameters

```text
tab: registered | participated | favorites
status: 탭별 상태 필터
q 또는 keyword: 검색어
category: food | daily | beauty | electronics | school | freemarket
sort: latest | deadline | popular
limit: 조회 개수
offset: 시작 위치
deadlineSoonHours: deadlineSoon 필터 기준 시간
recentDays: favorites recent 필터 기준 일수
```

`status`는 탭별로 다르게 해석된다.

```text
registered:
inProgress
deadlineSoon
completed
open
closed
in_progress
cancelled

participated:
participating
payment_pending
paymentPending
pickup_ready
pickupReady
received
open
closed
in_progress
completed
cancelled

favorites:
deadlineSoon
recent
open
closed
in_progress
completed
cancelled
```

### 응답

응답 형태:

```json
{
  "tab": "participated",
  "items": [
    {
      "id": "post-id",
      "title": "물티슈 공동구매",
      "thumbnailUrl": "https://example.com/wipes.jpg",
      "favoriteCount": 3,
      "isFavorite": true,
      "isParticipant": true,
      "isOwner": false,
      "deadlineStatus": "open",
      "deadlineLabel": "모집중",
      "remainingSeconds": 3600,
      "myPostTab": "participated",
      "myPostRole": "participant",
      "myPostStatus": "payment_pending",
      "participantStatus": "payment_pending",
      "participantStatusLabel": "입금대기",
      "participatedAt": "2026-05-17T00:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "hasNext": false,
  "filters": {
    "status": "payment_pending",
    "keyword": null,
    "category": null,
    "sort": "latest"
  }
}
```

### Swagger 스키마 변경

추가된 스키마:

```text
components.schemas.MyPostsListItem
components.schemas.MyPostsListResponse
```

### 프론트엔드 영향

내 공구 페이지의 탭 본문은 다음 API 하나로 조회할 수 있다.

```bash
curl -s "http://localhost:3000/api/users/{userId}/my-posts?tab=registered&status=inProgress&limit=20&offset=0"
curl -s "http://localhost:3000/api/users/{userId}/my-posts?tab=participated&status=payment_pending&limit=20&offset=0"
curl -s "http://localhost:3000/api/users/{userId}/my-posts?tab=favorites&status=recent&limit=20&offset=0"
```

카드는 기존 Post 카드 필드와 함께 `myPostTab`, `myPostRole`, `myPostStatus`를 기준으로 탭별 액션 버튼과 배지를 결정할 수 있다.

## 2026-05-16 - Post 등록/상세 UI 필드 확장

브랜치:

```text
feature/post-detail-fields
```

변경 전 기준 커밋:

```text
0b16e89
```

### 변경 요약

공동구매 등록/상세 화면에서 사용하는 상품명, 수령 일정, 수령 안내, 공구 유형, 태그, 공지 필드를 Post 요청/응답 계약에 추가했다.

기존 `title`, `deadline`, `pickupLocation`, `content`는 유지하며, 새 필드는 모두 nullable/optional로 열어 기존 클라이언트 요청과 기존 데이터와의 호환성을 유지한다.

### 변경된 API

```text
GET /api/posts
GET /api/posts/{id}
POST /api/posts
PUT /api/posts/{id}
PATCH /api/posts/{id}/status
GET /api/posts/student/{studentId}
GET /api/users/{userId}/favorites
```

### 요청 바디 변경

`POST /api/posts`, `PUT /api/posts/{id}`의 `post` 객체에 다음 필드가 추가된다.

```text
productName
pickupDate
pickupStartTime
pickupEndTime
pickupGuide
groupBuyType
tags
notice
```

예시:

```json
{
  "post": {
    "authorId": "a87522bd-bc79-47b0-a73f-46ea4068a158",
    "title": "물티슈 공동구매",
    "productName": "도톰한 엠보싱 물티슈 100매",
    "content": "100매 대용량 물티슈를 함께 구매합니다.",
    "price": 5900,
    "minParticipants": 3,
    "deadline": "2026-06-17T23:59:59.000Z",
    "pickupLocation": "명지대 정문앞",
    "pickupDate": "2026-06-18",
    "pickupStartTime": "17:00",
    "pickupEndTime": "19:00",
    "pickupGuide": "정문 앞 파란 우산 근처에서 수령해 주세요.",
    "groupBuyType": "campus_pickup",
    "tags": ["대용량", "생활용품"],
    "notice": "입금 확인 후 주문 예정입니다.",
    "category": "daily"
  }
}
```

### 응답 스키마 변경

`components.schemas.Post`, `components.schemas.PostDetail`에 같은 필드가 추가된다.

`productName`은 기존 게시글처럼 값이 비어 있는 경우 응답에서 `title`을 fallback으로 내려준다.

### 검색 영향

`GET /api/posts?q=` 검색 대상이 다음 필드까지 확장된다.

```text
productName
pickupGuide
notice
```

### 프론트엔드 영향

등록/수정 화면은 새 필드를 그대로 전송할 수 있다.

상세 화면은 수령 날짜/시간/안내/공지/태그를 별도 API 없이 `GET /api/posts/{id}` 응답에서 표시할 수 있다.

기존 클라이언트가 새 필드를 보내지 않아도 서버는 기존 `title`, `deadline`, `pickupLocation`, `content` 기반으로 계속 동작한다.

## 2026-05-16 - Post UI 계약 응답 보강

브랜치:

```text
feature/post-ui-contract
```

변경 전 기준 커밋:

```text
26bbce5
```

### 변경 요약

홈, 카테고리, 검색, 상세, 참여, 찜 화면이 카드 상태를 별도 API 조합 없이 렌더링할 수 있도록 Post 관련 응답 계약을 보강했다.

### 변경된 API

```text
GET /api/posts
GET /api/posts/{id}
POST /api/posts/{id}/participate
DELETE /api/posts/{id}/participate/{userId}
POST /api/posts/{postId}/favorite
DELETE /api/posts/{postId}/favorite/{userId}
```

### GET /api/posts 응답 변경

기존에는 배열을 직접 반환했다.

```json
[
  {
    "id": "postId"
  }
]
```

변경 후에는 페이지 메타데이터를 포함한 객체를 반환한다.

```json
{
  "items": [
    {
      "id": "postId",
      "favoriteCount": 12,
      "isFavorite": true,
      "isParticipant": false,
      "isOwner": false,
      "thumbnailUrl": "https://example.com/image.jpg",
      "deadlineStatus": "closingSoon",
      "deadlineLabel": "오늘 마감",
      "remainingSeconds": 3600
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0,
  "hasNext": true
}
```

### GET /api/posts/{id} 응답 추가 필드

상세 응답에 다음 필드를 추가했다.

```text
isOwner
thumbnailUrl
participantsPreview
participantsTotal
deadlineStatus
deadlineLabel
remainingSeconds
```

기존 `author`, `participants`, `favoriteCount`, `isFavorite`, `isParticipant`는 유지한다.

### 참여/참여취소 응답 변경

참여 후 프론트가 진행률을 즉시 갱신할 수 있도록 최소 게시글 스냅샷을 반환한다.

```json
{
  "isParticipant": true,
  "post": {
    "id": "postId",
    "currentQuantity": 2,
    "minParticipants": 3,
    "status": "open"
  }
}
```

참여 취소는 `isParticipant`가 `false`로 내려간다.

### 찜 등록/해제 응답 변경

카드와 상세의 하트 상태 및 관심 수를 즉시 갱신할 수 있도록 최신 카운트를 반환한다.

```json
{
  "isFavorite": true,
  "favoriteCount": 13
}
```

찜 해제는 `isFavorite`가 `false`로 내려간다.

### 정렬 기준 변경

`sort=deadline`은 마감 전 게시글을 먼저 보여준 뒤 `deadline ASC`, `createdAt DESC` 순서로 정렬한다.

`sort=popular` 기준을 프론트 요구에 맞춰 다음 순서로 확정했다.

```text
currentQuantity DESC
favoriteCount DESC
createdAt DESC
```

### 검색 기준 보강

`keyword`/`q` 검색은 기존 `title`, `content`, `pickupLocation`에 더해 카테고리 ID와 주요 한글 라벨도 매칭한다.

### 프론트엔드 영향

`GET /api/posts`는 배열에서 객체로 바뀌므로 프론트엔드에서 `response.items`를 사용해야 한다. 카드 UI는 `thumbnailUrl`, `isFavorite`, `isParticipant`, `isOwner`, `deadlineStatus`, `deadlineLabel`, `remainingSeconds`를 직접 사용할 수 있다.

### 확인 명령

```bash
curl -s "http://localhost:3000/api/posts?status=open&sort=latest&limit=20&offset=0&userId={userId}"
curl -s "http://localhost:3000/api/posts/{postId}?userId={userId}"
```

## 2026-05-15 - 내 공구 탭 요약 API 추가

브랜치:

```text
feature/participant-status
```

변경 전 기준 커밋:

```text
d7461d0
```

### 변경 요약

내 공구 화면의 세 탭 상단 카운트를 프론트엔드가 목록 전체를 내려받아 직접 세지 않아도 되도록 요약 API를 추가했다.

### 추가된 API

```text
GET /api/users/{userId}/my-posts/summary
```

쿼리 파라미터:

```text
deadlineSoonHours: 마감임박 기준 시간. 기본값 24
recentDays: 최근 추가 기준 일수. 기본값 7
```

### 응답 예시

```json
{
  "registered": {
    "inProgress": 3,
    "deadlineSoon": 1,
    "completed": 5
  },
  "participated": {
    "participating": 4,
    "paymentPending": 1,
    "pickupReady": 2,
    "received": 6
  },
  "favorites": {
    "total": 8,
    "deadlineSoon": 2,
    "recent": 3
  },
  "meta": {
    "deadlineSoonHours": 24,
    "recentDays": 7
  }
}
```

### 집계 기준

등록한 공구:

```text
inProgress = 작성자가 등록한 active 공구 수(open, closed, in_progress)
deadlineSoon = 작성자가 등록한 모집중(open) 공구 중 현재 시각 이후 deadlineSoonHours 이내 마감
completed = 작성자가 등록한 completed 공구 수
```

참여한 공구:

```text
participating = participantStatus participating
paymentPending = participantStatus payment_pending
pickupReady = participantStatus pickup_ready
received = participantStatus received
```

관심 공구:

```text
total = 찜한 상품 전체 수
deadlineSoon = 찜한 모집중(open) 공구 중 현재 시각 이후 deadlineSoonHours 이내 마감
recent = recentDays 이내 관심 등록 수
```

### 프론트엔드 영향

내 공구 화면 상단 카운트는 다음 값으로 바로 렌더링할 수 있다.

```text
등록한 공구: registered.inProgress, registered.deadlineSoon, registered.completed
참여한 공구: participated.participating, participated.paymentPending, participated.received
관심 공구: favorites.total, favorites.deadlineSoon, favorites.recent
```

`participated.pickupReady`는 카드 배지 또는 추후 상단 지표에 사용할 수 있도록 함께 내려준다.

확인 명령:

```bash
curl -s "http://localhost:3000/api/users/{userId}/my-posts/summary"
curl -s "http://localhost:3000/api/users/{userId}/my-posts/summary?deadlineSoonHours=48&recentDays=3"
```

## 2026-05-14 - 참여자별 진행 상태 API 추가

브랜치:

```text
feature/participant-status
```

변경 전 기준 커밋:

```text
8953132
```

### 변경 요약

내 공구 화면에서 참여자별 진행 상태를 표시하고 변경할 수 있도록 참여 row에 `participantStatus`를 추가했다.

게시글 전체 진행 상태는 기존 `posts.status`를 유지하고, 사용자별 상태는 `post_participants.participant_status`를 기준으로 내려준다.

### Swagger/OpenAPI 스키마 변경

대상 파일:

```text
src/config/swagger.ts
src/routes/posts/PostRoutes.ts
```

추가된 스키마:

```text
components.schemas.ParticipantStatus
components.schemas.PostParticipant
components.schemas.ParticipatedPost
```

변경된 스키마:

```text
components.schemas.PostParticipantProfile
```

추가된 API:

```text
PATCH /api/posts/{id}/participants/{userId}/status
```

변경된 API 응답:

```text
GET /api/posts/{id}
GET /api/posts/{id}/participants
GET /api/posts/user/{userId}/participated
```

### 참여 상태값

```text
participating = 참여중
payment_pending = 입금대기
pickup_ready = 수령예정
received = 수령완료
```

### 신규 API 요청 예시

```json
{
  "participantStatus": "payment_pending",
  "actorUserId": "a87522bd-bc79-47b0-a73f-46ea4068a158"
}
```

`actorUserId`는 `x-user-id` 헤더로도 전달할 수 있다.

권한 기준:

```text
게시글 작성자 또는 해당 참여자 본인만 변경 가능
```

### API 응답 영향

상세 응답의 참여자 목록:

```json
{
  "participants": [
    {
      "id": "7f7b9a5c-0e86-4f93-bd11-31e9bde8a7f2",
      "userId": "123e4567-e89b-12d3-a456-426614174000",
      "participantStatus": "participating",
      "joinedAt": "2026-05-14T10:00:00.000Z",
      "user": {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "nickname": "참여자 1",
        "studentId": "20241234",
        "department": "컴퓨터공학과",
        "avatarUrl": null,
        "trustGrade": 4.1
      }
    }
  ]
}
```

내 참여 공구 응답:

```json
{
  "id": "7f7b9a5c-0e86-4f93-bd11-31e9bde8a7f2",
  "postId": "123e4567-e89b-12d3-a456-426614174000",
  "userId": "a87522bd-bc79-47b0-a73f-46ea4068a158",
  "participantStatus": "payment_pending",
  "post": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "물티슈 공동구매",
    "price": 5900,
    "minParticipants": 3,
    "status": "open",
    "deadline": "2026-06-17T23:59:59.000Z"
  }
}
```

### 프론트엔드 영향

내 공구 화면의 참여 공구 탭은 `participantStatus`로 배지를 분기한다.

```text
participating -> 참여중
payment_pending -> 입금대기
pickup_ready -> 수령예정
received -> 수령완료
```

상태 변경 버튼은 다음 API를 호출한다.

```bash
curl -X PATCH "http://localhost:3000/api/posts/{postId}/participants/{userId}/status" \
  -H "Content-Type: application/json" \
  -d '{"participantStatus":"payment_pending","actorUserId":"{actorUserId}"}'
```

확인 명령:

```bash
curl -s "http://localhost:3000/api/posts/{postId}?userId={userId}"
curl -s "http://localhost:3000/api/posts/{postId}/participants"
curl -s "http://localhost:3000/api/posts/user/{userId}/participated"
curl -s "http://localhost:3000/api-docs.json"
```

## 2026-05-14 - 게시글 상세 응답에 작성자/참여자 프로필 추가

브랜치:

```text
feature/post-detail-profiles
```

변경 전 기준 커밋:

```text
19bbe6d
```

### 변경 요약

공구 상세 화면에서 게시글 본문, 작성자 프로필, 참여자 프로필, 관심/참여 상태를 한 번에 렌더링할 수 있도록 `GET /api/posts/{id}` 응답을 상세 화면용 스키마로 확장했다.

### Swagger/OpenAPI 스키마 변경

대상 파일:

```text
src/config/swagger.ts
src/routes/posts/PostRoutes.ts
```

추가된 스키마:

```text
components.schemas.PublicUserProfile
components.schemas.PostParticipantProfile
components.schemas.PostDetail
```

변경된 API:

```text
GET /api/posts/{id}
```

변경 전 응답 스키마:

```text
Post
```

변경 후 응답 스키마:

```text
PostDetail
```

### API 응답 영향

기존 상세 응답 필드는 유지하면서 다음 필드를 추가한다.

```json
{
  "author": {
    "id": "a87522bd-bc79-47b0-a73f-46ea4068a158",
    "nickname": "다마라 공식",
    "studentId": "20241234",
    "department": "생활용품 판매자",
    "avatarUrl": "https://example.com/avatar.jpg",
    "trustGrade": 4.3
  },
  "participants": [
    {
      "id": "7f7b9a5c-0e86-4f93-bd11-31e9bde8a7f2",
      "userId": "123e4567-e89b-12d3-a456-426614174000",
      "joinedAt": "2026-05-14T10:00:00.000Z",
      "user": {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "nickname": "참여자 1",
        "studentId": "20241234",
        "department": "컴퓨터공학과",
        "avatarUrl": null,
        "trustGrade": 4.1
      }
    }
  ],
  "participantCount": 1,
  "isParticipant": false
}
```

보안/노출 기준:

```text
passwordHash, email은 상세 프로필에 포함하지 않는다.
trustScore는 내부 정책 점수이므로 상세 프로필에는 포함하지 않고 trustGrade만 노출한다.
```

### 프론트엔드 영향

상세 화면에서 별도 사용자 조회 API를 추가 호출하지 않고 다음 영역을 렌더링할 수 있다.

```text
주최자/판매자 프로필: author
참여자 프로필 목록: participants
참여 버튼 상태: isParticipant
관심 버튼 상태: isFavorite
참여자 수 표시: currentQuantity 또는 participantCount
```

사용자별 하트/참여 상태가 필요하면 기존과 동일하게 `x-user-id` 헤더 또는 `userId` 쿼리를 전달한다.

확인 명령:

```bash
curl -s "http://localhost:3000/api/posts/{postId}?userId={userId}"
curl -s "http://localhost:3000/api-docs.json"
```

## 2026-05-13 - OpenAPI 스냅샷, lint, diff 도구 추가

브랜치:

```text
feature/api-docs-tooling
```

변경 전 기준 커밋:

```text
7a8eeb8
```

### 변경 요약

Swagger UI와 `/api-docs.json`은 그대로 유지하면서, API 계약 변경을 파일과 CLI로 추적할 수 있도록 OpenAPI 도구 체계를 추가했다.

### 추가 파일

```text
docs/openapi/openapi.json
docs/api/OPENAPI_TOOLING.md
.spectral.yaml
scripts/export-openapi.ts
```

### 추가 npm script

```text
openapi:generate
openapi:lint
openapi:diff
openapi:diff:breaking
```

### Swagger/OpenAPI 스키마 정리

Spectral의 OpenAPI 기본 검사를 통과하도록 기존 Swagger 설정의 유효성 오류를 정리했다.

```text
info.contact.studentId -> info.contact.x-student-id
Favorite.post의 $ref sibling 제거
전역 tags 정의 추가
```

### API 계약 영향

요청 path, query, body, status code, 응답 필드는 바뀌지 않았다.

이번 변경은 API 문서를 생성, 검사, 비교하는 운영 방식 변경이다.

### 검증 명령

```bash
npm run openapi:generate
npm run openapi:lint
npm run openapi:diff:breaking -- docs/openapi/openapi.json docs/openapi/openapi.json
```

## 2026-05-09 - 신뢰학점 스키마 반영

브랜치:

```text
feature/trust-safety-filtering
```

변경 전 기준 커밋:

```text
7e9f230
```

### 변경 요약

신뢰도 기능을 기존 `trustScore` 단일 값에서 내부 점수와 사용자 표시 학점으로 분리했다.

기존에는 Swagger의 `User` 스키마가 다음 개념만 표현했다.

```text
trustScore
= 사용자 신뢰점수
= 0~100
= 기본값 50
```

이번 변경 후에는 다음처럼 나뉜다.

```text
trustScore
= 백엔드 내부 정책 계산용 점수
= 0~100
= 기본값 50

trustGrade
= 사용자에게 보여주는 신뢰학점
= 2.5~4.5
= 기본값 3.5
```

### Swagger 스키마 변경

대상 파일:

```text
src/config/swagger.ts
```

변경된 스키마:

```text
components.schemas.User
```

변경 전 `required`:

```json
["id", "email", "nickname", "studentId", "trustScore"]
```

변경 후 `required`:

```json
["id", "email", "nickname", "studentId", "trustScore", "trustGrade"]
```

변경 전 `trustScore` 설명:

```text
신뢰점수 (0~100, 기본값: 50)
```

변경 후 `trustScore` 설명:

```text
내부 신뢰점수 (0~100, 기본값: 50)
```

추가된 필드:

```json
{
  "trustGrade": {
    "type": "number",
    "format": "float",
    "description": "사용자에게 표시하는 신뢰학점 (2.5~4.5, 기본값: 3.5)",
    "minimum": 2.5,
    "maximum": 4.5,
    "example": 3.5
  }
}
```

### API 응답 영향

`User` 스키마를 참조하는 응답에서 `trustGrade`가 함께 내려간다.

대표 영향 범위:

```text
POST /api/users
POST /api/users/login
GET /api/users
GET /api/users/{id}
PUT /api/users/{id}
OAuth 로그인/세션 사용자 응답
```

응답 예시는 다음 형태를 기준으로 한다.

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "test@mju.ac.kr",
  "nickname": "홍길동",
  "studentId": "20241234",
  "trustScore": 50,
  "trustGrade": 3.5
}
```

### 프론트엔드 영향

프론트엔드는 사용자에게 `trustScore`를 직접 보여주기보다 `trustGrade`를 표시하는 것이 맞다.

권장 표시:

```text
신뢰학점: 3.5
```

내부 관리나 정책 판단이 필요한 화면이 아니라면 `trustScore`는 숨긴다.

### 당시 변경되지 않은 것

이 시점의 변경에서는 Swagger에 신규 엔드포인트를 추가하지 않았다.

`trust_events` 테이블과 `TrustService`는 백엔드 내부 정책 이력 저장용으로 추가되었지만, 아직 다음 API는 만들지 않았다.

```text
GET /api/users/{id}/trust-events
PATCH /api/admin/users/{id}/trust-score
POST /api/posts/{id}/participants/{userId}/no-show
```

이 API들이 추가되면 이 문서에 별도 항목으로 기록한다.

## 2026-05-09 - 신뢰 이벤트 조회 API 추가

브랜치:

```text
feature/trust-safety-filtering
```

### 변경 요약

사용자 신뢰학점이 왜 바뀌었는지 확인할 수 있도록 신뢰 이벤트 조회 API를 추가했다.

신규 API:

```text
GET /api/users/{id}/trust-events
```

### 요청

Path parameter:

```text
id: 사용자 UUID
```

Query parameter:

```text
limit: 조회 개수, 기본값 20
offset: 시작 위치, 기본값 0
```

예시:

```bash
curl -s "https://damara.bluerack.org/api/users/{id}/trust-events?limit=20&offset=0"
```

### 응답

응답 형태:

```json
{
  "trustEvents": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "userId": "a87522bd-bc79-47b0-a73f-46ea4068a158",
      "postId": "123e4567-e89b-12d3-a456-426614174000",
      "actorUserId": "a87522bd-bc79-47b0-a73f-46ea4068a158",
      "type": "post_completed_author",
      "scoreChange": 10,
      "previousScore": 50,
      "nextScore": 60,
      "previousGrade": 3.5,
      "nextGrade": 3.7,
      "reason": "공동구매 거래 완료: 작성자 보상",
      "metadata": null,
      "createdAt": "2026-05-09T00:00:00.000Z",
      "updatedAt": "2026-05-09T00:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

### Swagger 스키마 변경

추가된 스키마:

```text
components.schemas.TrustEvent
```

주요 필드:

```text
scoreChange
previousScore
nextScore
previousGrade
nextGrade
reason
type
```

`previousScore`와 `nextScore`는 백엔드 내부 정책 점수다.

`previousGrade`와 `nextGrade`는 프론트엔드 화면에 표시하기 쉬운 신뢰학점 값이다.

### 프론트엔드 영향

마이페이지나 관리자 화면에서 “왜 이 사용자의 신뢰학점이 바뀌었는지”를 보여줄 수 있다.

사용자-facing 화면에서는 다음 필드를 우선 사용한다.

```text
previousGrade
nextGrade
reason
createdAt
```

`previousScore`, `nextScore`, `scoreChange`는 정책 확인이나 관리자용 화면에서만 노출하는 것을 권장한다.

### 확인 방법

로컬에서 빌드 확인:

```bash
npm run build
```

배포 후 Swagger JSON 확인:

```bash
curl -s https://damara.bluerack.org/api-docs.json | grep -A20 '"User"'
curl -s https://damara.bluerack.org/api-docs.json | grep -A20 '"TrustEvent"'
```

`servers` 값 확인:

```bash
curl -s https://damara.bluerack.org/api-docs.json | grep -A8 '"servers"'
```

정상 배포 상태에서는 `servers`에 HTTPS 서버가 잡혀야 한다.

```json
[
  {
    "url": "https://damara.bluerack.org",
    "description": "Current server (자동 감지)"
  }
]
```

## 다음 변경 시 기록할 후보

앞으로 신뢰/보안 기능이 확장되면 Swagger 변경 이력에 다음 항목을 추가한다.

```text
사전 약속 확인 API
노쇼 신고 API
관리자 신뢰도 수동 조정 API
학교 인증 단계 API
신뢰학점 기반 참여 제한/필터링 API
```

## 2026-05-25 - 게시글 예외 케이스 API 추가

### 배경

프론트엔드 팜플렛의 예외 케이스 대응 화면은 가격 변경, 품절, 수령 정보 변경, 파손/누락/불량 같은 사건을 게시글 상태와 별도로 추적해야 한다.

게시글의 큰 흐름은 기존 `posts.status`가 담당하고, 참여자별 진행 상태는 `post_participants.participant_status`가 담당한다. 이번 변경에서는 게시글 진행 중 발생한 예외 사건을 별도 API와 스키마로 제공한다.

### 신규 API

```text
GET /api/posts/{id}/exceptions
POST /api/posts/{id}/exceptions
PATCH /api/posts/{id}/exceptions/{exceptionId}/status
```

### 신규 스키마

```text
components.schemas.PostExceptionType
components.schemas.PostExceptionStatus
components.schemas.PostExceptionSeverity
components.schemas.PostException
components.schemas.PostExceptionSummary
components.schemas.PostExceptionsResponse
```

### 예외 유형

```text
price_changed
sold_out
pickup_changed
damaged
seller_cancelled
other
```

### 예외 상태

```text
open
resolved
dismissed
```

### 상세 응답 변경

`GET /api/posts/{id}` 응답에 `exceptionSummary`가 추가된다.

또한 홈 피드, 내 공구, 관심 공구 카드 응답도 같은 `exceptionSummary`를 포함한다. 프론트엔드는 상세 진입 전 카드에서 예외 배지와 경고 색상을 표시할 수 있다.

```json
{
  "exceptionSummary": {
    "hasOpenException": true,
    "openCount": 1,
    "latestType": "price_changed",
    "latestTitle": "가격이 변경되었어요",
    "latestMessage": "할인 종료로 실제 구매 가격이 5,900원에서 6,900원으로 변경되었습니다.",
    "severity": "warning",
    "latest": {
      "id": "exception-id",
      "type": "price_changed",
      "typeLabel": "가격 변경",
      "status": "open",
      "reason": "할인 종료로 실제 구매 가격이 상승했습니다.",
      "displayTitle": "가격이 변경되었어요",
      "displayMessage": "할인 종료로 실제 구매 가격이 5,900원에서 6,900원으로 변경되었습니다.",
      "severity": "warning",
      "handlingGuide": "참여자에게 알리고 계속 참여 또는 취소 여부를 확인하세요."
    }
  }
}
```

처리 중인 예외가 없으면 다음처럼 내려간다.

```json
{
  "exceptionSummary": {
    "hasOpenException": false,
    "openCount": 0,
    "latestType": null,
    "latestTitle": null,
    "latestMessage": null,
    "severity": null,
    "latest": null
  }
}
```

### 알림 영향

예외 케이스 등록 시 작성자와 참여자에게 `post_exception` 알림이 생성된다. 예외를 등록한 사용자는 중복 알림 대상에서 제외된다.

### 프론트엔드 영향

상세 화면은 `exceptionSummary.hasOpenException`으로 경고 배지를 표시할 수 있다.

홈/내 공구/관심 공구 카드에서는 다음 경량 필드를 우선 사용한다.

```text
exceptionSummary.hasOpenException
exceptionSummary.openCount
exceptionSummary.latestType
exceptionSummary.latestTitle
exceptionSummary.latestMessage
exceptionSummary.severity
```

예외 이력 화면은 `GET /api/posts/{id}/exceptions`를 사용한다.

예외 등록 화면은 다음 요청 바디를 사용한다.

```json
{
  "exception": {
    "type": "price_changed",
    "reason": "할인 종료로 실제 구매 가격이 상승했습니다.",
    "displayTitle": "가격이 변경되었어요",
    "displayMessage": "할인 종료로 실제 구매 가격이 5,900원에서 6,900원으로 변경되었습니다.",
    "severity": "warning",
    "oldPrice": 5900,
    "newPrice": 6900
  }
}
```

상태 변경은 다음 요청 바디를 사용한다.

```json
{
  "status": "resolved",
  "resolutionNote": "참여자 동의 후 변경 가격으로 진행했습니다."
}
```

### 검증

```bash
npm run build
npm run openapi:generate
npm run openapi:lint
```
