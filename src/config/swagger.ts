import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express, Request, Response, NextFunction } from "express";
import ENV from "../common/constants/ENV";
import { PARTICIPANT_STATUSES } from "../types/participant-status";
import { NOTICE_TYPES } from "../types/notice";
import { FAQ_CATEGORIES } from "../types/faq";
import { NOTIFICATION_TYPES } from "../types/notification";
import { MESSAGE_TYPES } from "../types/chat";
import {
  POST_EXCEPTION_STATUSES,
  POST_EXCEPTION_TYPES,
} from "../types/post-exception";
import { GROUP_BUY_MODES, GROUP_BUY_TYPES } from "../types/group-buy";
import { PICKUP_TYPES, PICKUP_ZONE_CAMPUSES } from "../types/pickup-zone";

// 환경 변수에서 API 베이스 URL 가져오기 (배포 환경에서 설정)
const getServerUrl = () => {
  return ENV.ApiBaseUrl;
};

const getRuntimeServers = (currentServerUrl: string) => {
  const currentServer = {
    url: currentServerUrl,
    description: "Current server (자동 감지)",
  };

  if (!ENV.ApiBaseUrlConfigured || ENV.ApiBaseUrl === currentServerUrl) {
    return [currentServer];
  }

  return [
    {
      url: ENV.ApiBaseUrl,
      description: "Configured API Base URL",
    },
    currentServer,
  ];
};

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Thomas Anderson API",
      version: "1.0.0",
      description:
        "공동구매 플랫폼 API 문서. TypeScript + Express + Sequelize + MySQL로 구현되었습니다.",
      contact: {
        name: "최원빈",
        "x-student-id": "60203042",
      },
    },
    servers: [
      {
        url: getServerUrl(),
        description:
          ENV.NodeEnv === "production"
            ? "Production server"
            : "Development server",
      },
    ],
    tags: [
      {
        name: "Posts",
        description: "공동구매 게시글 API",
      },
      {
        name: "Users",
        description: "사용자 API",
      },
      {
        name: "Upload",
        description: "이미지 업로드 API",
      },
      {
        name: "Chat",
        description: "채팅 API",
      },
      {
        name: "Notifications",
        description: "알림 API",
      },
      {
        name: "Notices",
        description: "공지사항 API",
      },
      {
        name: "PickupZones",
        description: "다마라존 공식 접선지 API",
      },
      {
        name: "Faqs",
        description: "FAQ API",
      },
      {
        name: "Email Verifications",
        description: "회원가입 이메일 인증 API",
      },
    ],
    components: {
      schemas: {
        SendEmailVerificationRequest: {
          type: "object",
          required: ["email"],
          properties: {
            email: {
              type: "string",
              format: "email",
              pattern: "^[^@\\s]+@mju\\.ac\\.kr$",
              description:
                "명지대학교 이메일만 허용합니다. 앞뒤 공백 제거 후 소문자로 정규화합니다.",
              example: "student@mju.ac.kr",
            },
          },
        },
        SendEmailVerificationResponse: {
          type: "object",
          required: [
            "message",
            "expiresInSeconds",
            "resendAfterSeconds",
          ],
          properties: {
            message: {
              type: "string",
              example: "VERIFICATION_EMAIL_SENT",
            },
            expiresInSeconds: { type: "integer", example: 300 },
            resendAfterSeconds: { type: "integer", example: 60 },
          },
        },
        VerifyEmailVerificationRequest: {
          type: "object",
          required: ["email", "code"],
          properties: {
            email: {
              type: "string",
              format: "email",
              pattern: "^[^@\\s]+@mju\\.ac\\.kr$",
              description:
                "인증번호를 발급받은 명지대학교 이메일(@mju.ac.kr)",
              example: "student@mju.ac.kr",
            },
            code: {
              type: "string",
              pattern: "^[0-9]{6}$",
              example: "381204",
            },
          },
        },
        VerifyEmailVerificationResponse: {
          type: "object",
          required: [
            "verified",
            "emailVerificationToken",
            "expiresInSeconds",
          ],
          properties: {
            verified: { type: "boolean", example: true },
            emailVerificationToken: {
              type: "string",
              description: "회원가입에 한 번만 사용할 수 있는 인증 토큰",
              example: "opaque-one-time-token",
            },
            expiresInSeconds: { type: "integer", example: 900 },
          },
        },
        User: {
          type: "object",
          required: [
            "id",
            "email",
            "nickname",
            "studentId",
            "trustScore",
            "trustGrade",
          ],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "사용자 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            email: {
              type: "string",
              format: "email",
              description: "이메일 주소",
              example: "test@mju.ac.kr",
            },
            nickname: {
              type: "string",
              description: "닉네임",
              example: "홍길동",
            },
            studentId: {
              type: "string",
              description: "학번",
              example: "20241234",
            },
            department: {
              type: "string",
              nullable: true,
              description: "학과/부서",
              example: "컴퓨터공학과",
            },
            avatarUrl: {
              type: "string",
              format: "uri",
              nullable: true,
              description: "프로필 이미지 URL",
              example: "https://example.com/avatar.jpg",
            },
            trustScore: {
              type: "integer",
              description: "내부 신뢰점수 (0~100, 기본값: 50)",
              minimum: 0,
              maximum: 100,
              example: 50,
            },
            trustGrade: {
              type: "number",
              format: "float",
              description:
                "사용자에게 표시하는 신뢰학점 (2.5~4.5, 기본값: 3.5)",
              minimum: 2.5,
              maximum: 4.5,
              example: 3.5,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일시",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일시",
            },
          },
        },
        UserProfileImageResponse: {
          type: "object",
          required: ["avatarUrl", "user"],
          properties: {
            avatarUrl: {
              type: "string",
              nullable: true,
              description: "사용자에게 반영된 프로필 이미지 URL. null이면 이미지 없음",
              example: "/uploads/images/abc123.png",
            },
            image: {
              type: "object",
              nullable: true,
              description: "파일 업로드 요청에서 생성된 이미지 정보",
              properties: {
                imageUrl: {
                  type: "string",
                  example: "/uploads/images/abc123.png",
                },
                url: {
                  type: "string",
                  description: "기존 클라이언트 호환용 URL",
                  example: "/uploads/images/abc123.png",
                },
                filename: {
                  type: "string",
                  example: "abc123.png",
                },
              },
            },
            user: {
              $ref: "#/components/schemas/User",
            },
          },
        },
        UserSummaryResponse: {
          type: "object",
          required: ["user", "counts", "trust"],
          properties: {
            user: {
              type: "object",
              required: [
                "id",
                "nickname",
                "studentId",
                "trustScore",
                "trustGrade",
              ],
              description:
                "마이페이지 상단 프로필용 사용자 요약. passwordHash와 email은 포함하지 않습니다.",
              properties: {
                id: {
                  type: "string",
                  format: "uuid",
                  example: "a87522bd-bc79-47b0-a73f-46ea4068a158",
                },
                nickname: {
                  type: "string",
                  example: "노승민",
                },
                studentId: {
                  type: "string",
                  example: "20241234",
                },
                department: {
                  type: "string",
                  nullable: true,
                  example: "컴퓨터공학과",
                },
                avatarUrl: {
                  type: "string",
                  format: "uri",
                  nullable: true,
                  example: "https://example.com/avatar.jpg",
                },
                trustScore: {
                  type: "integer",
                  description: "내부 신뢰점수",
                  example: 86,
                },
                trustGrade: {
                  type: "number",
                  format: "float",
                  description: "사용자 표시용 신뢰학점",
                  example: 4.3,
                },
              },
            },
            counts: {
              type: "object",
              required: [
                "createdPostCount",
                "participatedPostCount",
                "favoriteCount",
                "unreadChatCount",
                "unreadNotificationCount",
              ],
              properties: {
                createdPostCount: {
                  type: "integer",
                  description: "사용자가 등록한 공구 수",
                  example: 5,
                },
                participatedPostCount: {
                  type: "integer",
                  description: "사용자가 참여한 공구 수",
                  example: 2,
                },
                favoriteCount: {
                  type: "integer",
                  description: "사용자가 찜한 공구 수",
                  example: 8,
                },
                unreadChatCount: {
                  type: "integer",
                  description: "사용자가 접근 가능한 채팅방의 읽지 않은 메시지 총합",
                  example: 3,
                },
                unreadNotificationCount: {
                  type: "integer",
                  description: "읽지 않은 알림 수",
                  example: 4,
                },
              },
            },
            trust: {
              type: "object",
              required: [
                "label",
                "badges",
                "completedTradeCount",
                "responseRate",
                "cancelCount",
                "noShowCount",
              ],
              properties: {
                label: {
                  type: "string",
                  description: "신뢰 카드 표시 문구",
                  example: "신뢰도 좋은 거래 파트너예요",
                },
                badges: {
                  type: "array",
                  description: "신뢰 카드 표시용 배지",
                  items: {
                    type: "string",
                  },
                  example: ["꼼꼼해요", "친절해요", "약속시간 잘 지켜요"],
                },
                completedTradeCount: {
                  type: "integer",
                  description: "완료된 거래 수",
                  example: 12,
                },
                responseRate: {
                  type: "integer",
                  description:
                    "현재 데이터 기준 완료 거래 비율. 완료/취소/노쇼 이력으로 계산합니다.",
                  minimum: 0,
                  maximum: 100,
                  example: 92,
                },
                cancelCount: {
                  type: "integer",
                  description: "취소 관련 신뢰 이벤트 수",
                  example: 1,
                },
                noShowCount: {
                  type: "integer",
                  description: "노쇼 확정 이벤트 수",
                  example: 0,
                },
              },
            },
          },
        },
        TrustSummaryResponse: {
          type: "object",
          required: [
            "trustScore",
            "trustGrade",
            "gradeLabel",
            "rankPercent",
            "completedTradeCount",
            "responseRate",
            "avgResponseMinutes",
            "cancelCount",
            "noShowCount",
            "badges",
          ],
          properties: {
            trustScore: {
              type: "integer",
              description: "내부 신뢰점수",
              minimum: 0,
              maximum: 100,
              example: 86,
            },
            trustGrade: {
              type: "number",
              format: "float",
              description: "사용자에게 표시하는 신뢰학점",
              minimum: 2.5,
              maximum: 4.5,
              example: 4.3,
            },
            gradeLabel: {
              type: "string",
              description: "신뢰학점 표시 라벨",
              example: "매너 학생",
            },
            rankPercent: {
              type: "integer",
              description:
                "현재 내부 신뢰점수 기반 추정 상위 퍼센트. 별도 랭킹 테이블이 생기면 실제 분포 기반으로 교체합니다.",
              minimum: 1,
              maximum: 100,
              example: 15,
            },
            completedTradeCount: {
              type: "integer",
              description: "완료된 거래 수",
              example: 12,
            },
            responseRate: {
              type: "integer",
              description:
                "현재 데이터 기준 완료 거래 비율. 완료/취소/노쇼 이력으로 계산합니다.",
              minimum: 0,
              maximum: 100,
              example: 92,
            },
            avgResponseMinutes: {
              type: "integer",
              description:
                "응답 시간 데이터가 생기기 전까지 신뢰학점 기반으로 제공하는 추정 평균 응답 시간",
              example: 10,
            },
            cancelCount: {
              type: "integer",
              description: "취소 관련 신뢰 이벤트 수",
              example: 1,
            },
            noShowCount: {
              type: "integer",
              description: "노쇼 확정 이벤트 수",
              example: 0,
            },
            badges: {
              type: "array",
              description: "신뢰 카드 표시용 배지",
              items: {
                type: "string",
              },
              example: ["꼼꼼해요", "친절해요", "약속시간 잘 지켜요"],
            },
          },
        },
        UserSettings: {
          type: "object",
          required: [
            "pushEnabled",
            "chatNotificationEnabled",
            "postNotificationEnabled",
            "marketingNotificationEnabled",
            "quietHoursEnabled",
            "quietHoursStart",
            "quietHoursEnd",
          ],
          properties: {
            pushEnabled: {
              type: "boolean",
              description: "전체 푸시 알림 허용 여부",
              example: true,
            },
            chatNotificationEnabled: {
              type: "boolean",
              description: "채팅 알림 허용 여부",
              example: true,
            },
            postNotificationEnabled: {
              type: "boolean",
              description: "공구 상태/참여 관련 알림 허용 여부",
              example: true,
            },
            marketingNotificationEnabled: {
              type: "boolean",
              description: "마케팅/이벤트 알림 허용 여부",
              example: false,
            },
            quietHoursEnabled: {
              type: "boolean",
              description: "방해금지 시간 사용 여부",
              example: false,
            },
            quietHoursStart: {
              type: "string",
              pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
              description: "방해금지 시작 시간 (HH:mm)",
              example: "23:00",
            },
            quietHoursEnd: {
              type: "string",
              pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
              description: "방해금지 종료 시간 (HH:mm)",
              example: "08:00",
            },
          },
        },
        Notice: {
          type: "object",
          required: [
            "id",
            "title",
            "content",
            "type",
            "category",
            "isPinned",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "공지사항 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            title: {
              type: "string",
              description: "공지사항 제목",
              example: "DAMARA 베타 서비스 오픈 안내",
            },
            summary: {
              type: "string",
              nullable: true,
              description:
                "목록 카드용 요약 문구. 기본 DAMARA 공지는 category와 같은 표시값을 사용합니다.",
              example: "서비스 안내",
            },
            content: {
              type: "string",
              description: "공지사항 본문",
              example:
                "안녕하세요, DAMARA 운영팀입니다. DAMARA는 명지대학교 학생들이 필요한 물품을 함께 구매하고 나눌 수 있도록 만든 캠퍼스 기반 공동구매 서비스입니다.",
            },
            type: {
              type: "string",
              enum: [...NOTICE_TYPES],
              description: "공지 유형",
              example: "service",
            },
            category: {
              type: "string",
              description:
                "프론트 표시용 공지 카테고리. 기본값은 summary가 있으면 summary, 없으면 type 라벨입니다.",
              example: "서비스 안내",
            },
            isPinned: {
              type: "boolean",
              description: "상단 고정 여부",
              example: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일시",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일시",
            },
          },
        },
        NoticeListResponse: {
          type: "object",
          required: ["notices", "total", "limit", "offset", "hasNext"],
          properties: {
            notices: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Notice",
              },
            },
            total: {
              type: "integer",
              description: "필터 조건에 맞는 전체 공지 수",
              example: 12,
            },
            limit: {
              type: "integer",
              description: "조회 개수",
              example: 20,
            },
            offset: {
              type: "integer",
              description: "조회 시작 위치",
              example: 0,
            },
            hasNext: {
              type: "boolean",
              description: "다음 페이지 존재 여부",
              example: false,
            },
          },
        },
        Faq: {
          type: "object",
          required: [
            "id",
            "category",
            "question",
            "answer",
            "order",
            "isActive",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "FAQ UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            category: {
              type: "string",
              enum: [...FAQ_CATEGORIES],
              description: "FAQ 카테고리",
              example: "pickup",
            },
            question: {
              type: "string",
              description: "질문",
              example: "물품 수령 장소는 어떻게 정하나요?",
            },
            answer: {
              type: "string",
              description: "답변",
              example:
                "공구 등록 시 직접 장소를 입력하거나 다마라존을 선택할 수 있습니다. 다마라존은 S2810, 학생회관 앞, 기숙사 로비처럼 교내에서 만나기 쉬운 공식 접선지입니다.",
            },
            order: {
              type: "integer",
              description: "카테고리 내 정렬 순서",
              example: 1,
            },
            isActive: {
              type: "boolean",
              description: "사용자 화면 노출 여부",
              example: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일시",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일시",
            },
          },
        },
        FaqListResponse: {
          type: "object",
          required: ["faqs", "total", "limit", "offset", "hasNext"],
          properties: {
            faqs: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Faq",
              },
            },
            total: {
              type: "integer",
              description: "필터 조건에 맞는 전체 FAQ 수",
              example: 11,
            },
            limit: {
              type: "integer",
              description: "조회 개수",
              example: 20,
            },
            offset: {
              type: "integer",
              description: "조회 시작 위치",
              example: 0,
            },
            hasNext: {
              type: "boolean",
              description: "다음 페이지 존재 여부",
              example: false,
            },
          },
        },
        TrustEvent: {
          type: "object",
          required: [
            "id",
            "userId",
            "type",
            "scoreChange",
            "previousScore",
            "nextScore",
            "previousGrade",
            "nextGrade",
          ],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "신뢰 이벤트 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            userId: {
              type: "string",
              format: "uuid",
              description: "점수가 변경된 사용자 UUID",
              example: "a87522bd-bc79-47b0-a73f-46ea4068a158",
            },
            postId: {
              type: "string",
              format: "uuid",
              nullable: true,
              description: "점수 변경과 관련된 게시글 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            actorUserId: {
              type: "string",
              format: "uuid",
              nullable: true,
              description: "점수 변경을 유발한 사용자 UUID",
              example: "a87522bd-bc79-47b0-a73f-46ea4068a158",
            },
            type: {
              type: "string",
              enum: [
                "post_completed_author",
                "post_completed_participant",
                "post_cancelled_by_author",
                "post_deleted_by_author",
                "participant_cancelled",
                "participant_no_show",
                "agreement_confirmed",
                "manual_adjustment",
              ],
              description: "신뢰 이벤트 타입",
              example: "post_completed_author",
            },
            scoreChange: {
              type: "integer",
              description: "내부 신뢰점수 변화량",
              example: 10,
            },
            previousScore: {
              type: "integer",
              description: "변경 전 내부 신뢰점수",
              minimum: 0,
              maximum: 100,
              example: 50,
            },
            nextScore: {
              type: "integer",
              description: "변경 후 내부 신뢰점수",
              minimum: 0,
              maximum: 100,
              example: 60,
            },
            previousGrade: {
              type: "number",
              format: "float",
              description: "변경 전 표시 신뢰학점",
              minimum: 2.5,
              maximum: 4.5,
              example: 3.5,
            },
            nextGrade: {
              type: "number",
              format: "float",
              description: "변경 후 표시 신뢰학점",
              minimum: 2.5,
              maximum: 4.5,
              example: 3.7,
            },
            reason: {
              type: "string",
              nullable: true,
              description: "점수 변경 사유",
              example: "공동구매 거래 완료: 작성자 보상",
            },
            metadata: {
              type: "object",
              nullable: true,
              description: "이벤트별 추가 데이터",
              additionalProperties: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일시",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일시",
            },
          },
        },
        PostImage: {
          type: "object",
          required: ["id", "imageUrl", "sortOrder"],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "이미지 UUID",
              example: "b6d2592a-667d-474c-8bf5-12005528876e",
            },
            imageUrl: {
              type: "string",
              description: "이미지 URL",
              example: "https://example.com/image.jpg",
            },
            sortOrder: {
              type: "integer",
              description: "이미지 정렬 순서",
              example: 0,
            },
          },
        },
        PickupZone: {
          type: "object",
          required: [
            "id",
            "name",
            "campus",
            "campusLabel",
            "detailLocation",
            "displayName",
            "description",
            "isActive",
            "sortOrder",
          ],
          properties: {
            id: {
              type: "string",
              description: "다마라존 ID. 게시글 등록 시 pickupZoneId로 전달합니다.",
              example: "s2810",
            },
            name: {
              type: "string",
              description: "짧은 장소명",
              example: "S2810",
            },
            campus: {
              type: "string",
              enum: PICKUP_ZONE_CAMPUSES,
              description: "캠퍼스 구분",
              example: "natural",
            },
            campusLabel: {
              type: "string",
              description: "캠퍼스 표시명",
              example: "자연캠퍼스",
            },
            building: {
              type: "string",
              nullable: true,
              description: "건물명",
              example: "S동",
            },
            floor: {
              type: "string",
              nullable: true,
              description: "층 정보",
              example: "2층",
            },
            detailLocation: {
              type: "string",
              description: "건물 내 상세 위치",
              example: "S2810",
            },
            displayName: {
              type: "string",
              description: "프론트 표시용 전체 장소명",
              example: "자연캠퍼스 S2810",
            },
            description: {
              type: "string",
              description: "장소 설명",
              example: "자연캠퍼스 S동 2층 S2810 앞 공식 접선지",
            },
            isActive: {
              type: "boolean",
              description: "사용 가능 여부",
              example: true,
            },
            sortOrder: {
              type: "integer",
              description: "표시 순서",
              example: 10,
            },
          },
        },
        Post: {
          type: "object",
          required: [
            "id",
            "authorId",
            "title",
            "content",
            "price",
            "minParticipants",
            "deadline",
          ],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "게시글 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            authorId: {
              type: "string",
              format: "uuid",
              description: "작성자 UUID",
              example: "a87522bd-bc79-47b0-a73f-46ea4068a158",
            },
            title: {
              type: "string",
              description: "상품명",
              example: "맛있는 치킨 공동구매",
            },
            productName: {
              type: "string",
              nullable: true,
              description:
                "상세/등록 UI의 상품명 필드. 값이 없으면 응답에서 title을 fallback으로 사용합니다.",
              example: "BBQ 황금올리브치킨 2마리 세트",
            },
            content: {
              type: "string",
              description: "상품 설명",
              example:
                "BBQ 황금올리브치킨 2마리 세트를 함께 주문하실 분 구합니다!",
            },
            price: {
              type: "number",
              description: "가격",
              example: 25000,
            },
            minParticipants: {
              type: "integer",
              description: "최소 참여 인원",
              example: 2,
            },
            currentQuantity: {
              type: "integer",
              description: "현재 참여 인원",
              example: 0,
            },
            status: {
              type: "string",
              enum: ["open", "closed", "in_progress", "completed", "cancelled"],
              description: "상품 상태 (open: 모집중, closed: 모집완료, in_progress: 진행중, completed: 거래완료, cancelled: 취소됨)",
              example: "open",
            },
            deadline: {
              type: "string",
              format: "date-time",
              description: "마감 시간",
              example: "2025-11-27T23:59:59.000Z",
            },
            pickupType: {
              type: "string",
              enum: PICKUP_TYPES,
              description:
                "수령 장소 선택 방식 (custom=직접 입력, damara_zone=다마라존)",
              example: "damara_zone",
            },
            pickupZoneId: {
              type: "string",
              nullable: true,
              description: "다마라존 ID. pickupType=damara_zone일 때 사용합니다.",
              example: "s2810",
            },
            pickupZone: {
              allOf: [{ $ref: "#/components/schemas/PickupZone" }],
              nullable: true,
              description: "선택된 다마라존 상세 정보",
            },
            pickupLocation: {
              type: "string",
              nullable: true,
              description: "픽업 장소",
              example: "자연캠퍼스 S2810",
            },
            pickupDate: {
              type: "string",
              format: "date",
              nullable: true,
              description: "수령 날짜 (YYYY-MM-DD)",
              example: "2026-06-17",
            },
            pickupStartTime: {
              type: "string",
              nullable: true,
              description: "수령 시작 시간 (HH:mm 또는 HH:mm:ss)",
              example: "17:00",
            },
            pickupEndTime: {
              type: "string",
              nullable: true,
              description: "수령 종료 시간 (HH:mm 또는 HH:mm:ss)",
              example: "19:00",
            },
            pickupGuide: {
              type: "string",
              nullable: true,
              description: "수령 안내 문구",
              example: "정문 앞 파란 우산 근처에서 수령해 주세요.",
            },
            groupBuyType: {
              type: "string",
              enum: GROUP_BUY_TYPES,
              description:
                "공구 A/B 타입 (pre_recruit=선모집형, post_recruit=후모집형)",
              example: "pre_recruit",
            },
            groupBuyMode: {
              type: "string",
              enum: GROUP_BUY_MODES,
              description:
                "거래 세부 모드 (normal=기본형, price_unlock=모이면 싸지는 공구)",
              example: "price_unlock",
            },
            targetParticipants: {
              type: "integer",
              nullable: true,
              description:
                "price_unlock 목표 참여 인원. 이 인원 이상이면 목표 가격이 적용됩니다.",
              example: 5,
            },
            targetPrice: {
              type: "number",
              nullable: true,
              description: "price_unlock 목표 달성 가격",
              example: 4500,
            },
            currentPrice: {
              type: "number",
              description:
                "현재 참여 인원 기준 프론트 표시 가격. 목표 달성 전에는 price, 달성 후에는 targetPrice입니다.",
              example: 5000,
            },
            participantsToUnlock: {
              type: "integer",
              nullable: true,
              description:
                "목표 가격 해금까지 남은 참여자 수. price_unlock이 아니면 null입니다.",
              example: 2,
            },
            priceUnlocked: {
              type: "boolean",
              description: "목표 가격 달성 여부",
              example: false,
            },
            dealMessage: {
              type: "string",
              nullable: true,
              description:
                "프론트가 그대로 표시할 수 있는 거래 방식 안내 문구",
              example: "2명만 더 모이면 4,500원",
            },
            tags: {
              type: "array",
              nullable: true,
              description: "공구 태그 목록",
              items: {
                type: "string",
              },
              example: ["대용량", "생활용품"],
            },
            notice: {
              type: "string",
              nullable: true,
              description: "상세 화면 공지사항",
              example: "입금 확인 후 주문 예정입니다.",
            },
            category: {
              type: "string",
              nullable: true,
              enum: ["food", "daily", "beauty", "electronics", "school", "freemarket"],
              description: "카테고리 ID (food: 먹거리, daily: 일상용품, beauty: 뷰티·패션, electronics: 전자기기, school: 학용품, freemarket: 프리마켓)",
              example: "food",
            },
            images: {
              type: "array",
              items: {
                $ref: "#/components/schemas/PostImage",
              },
              description: "이미지 URL 객체 배열",
            },
            thumbnailUrl: {
              type: "string",
              nullable: true,
              description: "대표 썸네일 URL. 첫 번째 이미지가 없으면 null입니다.",
              example: "https://example.com/image.jpg",
            },
            favoriteCount: {
              type: "integer",
              description: "관심 등록 수",
              example: 12,
            },
            isFavorite: {
              type: "boolean",
              description: "현재 사용자의 관심 등록 여부 (로그인한 사용자 기준)",
              example: true,
            },
            isParticipant: {
              type: "boolean",
              description: "현재 사용자의 참여 여부",
              example: false,
            },
            isOwner: {
              type: "boolean",
              description: "현재 사용자가 작성자인지 여부",
              example: false,
            },
            exceptionSummary: {
              $ref: "#/components/schemas/PostExceptionSummary",
              description:
                "카드/상세 경고 배지용 예외 요약. 홈, 내 공구, 관심 공구 카드에서 공통으로 사용할 수 있습니다.",
            },
            deadlineStatus: {
              type: "string",
              enum: ["open", "closingSoon", "closed"],
              description: "서버 시간 기준 마감 상태",
              example: "closingSoon",
            },
            deadlineLabel: {
              type: "string",
              description: "프론트 표시용 마감 라벨",
              example: "오늘 마감",
            },
            remainingSeconds: {
              type: "integer",
              description: "마감까지 남은 초. 이미 지난 경우 0입니다.",
              example: 3600,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일시",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일시",
            },
          },
        },
        PostListResponse: {
          type: "object",
          required: ["items", "total", "limit", "offset", "hasNext"],
          properties: {
            items: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Post",
              },
            },
            total: {
              type: "integer",
              description: "필터 조건에 맞는 전체 게시글 수",
              example: 42,
            },
            limit: {
              type: "integer",
              example: 20,
            },
            offset: {
              type: "integer",
              example: 0,
            },
            hasNext: {
              type: "boolean",
              description: "다음 페이지 존재 여부",
              example: true,
            },
          },
        },
        PostProductSearchResponse: {
          type: "object",
          required: [
            "query",
            "exists",
            "exactMatchExists",
            "partialMatchExists",
            "total",
            "exactMatchCount",
            "limit",
            "items",
          ],
          properties: {
            query: {
              type: "string",
              description: "서버가 공백을 정리한 검색어",
              example: "물티슈",
            },
            exists: {
              type: "boolean",
              description:
                "정확히 같거나 일부 포함되는 상품명/게시글 제목이 하나라도 있는지 여부",
              example: true,
            },
            exactMatchExists: {
              type: "boolean",
              description:
                "상품명(productName) 또는 제목(title)이 검색어와 완전히 같은 게시글 존재 여부",
              example: false,
            },
            partialMatchExists: {
              type: "boolean",
              description:
                "상품명(productName) 또는 제목(title)에 검색어가 포함된 게시글 존재 여부",
              example: true,
            },
            total: {
              type: "integer",
              description: "일부 포함 검색까지 포함한 전체 검색 결과 수",
              example: 3,
            },
            exactMatchCount: {
              type: "integer",
              description: "정확히 일치하는 검색 결과 수",
              example: 0,
            },
            limit: {
              type: "integer",
              description: "items에 반환된 최대 게시글 수",
              example: 10,
            },
            items: {
              type: "array",
              description:
                "검색어와 유사한 게시글 목록. 카드 UI용 favoriteCount, isFavorite, isParticipant, deadlineStatus 등이 포함됩니다.",
              items: {
                $ref: "#/components/schemas/Post",
              },
            },
          },
        },
        PostParticipationResult: {
          type: "object",
          required: ["isParticipant", "post"],
          properties: {
            isParticipant: {
              type: "boolean",
              description: "요청 후 현재 사용자의 참여 여부",
              example: true,
            },
            post: {
              type: "object",
              required: ["id", "currentQuantity", "minParticipants", "status"],
              properties: {
                id: {
                  type: "string",
                  format: "uuid",
                },
                currentQuantity: {
                  type: "integer",
                  example: 2,
                },
                minParticipants: {
                  type: "integer",
                  example: 3,
                },
                status: {
                  type: "string",
                  enum: [
                    "open",
                    "closed",
                    "in_progress",
                    "completed",
                    "cancelled",
                  ],
                  example: "open",
                },
                pickupType: {
                  type: "string",
                  enum: PICKUP_TYPES,
                  example: "damara_zone",
                },
                pickupZoneId: {
                  type: "string",
                  nullable: true,
                  example: "s2810",
                },
                pickupZone: {
                  allOf: [{ $ref: "#/components/schemas/PickupZone" }],
                  nullable: true,
                },
                pickupLocation: {
                  type: "string",
                  nullable: true,
                  example: "자연캠퍼스 S2810",
                },
                price: {
                  type: "number",
                  example: 5000,
                },
                groupBuyType: {
                  type: "string",
                  enum: GROUP_BUY_TYPES,
                  example: "pre_recruit",
                },
                groupBuyMode: {
                  type: "string",
                  enum: GROUP_BUY_MODES,
                  example: "price_unlock",
                },
                targetParticipants: {
                  type: "integer",
                  nullable: true,
                  example: 5,
                },
                targetPrice: {
                  type: "number",
                  nullable: true,
                  example: 4500,
                },
                currentPrice: {
                  type: "number",
                  example: 5000,
                },
                participantsToUnlock: {
                  type: "integer",
                  nullable: true,
                  example: 2,
                },
                priceUnlocked: {
                  type: "boolean",
                  example: false,
                },
                dealMessage: {
                  type: "string",
                  nullable: true,
                  example: "2명만 더 모이면 4,500원",
                },
              },
            },
          },
        },
        ParticipantStatus: {
          type: "string",
          enum: PARTICIPANT_STATUSES,
          description:
            "참여자별 진행 상태 (participating=참여중, payment_pending=입금대기, pickup_ready=수령예정, received=수령완료)",
          example: "participating",
        },
        PostExceptionType: {
          type: "string",
          enum: POST_EXCEPTION_TYPES,
          description:
            "게시글 예외 유형 (price_changed=가격 변경, sold_out=품절, pickup_changed=수령 정보 변경, damaged=파손/누락/불량, seller_cancelled=주최자 취소, other=기타)",
          example: "price_changed",
        },
        PostExceptionStatus: {
          type: "string",
          enum: POST_EXCEPTION_STATUSES,
          description:
            "게시글 예외 처리 상태 (open=처리 중, resolved=처리 완료, dismissed=처리 불필요/기각)",
          example: "open",
        },
        PostExceptionSeverity: {
          type: "string",
          enum: ["info", "warning", "critical"],
          description:
            "프론트 UI 표시 강도 (info=안내, warning=주의, critical=긴급)",
          example: "warning",
        },
        PostException: {
          type: "object",
          required: [
            "id",
            "postId",
            "reporterId",
            "type",
            "typeLabel",
            "status",
            "reason",
            "displayTitle",
            "displayMessage",
            "severity",
            "handlingGuide",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "예외 케이스 UUID",
            },
            postId: {
              type: "string",
              format: "uuid",
              description: "게시글 UUID",
            },
            reporterId: {
              type: "string",
              format: "uuid",
              description: "예외 등록자 UUID",
            },
            type: {
              $ref: "#/components/schemas/PostExceptionType",
            },
            typeLabel: {
              type: "string",
              description: "예외 유형 한글 라벨",
              example: "가격 변경",
            },
            status: {
              $ref: "#/components/schemas/PostExceptionStatus",
            },
            reason: {
              type: "string",
              description: "예외 사유",
              example: "할인 종료로 실제 구매 가격이 상승했습니다.",
            },
            displayTitle: {
              type: "string",
              description: "프론트 배너/배지용 제목",
              example: "가격이 변경되었어요",
            },
            displayMessage: {
              type: "string",
              description: "프론트 배너/모달용 문구",
              example:
                "할인 종료로 실제 구매 가격이 5,900원에서 6,900원으로 변경되었습니다.",
            },
            severity: {
              $ref: "#/components/schemas/PostExceptionSeverity",
            },
            oldPrice: {
              type: "number",
              nullable: true,
              description: "변경 전 가격",
              example: 5900,
            },
            newPrice: {
              type: "number",
              nullable: true,
              description: "변경 후 가격",
              example: 6900,
            },
            affectedQuantity: {
              type: "integer",
              nullable: true,
              description: "영향을 받은 수량",
              example: 3,
            },
            metadata: {
              type: "object",
              nullable: true,
              additionalProperties: true,
              description: "예외 유형별 확장 정보",
            },
            resolutionNote: {
              type: "string",
              nullable: true,
              description: "처리 내용 또는 기각 사유",
            },
            handlingGuide: {
              type: "string",
              description: "기본 처리 방향",
              example:
                "참여자에게 알리고 계속 참여 또는 취소 여부를 확인하세요.",
            },
            reporter: {
              type: "object",
              nullable: true,
              properties: {
                id: {
                  type: "string",
                  format: "uuid",
                },
                nickname: {
                  type: "string",
                },
                studentId: {
                  type: "string",
                },
                department: {
                  type: "string",
                  nullable: true,
                },
                avatarUrl: {
                  type: "string",
                  format: "uri",
                  nullable: true,
                },
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        PostExceptionSummary: {
          type: "object",
          required: [
            "hasOpenException",
            "openCount",
            "latestType",
            "latestTitle",
            "latestMessage",
            "severity",
            "latest",
          ],
          properties: {
            hasOpenException: {
              type: "boolean",
              description: "처리 중인 예외 케이스 존재 여부",
              example: true,
            },
            openCount: {
              type: "integer",
              description: "처리 중인 예외 케이스 수",
              example: 1,
            },
            latestType: {
              nullable: true,
              allOf: [
                {
                  $ref: "#/components/schemas/PostExceptionType",
                },
              ],
            },
            latestTitle: {
              type: "string",
              nullable: true,
              description: "카드/상세 경고 배지용 최신 예외 제목",
              example: "가격이 변경되었어요",
            },
            latestMessage: {
              type: "string",
              nullable: true,
              description: "카드/상세 경고 배너용 최신 예외 문구",
              example:
                "할인 종료로 실제 구매 가격이 5,900원에서 6,900원으로 변경되었습니다.",
            },
            severity: {
              nullable: true,
              allOf: [
                {
                  $ref: "#/components/schemas/PostExceptionSeverity",
                },
              ],
            },
            latest: {
              nullable: true,
              allOf: [
                {
                  $ref: "#/components/schemas/PostException",
                },
              ],
            },
          },
        },
        PostExceptionsResponse: {
          type: "object",
          required: ["exceptions", "total", "limit", "offset", "hasNext"],
          properties: {
            exceptions: {
              type: "array",
              items: {
                $ref: "#/components/schemas/PostException",
              },
            },
            total: {
              type: "integer",
              example: 3,
            },
            limit: {
              type: "integer",
              example: 20,
            },
            offset: {
              type: "integer",
              example: 0,
            },
            hasNext: {
              type: "boolean",
              example: false,
            },
          },
        },
        PublicUserProfile: {
          type: "object",
          required: ["id", "nickname", "studentId", "trustGrade"],
          description:
            "게시글 상세 화면에 노출하는 사용자 공개 프로필. passwordHash, email, trustScore는 포함하지 않습니다.",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "사용자 UUID",
              example: "a87522bd-bc79-47b0-a73f-46ea4068a158",
            },
            nickname: {
              type: "string",
              description: "닉네임",
              example: "다마라 공식",
            },
            studentId: {
              type: "string",
              description: "학번",
              example: "20241234",
            },
            department: {
              type: "string",
              nullable: true,
              description: "학과/부서",
              example: "생활용품 판매자",
            },
            avatarUrl: {
              type: "string",
              format: "uri",
              nullable: true,
              description: "프로필 이미지 URL",
              example: "https://example.com/avatar.jpg",
            },
            trustGrade: {
              type: "number",
              format: "float",
              description: "사용자에게 표시하는 신뢰학점",
              minimum: 2.5,
              maximum: 4.5,
              example: 4.3,
            },
          },
        },
        PostParticipantProfile: {
          type: "object",
          required: ["id", "userId", "joinedAt", "user"],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "참여 row UUID",
              example: "7f7b9a5c-0e86-4f93-bd11-31e9bde8a7f2",
            },
            userId: {
              type: "string",
              format: "uuid",
              description: "참여자 사용자 UUID",
              example: "a87522bd-bc79-47b0-a73f-46ea4068a158",
            },
            participantStatus: {
              $ref: "#/components/schemas/ParticipantStatus",
            },
            joinedAt: {
              type: "string",
              format: "date-time",
              description: "공동구매 참여 시각",
            },
            user: {
              $ref: "#/components/schemas/PublicUserProfile",
            },
          },
        },
        PostParticipant: {
          type: "object",
          required: [
            "id",
            "postId",
            "userId",
            "joinedAt",
            "status",
            "participantStatus",
          ],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "참여 row UUID",
              example: "7f7b9a5c-0e86-4f93-bd11-31e9bde8a7f2",
            },
            postId: {
              type: "string",
              format: "uuid",
              description: "게시글 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            userId: {
              type: "string",
              format: "uuid",
              description: "참여자 사용자 UUID",
              example: "a87522bd-bc79-47b0-a73f-46ea4068a158",
            },
            nickname: {
              type: "string",
              nullable: true,
              description: "참여자 닉네임",
              example: "참여자 1",
            },
            studentId: {
              type: "string",
              nullable: true,
              description: "참여자 학번",
              example: "20241234",
            },
            department: {
              type: "string",
              nullable: true,
              description: "참여자 학과/부서",
              example: "컴퓨터공학과",
            },
            avatarUrl: {
              type: "string",
              format: "uri",
              nullable: true,
              description: "참여자 프로필 이미지 URL",
              example: "https://example.com/avatar.jpg",
            },
            trustGrade: {
              type: "number",
              format: "float",
              nullable: true,
              description: "사용자에게 표시하는 신뢰학점",
              example: 4.3,
            },
            joinedAt: {
              type: "string",
              format: "date-time",
              description: "공동구매 참여 시각",
            },
            status: {
              type: "string",
              enum: ["joined"],
              description: "프론트엔드 참여자 목록 표시용 상태",
              example: "joined",
            },
            participantStatus: {
              $ref: "#/components/schemas/ParticipantStatus",
            },
            participantStatusLabel: {
              type: "string",
              description: "참여자 상태 한글 라벨",
              example: "참여중",
            },
            user: {
              type: "object",
              nullable: true,
              properties: {
                id: {
                  type: "string",
                  format: "uuid",
                },
                nickname: {
                  type: "string",
                  example: "참여자 1",
                },
                studentId: {
                  type: "string",
                  example: "20241234",
                },
                department: {
                  type: "string",
                  nullable: true,
                  example: "컴퓨터공학과",
                },
                avatarUrl: {
                  type: "string",
                  format: "uri",
                  nullable: true,
                },
                trustGrade: {
                  type: "number",
                  format: "float",
                  nullable: true,
                  example: 4.3,
                },
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "참여 생성일시",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "참여 수정일시",
            },
          },
        },
        PostParticipantsResponse: {
          type: "object",
          required: ["participants", "total", "limit", "offset", "hasNext"],
          properties: {
            participants: {
              type: "array",
              description: "참여자 공개 프로필 목록",
              items: {
                $ref: "#/components/schemas/PostParticipant",
              },
            },
            total: {
              type: "integer",
              description: "전체 참여자 수",
              example: 3,
            },
            limit: {
              type: "integer",
              description: "조회 개수",
              example: 20,
            },
            offset: {
              type: "integer",
              description: "시작 위치",
              example: 0,
            },
            hasNext: {
              type: "boolean",
              description: "다음 페이지 존재 여부",
              example: false,
            },
          },
        },
        ParticipatedPost: {
          type: "object",
          required: ["id", "postId", "userId", "participantStatus", "post"],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "참여 row UUID",
              example: "7f7b9a5c-0e86-4f93-bd11-31e9bde8a7f2",
            },
            postId: {
              type: "string",
              format: "uuid",
              description: "게시글 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            userId: {
              type: "string",
              format: "uuid",
              description: "참여자 사용자 UUID",
              example: "a87522bd-bc79-47b0-a73f-46ea4068a158",
            },
            participantStatus: {
              $ref: "#/components/schemas/ParticipantStatus",
            },
            post: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  format: "uuid",
                },
                title: {
                  type: "string",
                  example: "물티슈 공동구매",
                },
                price: {
                  type: "number",
                  example: 5900,
                },
                minParticipants: {
                  type: "integer",
                  example: 3,
                },
                status: {
                  type: "string",
                  enum: [
                    "open",
                    "closed",
                    "in_progress",
                    "completed",
                    "cancelled",
                  ],
                  example: "open",
                },
                deadline: {
                  type: "string",
                  format: "date-time",
                },
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "참여 생성일시",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "참여 수정일시",
            },
          },
        },
        MyPostsListItem: {
          allOf: [
            {
              $ref: "#/components/schemas/Post",
            },
            {
              type: "object",
              required: ["myPostTab", "myPostRole", "myPostStatus"],
              properties: {
                myPostTab: {
                  type: "string",
                  enum: ["registered", "participated", "favorites"],
                  description: "내 공구 탭 구분",
                  example: "participated",
                },
                myPostRole: {
                  type: "string",
                  enum: ["owner", "participant", "favorite"],
                  description: "현재 사용자와 카드의 관계",
                  example: "participant",
                },
                myPostStatus: {
                  type: "string",
                  description:
                    "탭별 카드 상태. registered는 inProgress/deadlineSoon/completed/cancelled, participated는 participantStatus, favorites는 favorite/deadlineSoon/recent 또는 요청 상태값입니다.",
                  example: "payment_pending",
                },
                participantId: {
                  type: "string",
                  format: "uuid",
                  nullable: true,
                  description: "참여 탭에서만 내려가는 참여 row UUID",
                },
                participantStatus: {
                  allOf: [
                    {
                      $ref: "#/components/schemas/ParticipantStatus",
                    },
                  ],
                  nullable: true,
                  description: "참여 탭에서만 내려가는 참여자별 진행 상태",
                },
                participantStatusLabel: {
                  type: "string",
                  nullable: true,
                  description: "참여 상태 한글 라벨",
                  example: "입금대기",
                },
                participatedAt: {
                  type: "string",
                  format: "date-time",
                  nullable: true,
                  description: "참여한 시각",
                },
                favoriteId: {
                  type: "string",
                  format: "uuid",
                  nullable: true,
                  description: "관심 탭에서만 내려가는 관심 row UUID",
                },
                favoritedAt: {
                  type: "string",
                  format: "date-time",
                  nullable: true,
                  description: "관심 등록 시각",
                },
              },
            },
          ],
        },
        MyPostsListResponse: {
          type: "object",
          required: ["tab", "items", "total", "limit", "offset", "hasNext", "filters"],
          properties: {
            tab: {
              type: "string",
              enum: ["registered", "participated", "favorites"],
              example: "registered",
            },
            items: {
              type: "array",
              items: {
                $ref: "#/components/schemas/MyPostsListItem",
              },
            },
            total: {
              type: "integer",
              description: "필터 조건에 맞는 전체 카드 수",
              example: 12,
            },
            limit: {
              type: "integer",
              example: 20,
            },
            offset: {
              type: "integer",
              example: 0,
            },
            hasNext: {
              type: "boolean",
              example: true,
            },
            filters: {
              type: "object",
              properties: {
                status: {
                  type: "string",
                  nullable: true,
                  example: "inProgress",
                },
                keyword: {
                  type: "string",
                  nullable: true,
                  example: "물티슈",
                },
                category: {
                  type: "string",
                  nullable: true,
                  example: "daily",
                },
                sort: {
                  type: "string",
                  enum: ["latest", "deadline", "popular"],
                  example: "latest",
                },
              },
            },
          },
        },
        MyPostsSummary: {
          type: "object",
          required: ["registered", "participated", "favorites", "meta"],
          properties: {
            registered: {
              type: "object",
              required: ["inProgress", "deadlineSoon", "completed"],
              description: "등록한 공구 탭 상단 요약",
              properties: {
                inProgress: {
                  type: "integer",
                  description:
                    "작성자가 등록한 활성 공구 수. open, closed, in_progress 상태를 포함합니다.",
                  example: 3,
                },
                deadlineSoon: {
                  type: "integer",
                  description:
                    "작성자가 등록한 모집중(open) 공구 중 deadlineSoonHours 이내 마감 수",
                  example: 1,
                },
                completed: {
                  type: "integer",
                  description: "작성자가 등록한 거래완료 공구 수",
                  example: 5,
                },
              },
            },
            participated: {
              type: "object",
              required: [
                "participating",
                "paymentPending",
                "pickupReady",
                "received",
              ],
              description: "참여한 공구 탭 상단 요약",
              properties: {
                participating: {
                  type: "integer",
                  description: "참여중 상태 수",
                  example: 4,
                },
                paymentPending: {
                  type: "integer",
                  description: "입금대기 상태 수",
                  example: 1,
                },
                pickupReady: {
                  type: "integer",
                  description: "수령예정 상태 수",
                  example: 2,
                },
                received: {
                  type: "integer",
                  description: "수령완료 상태 수",
                  example: 6,
                },
              },
            },
            favorites: {
              type: "object",
              required: ["total", "deadlineSoon", "recent"],
              description: "관심 공구 탭 상단 요약",
              properties: {
                total: {
                  type: "integer",
                  description: "찜한 상품 전체 수",
                  example: 8,
                },
                deadlineSoon: {
                  type: "integer",
                  description:
                    "찜한 모집중(open) 공구 중 deadlineSoonHours 이내 마감 수",
                  example: 2,
                },
                recent: {
                  type: "integer",
                  description: "recentDays 이내 최근 관심 등록 수",
                  example: 3,
                },
              },
            },
            meta: {
              type: "object",
              required: ["deadlineSoonHours", "recentDays"],
              properties: {
                deadlineSoonHours: {
                  type: "integer",
                  example: 24,
                },
                recentDays: {
                  type: "integer",
                  example: 7,
                },
              },
            },
          },
        },
        PostDetail: {
          type: "object",
          required: [
            "id",
            "authorId",
            "title",
            "content",
            "price",
            "minParticipants",
            "deadline",
            "author",
            "participants",
            "participantCount",
            "exceptionSummary",
            "isParticipant",
          ],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "게시글 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            authorId: {
              type: "string",
              format: "uuid",
              description: "작성자 UUID",
              example: "a87522bd-bc79-47b0-a73f-46ea4068a158",
            },
            title: {
              type: "string",
              description: "상품명",
              example: "물티슈 공동구매",
            },
            productName: {
              type: "string",
              nullable: true,
              description:
                "상세/등록 UI의 상품명 필드. 값이 없으면 응답에서 title을 fallback으로 사용합니다.",
              example: "도톰한 엠보싱 물티슈 100매",
            },
            content: {
              type: "string",
              description: "상품 설명",
              example:
                "도톰한 엠보싱 원단으로 부드럽고 촉촉한 물티슈입니다.",
            },
            price: {
              type: "number",
              description: "가격",
              example: 5900,
            },
            minParticipants: {
              type: "integer",
              description: "최소 참여 인원",
              example: 3,
            },
            currentQuantity: {
              type: "integer",
              description: "현재 참여 인원",
              example: 1,
            },
            status: {
              type: "string",
              enum: ["open", "closed", "in_progress", "completed", "cancelled"],
              description: "상품 상태",
              example: "open",
            },
            deadline: {
              type: "string",
              format: "date-time",
              description: "마감 시간",
              example: "2026-04-17T23:59:59.000Z",
            },
            pickupType: {
              type: "string",
              enum: PICKUP_TYPES,
              description:
                "수령 장소 선택 방식 (custom=직접 입력, damara_zone=다마라존)",
              example: "damara_zone",
            },
            pickupZoneId: {
              type: "string",
              nullable: true,
              description: "다마라존 ID. pickupType=damara_zone일 때 사용합니다.",
              example: "humanities-student-hall-3f-cafe",
            },
            pickupZone: {
              allOf: [{ $ref: "#/components/schemas/PickupZone" }],
              nullable: true,
              description: "선택된 다마라존 상세 정보",
            },
            pickupLocation: {
              type: "string",
              nullable: true,
              description: "픽업 장소",
              example: "인문캠퍼스 학생회관 3층 카페앞",
            },
            pickupDate: {
              type: "string",
              format: "date",
              nullable: true,
              description: "수령 날짜 (YYYY-MM-DD)",
              example: "2026-04-17",
            },
            pickupStartTime: {
              type: "string",
              nullable: true,
              description: "수령 시작 시간 (HH:mm 또는 HH:mm:ss)",
              example: "17:00",
            },
            pickupEndTime: {
              type: "string",
              nullable: true,
              description: "수령 종료 시간 (HH:mm 또는 HH:mm:ss)",
              example: "19:00",
            },
            pickupGuide: {
              type: "string",
              nullable: true,
              description: "수령 안내 문구",
              example: "정문 앞에서 신청자 이름 확인 후 전달합니다.",
            },
            groupBuyType: {
              type: "string",
              enum: GROUP_BUY_TYPES,
              description:
                "공구 A/B 타입 (pre_recruit=선모집형, post_recruit=후모집형)",
              example: "pre_recruit",
            },
            groupBuyMode: {
              type: "string",
              enum: GROUP_BUY_MODES,
              description:
                "거래 세부 모드 (normal=기본형, price_unlock=모이면 싸지는 공구)",
              example: "price_unlock",
            },
            targetParticipants: {
              type: "integer",
              nullable: true,
              description:
                "price_unlock 목표 참여 인원. 이 인원 이상이면 목표 가격이 적용됩니다.",
              example: 5,
            },
            targetPrice: {
              type: "number",
              nullable: true,
              description: "price_unlock 목표 달성 가격",
              example: 4500,
            },
            currentPrice: {
              type: "number",
              description:
                "현재 참여 인원 기준 프론트 표시 가격. 목표 달성 전에는 price, 달성 후에는 targetPrice입니다.",
              example: 5900,
            },
            participantsToUnlock: {
              type: "integer",
              nullable: true,
              description:
                "목표 가격 해금까지 남은 참여자 수. price_unlock이 아니면 null입니다.",
              example: 4,
            },
            priceUnlocked: {
              type: "boolean",
              description: "목표 가격 달성 여부",
              example: false,
            },
            dealMessage: {
              type: "string",
              nullable: true,
              description:
                "프론트가 그대로 표시할 수 있는 거래 방식 안내 문구",
              example: "4명만 더 모이면 4,900원",
            },
            tags: {
              type: "array",
              nullable: true,
              description: "공구 태그 목록",
              items: {
                type: "string",
              },
              example: ["대용량", "생활용품"],
            },
            notice: {
              type: "string",
              nullable: true,
              description: "상세 화면 공지사항",
              example: "입금 확인 후 주문 예정입니다.",
            },
            category: {
              type: "string",
              nullable: true,
              enum: [
                "food",
                "daily",
                "beauty",
                "electronics",
                "school",
                "freemarket",
              ],
              description: "카테고리 ID",
              example: "daily",
            },
            images: {
              type: "array",
              items: {
                $ref: "#/components/schemas/PostImage",
              },
              description: "이미지 URL 객체 배열",
            },
            thumbnailUrl: {
              type: "string",
              nullable: true,
              description: "대표 썸네일 URL",
              example: "https://example.com/wipes.jpg",
            },
            favoriteCount: {
              type: "integer",
              description: "관심 등록 수",
              example: 12,
            },
            isFavorite: {
              type: "boolean",
              description: "현재 사용자의 관심 등록 여부",
              example: true,
            },
            author: {
              $ref: "#/components/schemas/PublicUserProfile",
            },
            participants: {
              type: "array",
              description: "현재 공동구매 참여자 공개 프로필 목록",
              items: {
                $ref: "#/components/schemas/PostParticipantProfile",
              },
            },
            participantsPreview: {
              type: "array",
              description: "상세 화면 상단 미리보기용 참여자 목록",
              items: {
                type: "object",
                required: ["userId", "nickname", "avatarUrl", "trustGrade", "joinedAt"],
                properties: {
                  userId: {
                    type: "string",
                    format: "uuid",
                  },
                  nickname: {
                    type: "string",
                    example: "참여자 1",
                  },
                  avatarUrl: {
                    type: "string",
                    format: "uri",
                    nullable: true,
                  },
                  trustGrade: {
                    type: "number",
                    nullable: true,
                    example: 4.1,
                  },
                  joinedAt: {
                    type: "string",
                    format: "date-time",
                  },
                },
              },
            },
            participantCount: {
              type: "integer",
              description: "참여자 프로필 목록 기준 참여자 수",
              example: 2,
            },
            participantsTotal: {
              type: "integer",
              description: "전체 참여자 수",
              example: 2,
            },
            exceptionSummary: {
              $ref: "#/components/schemas/PostExceptionSummary",
            },
            isParticipant: {
              type: "boolean",
              description:
                "현재 사용자가 이 공동구매에 참여 중인지 여부. x-user-id 또는 userId가 없으면 false입니다.",
              example: false,
            },
            isOwner: {
              type: "boolean",
              description:
                "현재 사용자가 이 공동구매 작성자인지 여부. x-user-id 또는 userId가 없으면 false입니다.",
              example: false,
            },
            deadlineStatus: {
              type: "string",
              enum: ["open", "closingSoon", "closed"],
              description: "서버 시간 기준 마감 상태",
              example: "closingSoon",
            },
            deadlineLabel: {
              type: "string",
              description: "프론트 표시용 마감 라벨",
              example: "오늘 마감",
            },
            remainingSeconds: {
              type: "integer",
              description: "마감까지 남은 초. 이미 지난 경우 0입니다.",
              example: 3600,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일시",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일시",
            },
          },
        },
        ChatRoom: {
          type: "object",
          required: ["id", "postId"],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "채팅방 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            postId: {
              type: "string",
              format: "uuid",
              description: "게시글 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            post: {
              type: "object",
              description: "연결된 게시글 정보",
              properties: {
                id: {
                  type: "string",
                  format: "uuid",
                },
                title: {
                  type: "string",
                },
                status: {
                  type: "string",
                  enum: [
                    "open",
                    "closed",
                    "in_progress",
                    "completed",
                    "cancelled",
                  ],
                },
                pickupLocation: {
                  type: "string",
                  nullable: true,
                },
                deadline: {
                  type: "string",
                  format: "date-time",
                },
                thumbnailUrl: {
                  type: "string",
                  nullable: true,
                },
                authorId: {
                  type: "string",
                  format: "uuid",
                },
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일시",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일시",
            },
          },
        },
        Message: {
          type: "object",
          required: ["id", "chatRoomId", "senderId", "content", "messageType"],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "메시지 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            chatRoomId: {
              type: "string",
              format: "uuid",
              description: "채팅방 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            senderId: {
              type: "string",
              format: "uuid",
              description: "발신자 UUID",
              example: "a87522bd-bc79-47b0-a73f-46ea4068a158",
            },
            content: {
              type: "string",
              description: "메시지 내용",
              example: "안녕하세요! 공동구매 참여하고 싶습니다.",
            },
            messageType: {
              type: "string",
              enum: [...MESSAGE_TYPES],
              description: "메시지 타입",
              example: "text",
            },
            isRead: {
              type: "boolean",
              description: "읽음 여부",
              example: false,
            },
            sender: {
              type: "object",
              description: "발신자 정보",
              properties: {
                id: {
                  type: "string",
                  format: "uuid",
                },
                nickname: {
                  type: "string",
                },
                avatarUrl: {
                  type: "string",
                  format: "uri",
                  nullable: true,
                },
                studentId: {
                  type: "string",
                },
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일시",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일시",
            },
          },
        },
        Notification: {
          type: "object",
          required: ["id", "userId", "type", "title", "message", "isRead"],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "알림 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            userId: {
              type: "string",
              format: "uuid",
              description: "사용자 UUID",
              example: "a87522bd-bc79-47b0-a73f-46ea4068a158",
            },
            type: {
              type: "string",
              enum: [...NOTIFICATION_TYPES],
              description:
                "알림 타입. 공동구매 참여 알림은 작성자에게 new_participant 타입으로 전달됩니다.",
              example: "new_participant",
            },
            title: {
              type: "string",
              description: "알림 제목",
              example: "공동구매 참여 알림",
            },
            message: {
              type: "string",
              description: "알림 메시지",
              example: "김다마라님이 \"물티슈 공동구매\" 공동구매에 참여했습니다.",
            },
            postId: {
              type: "string",
              format: "uuid",
              nullable: true,
              description: "게시글 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            chatRoomId: {
              type: "string",
              format: "uuid",
              nullable: true,
              description: "채팅방 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            actionUrl: {
              type: "string",
              nullable: true,
              description:
                "알림 클릭 시 이동할 프론트엔드 경로. postId가 있으면 기본값은 /post/{postId}입니다.",
              example: "/post/123e4567-e89b-12d3-a456-426614174000",
            },
            isRead: {
              type: "boolean",
              description: "읽음 여부",
              example: false,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일시",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일시",
            },
          },
        },
        Favorite: {
          type: "object",
          required: ["id", "userId", "postId"],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "관심 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            userId: {
              type: "string",
              format: "uuid",
              description: "사용자 UUID",
              example: "a87522bd-bc79-47b0-a73f-46ea4068a158",
            },
            postId: {
              type: "string",
              format: "uuid",
              description: "게시글 UUID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            post: {
              description: "관심 등록한 게시글 정보",
              allOf: [{ $ref: "#/components/schemas/Post" }],
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "생성일시",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "수정일시",
            },
          },
        },
        Error: {
          type: "object",
          required: ["error", "message", "details"],
          properties: {
            error: {
              type: "string",
              description: "프론트 분기용 고정 에러 코드",
              example: "POST_NOT_FOUND",
            },
            message: {
              type: "string",
              description: "사용자 표시 또는 로그 확인용 에러 메시지",
              example: "게시글을 찾을 수 없습니다.",
            },
            details: {
              type: "object",
              description: "필드별 오류 등 추가 세부 정보",
              additionalProperties: true,
              example: {},
            },
          },
        },
      },
    },
  },
  apis: [
    "./src/routes/**/*.ts",
    "./src/controllers/**/*.ts",
    "./src/server.ts",
  ],
};

