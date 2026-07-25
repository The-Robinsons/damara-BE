# DAMARA ERD

작성일: 2026-06-03

기준 코드:

```text
src/models
```

이 문서는 현재 Sequelize 모델 기준의 실제 DB 구조를 정리한다.

## 전체 ERD

```mermaid
erDiagram
    users {
      UUID id PK
      STRING email UK
      STRING password_hash
      STRING nickname
      STRING department
      STRING student_id UK
      STRING avatar_url
      INTEGER trust_score
      DATETIME created_at
      DATETIME updated_at
    }

    email_verifications {
      UUID id PK
      STRING email
      STRING purpose
      STRING code_hash
      STRING token_hash UK
      INTEGER attempt_count
      INTEGER max_attempts
      DATETIME expires_at
      DATETIME verified_at
      DATETIME token_expires_at
      DATETIME consumed_at
      DATETIME invalidated_at
      STRING request_ip_hash
      DATETIME created_at
      DATETIME updated_at
    }

    posts {
      UUID id PK
      UUID author_id FK
      STRING title
      STRING product_name
      TEXT content
      DECIMAL price
      INTEGER min_participants
      INTEGER current_quantity
      ENUM status
      DATETIME deadline
      STRING pickup_type
      STRING pickup_zone_id
      STRING pickup_location
      DATE pickup_date
      TIME pickup_start_time
      TIME pickup_end_time
      TEXT pickup_guide
      STRING group_buy_type
      STRING group_buy_mode
      INTEGER target_participants
      DECIMAL target_price
      JSON tags
      TEXT notice
      STRING category
      DATETIME created_at
      DATETIME updated_at
    }

    post_images {
      UUID id PK
      UUID post_id FK
      STRING image_url
      SMALLINT sort_order
      DATETIME created_at
    }

    post_participants {
      UUID id PK
      UUID post_id FK
      UUID user_id FK
      ENUM participant_status
      DATETIME created_at
      DATETIME updated_at
    }

    favorites {
      UUID id PK
      UUID user_id FK
      UUID post_id FK
      DATETIME created_at
      DATETIME updated_at
    }

    chat_rooms {
      UUID id PK
      UUID post_id FK_UK
      DATETIME created_at
      DATETIME updated_at
    }

    messages {
      UUID id PK
      UUID chat_room_id FK
      UUID sender_id FK
      TEXT content
      ENUM message_type
      BOOLEAN is_read
      DATETIME created_at
      DATETIME updated_at
    }

    notifications {
      UUID id PK
      UUID user_id FK
      ENUM type
      STRING title
      TEXT message
      UUID post_id FK
      UUID chat_room_id FK
      STRING action_url
      BOOLEAN is_read
      DATETIME created_at
      DATETIME updated_at
    }

    user_settings {
      UUID id PK
      UUID user_id FK_UK
      BOOLEAN push_enabled
      BOOLEAN chat_notification_enabled
      BOOLEAN post_notification_enabled
      BOOLEAN marketing_notification_enabled
      BOOLEAN quiet_hours_enabled
      STRING quiet_hours_start
      STRING quiet_hours_end
      DATETIME created_at
      DATETIME updated_at
    }

    trust_events {
      UUID id PK
      UUID user_id FK
      UUID post_id FK
      UUID actor_user_id FK
      ENUM type
      INTEGER score_change
      INTEGER previous_score
      INTEGER next_score
      STRING reason
      JSON metadata
      DATETIME created_at
      DATETIME updated_at
    }

    post_exceptions {
      UUID id PK
      UUID post_id FK
      UUID reporter_id FK
      ENUM type
      ENUM status
      TEXT reason
      STRING display_title
      STRING display_message
      ENUM severity
      DECIMAL old_price
      DECIMAL new_price
      INTEGER affected_quantity
      JSON metadata
      TEXT resolution_note
      DATETIME created_at
      DATETIME updated_at
    }

    notices {
      UUID id PK
      STRING title
      STRING summary
      TEXT content
      ENUM type
      BOOLEAN is_pinned
      DATETIME created_at
      DATETIME updated_at
    }

    faqs {
      UUID id PK
      ENUM category
      STRING question
      TEXT answer
      INTEGER sort_order
      BOOLEAN is_active
      DATETIME created_at
      DATETIME updated_at
    }

    users ||--o{ posts : "작성"
    posts ||--o{ post_images : "이미지"
    users ||--o{ post_participants : "참여"
    posts ||--o{ post_participants : "참여자"
    users ||--o{ favorites : "찜"
    posts ||--o{ favorites : "찜 대상"
    posts ||--o| chat_rooms : "채팅방"
    chat_rooms ||--o{ messages : "메시지"
    users ||--o{ messages : "발신"
    users ||--o{ notifications : "수신"
    posts |o--o{ notifications : "관련 게시글"
    chat_rooms |o--o{ notifications : "관련 채팅방"
    users ||--o| user_settings : "설정"
    users ||--o{ trust_events : "신뢰 점수 대상"
    users |o--o{ trust_events : "신뢰 이벤트 행위자"
    posts |o--o{ trust_events : "관련 게시글"
    posts ||--o{ post_exceptions : "예외 상황"
    users ||--o{ post_exceptions : "신고자"
```

## 도메인별 해석

### 1. 사용자

`users`는 DAMARA의 사용자 기본 정보 테이블이다.

주요 필드:

```text
email: 로그인/식별용 이메일, unique
student_id: 학번, unique
avatar_url: 프로필 이미지 URL
trust_score: 내부 신뢰 점수
```

`user_settings`는 사용자별 알림 설정이다. `users`와 1:1 관계이며 `user_id`가 unique이다.

`email_verifications`는 회원가입 전에 이메일 소유 여부를 확인하기 위한 독립 테이블이다. 아직 생성되지 않은 사용자의 이메일을 다루므로 `users`와 FK 관계를 맺지 않는다. 인증번호와 일회성 토큰은 원문 대신 HMAC 해시로 저장하며, `consumed_at`으로 회원가입 사용 여부를 관리한다.

### 2. 공동구매 게시글

`posts`는 공동구매 게시글 본문 테이블이다.

주요 필드:

```text
author_id: 작성자 users.id
product_name: 상품명 검색/표시용 필드
price: 기본 가격
min_participants: 최소 참여 인원
current_quantity: 현재 참여 수량
status: 게시글 진행 상태
pickup_type: custom 또는 damara_zone
pickup_zone_id: 다마라존 선택 시 코드 기반 접선지 ID
group_buy_type: pre_recruit 또는 post_recruit
group_buy_mode: normal 또는 price_unlock
target_participants: 가격 해금 목표 인원
target_price: 가격 해금 후 목표 가격
category: 게시글 카테고리
```

`pickup_zone_id`는 별도 DB 테이블 FK가 아니다. 현재 다마라존은 `src/types/pickup-zone.ts`의 코드 상수로 관리한다.

### 3. 게시글 이미지

`post_images`는 게시글 이미지 목록이다.

관계:

```text
posts 1 : N post_images
```

모델상 `post_images.post_id`는 `posts.id`를 참조한다. 현재 모델에는 명시적인 `onDelete` 정책이 없으므로, 물리 삭제 정책은 운영 DB 제약과 Repository 로직을 함께 확인해야 한다.

### 4. 참여자

`post_participants`는 게시글과 사용자의 N:M 참여 관계를 표현하는 중간 테이블이다.

관계:

```text
posts N : M users
```

중복 참여 방지:

```text
unique(post_id, user_id)
```

참여 상태:

```text
participating
payment_pending
pickup_ready
received
```

### 5. 찜

`favorites`는 사용자가 관심 등록한 게시글을 저장한다.

관계:

```text
posts N : M users
```

중복 찜 방지:

```text
unique(user_id, post_id)
```

### 6. 채팅

`chat_rooms`는 게시글별 채팅방이다.