type OpenApiOperation = {
  summary?: string;
  description?: string;
};

type OpenApiPathItem = Record<string, OpenApiOperation | unknown>;

function withOperationDescriptions(spec: Record<string, any>) {
  const paths = spec.paths as Record<string, OpenApiPathItem> | undefined;

  if (!paths) {
    return spec;
  }

  for (const pathItem of Object.values(paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (
        !["get", "post", "put", "patch", "delete"].includes(
          method.toLowerCase()
        ) ||
        !operation ||
        typeof operation !== "object"
      ) {
        continue;
      }

      const openApiOperation = operation as OpenApiOperation;

      if (
        (!openApiOperation.description ||
          !openApiOperation.description.trim()) &&
        openApiOperation.summary
      ) {
        openApiOperation.description = openApiOperation.summary;
      }
    }
  }

  return spec;
}

const swaggerSpec = withOperationDescriptions(swaggerJsdoc(options));

/**
 * Swagger UI 설정
 * - 환경 변수 API_BASE_URL이 설정되어 있으면 해당 URL 사용
 * - 없으면 요청의 현재 서버 URL을 자동으로 사용 (동적)
 * - 배포 환경에서는 API_BASE_URL=https://your-domain.com 으로 설정
 *
 * 사용법:
 *   - 개발: http://localhost:3000/api-docs
 *   - 배포: https://your-domain.com/api-docs
 *   - 환경 변수로 API_BASE_URL 설정 시 해당 URL이 기본 서버로 설정됨
 */
export const setupSwagger = (app: Express) => {
  // Swagger JSON 엔드포인트 (동적 서버 URL 포함)
  // 각 요청마다 현재 서버의 URL을 동적으로 설정
  app.get("/api-docs.json", (req: Request, res: Response) => {
    const currentServerUrl = `${req.protocol}://${req.get("host")}`;

    const dynamicSpec = {
      ...swaggerSpec,
      servers: getRuntimeServers(currentServerUrl),
    };

    res.json(dynamicSpec);
  });

  // Swagger UI - 동적 JSON을 참조하도록 설정
  app.use(
    "/api-docs",
    swaggerUi.serve,
    (req: Request, res: Response, _next: NextFunction) => {
      void _next;
      // 동적 JSON URL을 사용하도록 설정
      const swaggerHtml = swaggerUi.generateHTML(
        {
          ...swaggerSpec,
          servers: getRuntimeServers(
            `${req.protocol}://${req.get("host")}`
          ),
        },
        {
          swaggerOptions: {
            persistAuthorization: true,
            url: "/api-docs.json", // 동적 JSON 참조
          },
          customCss: ".swagger-ui .topbar { display: none }",
        }
      );

      res.send(swaggerHtml);
    }
  );
};

export default swaggerSpec;