관계:

```text
posts 1 : 1 chat_rooms
chat_rooms 1 : N messages
users 1 : N messages
```

`chat_rooms.post_id`는 unique라서 게시글 하나에 채팅방 하나만 연결된다.

메시지 타입:

```text
text
image
system
file
```

`file`은 과거 데이터 호환용 legacy 타입이다.

### 7. 알림

`notifications`는 사용자에게 전달되는 알림이다.

관계:

```text
users 1 : N notifications
posts 1 : N notifications
chat_rooms 1 : N notifications
```

`post_id`, `chat_room_id`는 nullable이다. 시스템 알림처럼 게시글/채팅방과 직접 연결되지 않는 알림도 가능하므로 ERD에서도 선택 관계로 표시한다.

주요 필드:

```text
type: 알림 타입
title: 알림 제목
message: 알림 내용
action_url: 프론트 이동 URL
is_read: 읽음 여부
```

현재 주요 알림 타입:

```text
new_participant
post_deadline_soon
post_closed
post_status_changed
new_chat_message
favorite_post_deadline_soon
post_exception
trade_completed
trade_cancelled
system_notice
```

### 8. 신뢰 점수

`trust_events`는 사용자 신뢰 점수 변동 이력이다.

관계:

```text
users 1 : N trust_events
posts 1 : N trust_events
```

`user_id`는 점수가 변동되는 대상 사용자이고, `actor_user_id`는 이벤트를 발생시킨 행위자이다. `post_id`, `actor_user_id`는 nullable이며 삭제 시 `SET NULL`이다.

이벤트 타입:

```text
post_completed_author
post_completed_participant
post_cancelled_by_author
post_deleted_by_author
participant_cancelled
participant_no_show
agreement_confirmed
manual_adjustment
```

### 9. 공구 예외 상황

`post_exceptions`는 가격 변경, 품절, 수령 정보 변경, 파손 같은 공구 진행 중 예외 상황을 기록한다.

관계:

```text
posts 1 : N post_exceptions
users 1 : N post_exceptions
```

예외 타입:

```text
price_changed
sold_out
pickup_changed
damaged
seller_cancelled
other
```

상태:

```text
open
resolved
dismissed
```

심각도:

```text
info
warning
critical
```

### 10. 공지사항과 FAQ

`notices`와 `faqs`는 독립 테이블이다. 사용자나 게시글과 FK 관계를 맺지 않는다.

공지 타입:

```text
service
event
maintenance
policy
```

FAQ 카테고리:

```text
trade
account
payment
pickup
etc
```

## 주요 제약 조건

```text
users.email: unique
users.student_id: unique
chat_rooms.post_id: unique
user_settings.user_id: unique
post_participants(post_id, user_id): unique
favorites(user_id, post_id): unique
```

## 삭제 정책 요약

```text
users 삭제:
- posts: 작성자 FK 관계, 명시적 onDelete 없음
- post_participants: CASCADE
- favorites: CASCADE
- messages: CASCADE
- notifications: CASCADE
- user_settings: CASCADE
- trust_events.user_id: CASCADE
- trust_events.actor_user_id: SET NULL
- post_exceptions.reporter_id: CASCADE

posts 삭제:
- post_images: 명시적 onDelete 없음
- post_participants: CASCADE
- favorites: CASCADE
- chat_rooms: CASCADE
- notifications.post_id: CASCADE
- trust_events.post_id: SET NULL
- post_exceptions: CASCADE

chat_rooms 삭제:
- messages: CASCADE
- notifications.chat_room_id: CASCADE
```

## 논리 테이블로 관리되는 값

현재 다마라존은 DB 테이블이 아니라 코드 상수로 관리한다.

위치:

```text
src/types/pickup-zone.ts
```

대표 값:

```text
s2810
humanities-student-hall-3f-cafe
humanities-student-hall-front
dormitory-lobby
```

`posts.pickup_zone_id`는 이 코드 상수의 `id`를 저장하는 논리 참조값이다.
