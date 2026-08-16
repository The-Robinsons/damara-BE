// app.ts
// -----------------------------------------------------------------------------
// Express 애플리케이션의 핵심 구성 요소 정의
// - CORS 무적 모드 적용
// -----------------------------------------------------------------------------

import express from "express";
import { Request, Response, NextFunction } from "express";
import path from "path";
import morgan from "morgan";
import session from "express-session";
import passport from "passport";
import logger from "jet-logger";
import { DataTypes } from "sequelize";
import BaseRouter from "./routes";
import Paths from "./common/constants/Paths";
import HttpStatusCodes from "./common/constants/HttpStatusCodes";
import { buildErrorResponse, RouteError } from "./common/util/route-errors";
import { sequelize } from "./db";
import { setupSwagger } from "./config/swagger";
import ENV from "./common/constants/ENV";
import authRouter from "./routes/auth/AuthRoutes";
import "./config/passport";
import { PARTICIPANT_STATUSES } from "./types/participant-status";
import { NOTICE_TYPES } from "./types/notice";
import { FAQ_CATEGORIES } from "./types/faq";
import { STORED_NOTIFICATION_TYPES } from "./types/notification";
import { STORED_MESSAGE_TYPES } from "./types/chat";
import {
  POST_EXCEPTION_SEVERITIES,
  POST_EXCEPTION_STATUSES,
  POST_EXCEPTION_TYPES,
} from "./types/post-exception";
import { DEFAULT_SERVICE_NOTICES } from "./data/default-notices";
import { DEFAULT_FAQS } from "./data/default-faqs";

// 모든 모델을 import하여 Sequelize가 테이블을 인식하도록 함
import "./models/User";
import "./models/Post";
import "./models/PostImage";
import "./models/ChatRoom";
import "./models/Message";
import "./models/PostParticipant";
import "./models/TradeReview";
import "./models/TrustEvent";
import "./models/UserSettings";
import NoticeModel from "./models/Notice";
import FaqModel from "./models/Faq";
import "./models/Notification";
import "./models/PostException";
import "./models/EmailVerification";

const app = express();
app.set("trust proxy", true);

/**
 * Kubernetes health check
 * - 애플리케이션 프로세스가 HTTP 요청에 응답할 수 있는지 확인
 * - DB 상태 확인은 하지 않음
 */
app.get("/healthz", (_req, res) => {
  res.status(200).type("text/plain").send("ok");
});

/**

 * ---------------------------------------------------------------------------
 * 🔥 완전 무적 CORS 설정 (모든 브라우저 허용)
 * ---------------------------------------------------------------------------
 * - origin: 요청 보낸 origin을 그대로 허용
 * - credentials: true 허용
 * - 모든 메서드/헤더 허용
 * - OPTIONS 프리플라이트 요청 직접 처리
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, X-User-Id"
  );

  // Preflight (OPTIONS) 요청은 여기서 바로 종료
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

/**
 * ---------------------------------------------------------------------------
 * HTTP Request Logger (morgan)
 * ---------------------------------------------------------------------------
 */
app.use(morgan("combined")); // Apache combined log format

/**
 * ---------------------------------------------------------------------------
 * Request Debugging Middleware (모든 요청 로깅)
 * ---------------------------------------------------------------------------
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`[요청 수신] ${req.method} ${req.path}`);
  logger.info(`[요청 파라미터] ${JSON.stringify(req.params)}`);
  logger.info(`[요청 쿼리] ${JSON.stringify(req.query)}`);
  if (req.body && Object.keys(req.body).length > 0) {
    logger.info(`[요청 바디] ${JSON.stringify(req.body)}`);
  }
  next();
});

/**
 * ---------------------------------------------------------------------------
 * Body parser
 * ---------------------------------------------------------------------------
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * ---------------------------------------------------------------------------
 * Session & Passport
 * ---------------------------------------------------------------------------
 * - 세션 기반 로그인(Local, Kakao)을 위해 express-session과 Passport를 초기화한다.
 * - 기존 /api/users/login JSON API는 그대로 두고, /auth/* 라우트에서 세션 로그인 사용.
 */
app.use(
  session({
    //secret: ENV.DbName || "damara-secret", // TODO: 전용 SESSION_SECRET로 분리 추천
    secret: ENV.SessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60, // 1시간
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

/**
 * ---------------------------------------------------------------------------
 * Static Files
 * ---------------------------------------------------------------------------
 */
app.use(express.static(path.join(__dirname, "public")));

/**
 * ---------------------------------------------------------------------------
 * Views
 * ---------------------------------------------------------------------------
 */
const viewsDir = path.join(__dirname, "views");

app.get("/users", (_: Request, res: Response) => {
  return res.sendFile("users.html", { root: viewsDir });
});

app.get("/posts", (_: Request, res: Response) => {
  return res.sendFile("posts.html", { root: viewsDir });
});

app.get("/chat", (_: Request, res: Response) => {
  return res.sendFile("chat.html", { root: viewsDir });
});

app.get("/", (_: Request, res: Response) => {
  return res.sendFile("index.html", { root: viewsDir });
});

/**
 * ---------------------------------------------------------------------------
 * Auth Routes (Passport 기반 세션 로그인)
 * ---------------------------------------------------------------------------
 * - /auth/login, /auth/logout 등의 웹 로그인 전용 라우트
 */
app.use("/auth", authRouter);

/**
 * ---------------------------------------------------------------------------
 * Database Sync Helper
 * ---------------------------------------------------------------------------
 */
async function ensureParticipantStatusColumn() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const table = await queryInterface.describeTable("post_participants");

    if (!table.participant_status) {
      await queryInterface.addColumn(
        "post_participants",
        "participant_status",
        {
          type: DataTypes.ENUM(...PARTICIPANT_STATUSES),
          allowNull: false,
          defaultValue: "participating",
        }
      );
      logger.info("✓ post_participants.participant_status 컬럼 추가 완료");
    } else {
      await queryInterface.changeColumn(
        "post_participants",
        "participant_status",
        {
          type: DataTypes.ENUM(...PARTICIPANT_STATUSES),
          allowNull: false,
          defaultValue: "participating",
        }
      );
    }

    if (!table.received_at) {
      await queryInterface.addColumn("post_participants", "received_at", {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }

    logger.info("✓ post_participants.participant_status 컬럼 확인 완료");
  } catch (error) {
    logger.warn(
      "post_participants.participant_status 컬럼 확인 중 경고 발생"
    );
    logger.warn(error, true);
  }
}

async function ensurePostUiDetailColumns() {
  const columns = [
    {
      name: "product_name",
      definition: {
        type: DataTypes.STRING(200),
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      name: "pickup_date",
      definition: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      name: "pickup_type",
      definition: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "custom",
      },
    },
    {
      name: "pickup_zone_id",
      definition: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      name: "pickup_start_time",
      definition: {
        type: DataTypes.TIME,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      name: "pickup_end_time",
      definition: {
        type: DataTypes.TIME,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      name: "pickup_guide",
      definition: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      name: "group_buy_type",
      definition: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      name: "group_buy_mode",
      definition: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "normal",
      },
    },
    {
      name: "target_participants",
      definition: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      name: "target_price",
      definition: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      name: "tags",
      definition: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      name: "notice",
      definition: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      },
    },
  ] as const;

  try {
    const queryInterface = sequelize.getQueryInterface();
    const table = await queryInterface.describeTable("posts");

    for (const column of columns) {
      if (!table[column.name]) {
        await queryInterface.addColumn("posts", column.name, column.definition);
        logger.info(`✓ posts.${column.name} 컬럼 추가 완료`);
      }
    }

    logger.info("✓ posts UI 상세 컬럼 확인 완료");
  } catch (error) {
    logger.warn("posts UI 상세 컬럼 확인 중 경고 발생");
    logger.warn(error, true);
  }
}

async function ensureUserSettingsTable() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    const hasUserSettings = tables.some((table) => {
      const tableName =
        typeof table === "string"
          ? table
          : (table as { tableName?: string }).tableName;
      return tableName === "user_settings";
    });

    if (hasUserSettings) {
      logger.info("✓ user_settings 테이블 확인 완료");
      return;
    }

    await queryInterface.createTable("user_settings", {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      push_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      chat_notification_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      post_notification_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      marketing_notification_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      quiet_hours_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      quiet_hours_start: {
        type: DataTypes.STRING(5),
        allowNull: false,
        defaultValue: "23:00",
      },
      quiet_hours_end: {
        type: DataTypes.STRING(5),
        allowNull: false,
        defaultValue: "08:00",
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });
    logger.info("✓ user_settings 테이블 생성 완료");
  } catch (error) {
    logger.warn("user_settings 테이블 확인 중 경고 발생");
    logger.warn(error, true);
  }
}

async function ensureNoticesTable() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    const hasNotices = tables.some((table) => {
      const tableName =
        typeof table === "string"
          ? table
          : (table as { tableName?: string }).tableName;
      return tableName === "notices";
    });

    if (hasNotices) {
      logger.info("✓ notices 테이블 확인 완료");
      return;
    }

    await queryInterface.createTable("notices", {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      title: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      summary: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM(...NOTICE_TYPES),
        allowNull: false,
        defaultValue: "service",
      },
      is_pinned: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("notices", ["type", "created_at"]);
    await queryInterface.addIndex("notices", ["is_pinned", "created_at"]);
    logger.info("✓ notices 테이블 생성 완료");
  } catch (error) {
    logger.warn("notices 테이블 확인 중 경고 발생");
    logger.warn(error, true);
  }
}

async function ensureDefaultNotices() {
  try {
    const existingNotices = await NoticeModel.findAll({
      attributes: ["title"],
    });
    const existingTitles = new Set(
      existingNotices.map((notice) => notice.title)
    );
    const missingNotices = DEFAULT_SERVICE_NOTICES.filter(
      (notice) => !existingTitles.has(notice.title)
    );

    if (missingNotices.length === 0) {
      logger.info("✓ 기본 공지사항 데이터 확인 완료");
      return;
    }

    await NoticeModel.bulkCreate(
      missingNotices.map(({ category, ...notice }) => notice)
    );
    logger.info(`✓ 기본 공지사항 데이터 ${missingNotices.length}개 생성 완료`);
  } catch (error) {
    logger.warn("기본 공지사항 데이터 생성 중 경고 발생");
    logger.warn(error, true);
  }
}

async function ensureFaqsTable() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    const hasFaqs = tables.some((table) => {
      const tableName =
        typeof table === "string"
          ? table
          : (table as { tableName?: string }).tableName;
      return tableName === "faqs";
    });

    if (hasFaqs) {
      logger.info("✓ faqs 테이블 확인 완료");
      return;
    }

    await queryInterface.createTable("faqs", {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      category: {
        type: DataTypes.ENUM(...FAQ_CATEGORIES),
        allowNull: false,
        defaultValue: "etc",
      },
      question: {
        type: DataTypes.STRING(300),
        allowNull: false,
      },
      answer: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("faqs", [
      "category",
      "is_active",
      "sort_order",
    ]);
    await queryInterface.addIndex("faqs", ["is_active", "sort_order"]);
    logger.info("✓ faqs 테이블 생성 완료");
  } catch (error) {
    logger.warn("faqs 테이블 확인 중 경고 발생");
    logger.warn(error, true);
  }
}

async function ensureDefaultFaqs() {
  try {
    const existingFaqs = await FaqModel.findAll({
      attributes: ["question"],
    });
    const existingQuestions = new Set(
      existingFaqs.map((faq) => faq.question)
    );
    const missingFaqs = DEFAULT_FAQS.filter(
      (faq) => !existingQuestions.has(faq.question)
    );

    if (missingFaqs.length === 0) {
      logger.info("✓ 기본 FAQ 데이터 확인 완료");
      return;
    }

    await FaqModel.bulkCreate(missingFaqs);
    logger.info(`✓ 기본 FAQ 데이터 ${missingFaqs.length}개 생성 완료`);
  } catch (error) {
    logger.warn("기본 FAQ 데이터 생성 중 경고 발생");
    logger.warn(error, true);
  }
}

async function ensureNotificationActionColumns() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const table = await queryInterface.describeTable("notifications");

    if (!table.chat_room_id) {
      await queryInterface.addColumn("notifications", "chat_room_id", {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
        references: {
          model: "chat_rooms",
          key: "id",
        },
        onDelete: "CASCADE",
      });
      logger.info("✓ notifications.chat_room_id 컬럼 추가 완료");
    }

    if (!table.action_url) {
      await queryInterface.addColumn("notifications", "action_url", {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
      });
      logger.info("✓ notifications.action_url 컬럼 추가 완료");
    }

    await queryInterface.changeColumn("notifications", "type", {
      type: DataTypes.ENUM(...STORED_NOTIFICATION_TYPES),
      allowNull: false,
    });

    logger.info("✓ notifications action target 컬럼 확인 완료");
  } catch (error) {
    logger.warn("notifications action target 컬럼 확인 중 경고 발생");
    logger.warn(error, true);
  }
}

async function ensureMessageTypeEnum() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.describeTable("messages");
    await queryInterface.changeColumn("messages", "message_type", {
      type: DataTypes.ENUM(...STORED_MESSAGE_TYPES),
      allowNull: false,
      defaultValue: "text",
    });

    logger.info("✓ messages.message_type enum 확인 완료");
  } catch (error) {
    logger.warn("messages.message_type enum 확인 중 경고 발생");
    logger.warn(error, true);
  }
}

async function ensurePostExceptionsTable() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    const hasPostExceptions = tables.some((table) => {
      const tableName =
        typeof table === "string"
          ? table
          : (table as { tableName?: string }).tableName;
      return tableName === "post_exceptions";
    });

    if (!hasPostExceptions) {
      await queryInterface.createTable("post_exceptions", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
        },
        post_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: "posts",
            key: "id",
          },
          onDelete: "CASCADE",
        },
        reporter_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: "users",
            key: "id",
          },
          onDelete: "CASCADE",
        },
        type: {
          type: DataTypes.ENUM(...POST_EXCEPTION_TYPES),
          allowNull: false,
        },
        status: {
          type: DataTypes.ENUM(...POST_EXCEPTION_STATUSES),
          allowNull: false,
          defaultValue: "open",
        },
        reason: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        display_title: {
          type: DataTypes.STRING(200),
          allowNull: false,
        },
        display_message: {
          type: DataTypes.STRING(500),
          allowNull: false,
        },
        severity: {
          type: DataTypes.ENUM(...POST_EXCEPTION_SEVERITIES),
          allowNull: false,
          defaultValue: "warning",
        },
        old_price: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true,
          defaultValue: null,
        },
        new_price: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true,
          defaultValue: null,
        },
        affected_quantity: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: null,
        },
        metadata: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: null,
        },
        resolution_note: {
          type: DataTypes.TEXT,
          allowNull: true,
          defaultValue: null,
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      });

      await queryInterface.addIndex("post_exceptions", [
        "post_id",
        "status",
        "created_at",
      ]);
      await queryInterface.addIndex("post_exceptions", [
        "reporter_id",
        "created_at",
      ]);
      await queryInterface.addIndex("post_exceptions", ["type"]);
      logger.info("✓ post_exceptions 테이블 생성 완료");
      return;
    }

    const table = await queryInterface.describeTable("post_exceptions");

    if (!table.display_title) {
      await queryInterface.addColumn("post_exceptions", "display_title", {
        type: DataTypes.STRING(200),
        allowNull: false,
        defaultValue: "공구 예외 상황이 등록되었어요",
      });
      logger.info("✓ post_exceptions.display_title 컬럼 추가 완료");
    }

    if (!table.display_message) {
      await queryInterface.addColumn("post_exceptions", "display_message", {
        type: DataTypes.STRING(500),
        allowNull: false,
        defaultValue: "공동구매 진행 중 예외 상황이 등록되었습니다.",
      });
      logger.info("✓ post_exceptions.display_message 컬럼 추가 완료");
    }

    if (!table.severity) {
      await queryInterface.addColumn("post_exceptions", "severity", {
        type: DataTypes.ENUM(...POST_EXCEPTION_SEVERITIES),
        allowNull: false,
        defaultValue: "warning",
      });
      logger.info("✓ post_exceptions.severity 컬럼 추가 완료");
    }

    logger.info("✓ post_exceptions 테이블 확인 완료");
  } catch (error) {
    logger.warn("post_exceptions 테이블 확인 중 경고 발생");
    logger.warn(error, true);
  }
}

export async function syncDatabase() {
  if (ENV.NodeEnv === "production") {
    logger.info("Production 환경 -> 자동 DB 스키마 동기화 생략");
    return;
  }

  if (!ENV.DbForceSync) {
    logger.info("DB_FORCE_SYNC=false → 기존 데이터 유지");
    // force sync가 false여도 누락된 테이블은 생성하도록 alter 옵션 사용
    try {
      await sequelize.sync({ alter: true });
      logger.info("✓ 데이터베이스 테이블 동기화 완료 (alter 모드)");
    } catch (error) {
      logger.warn("데이터베이스 테이블 동기화 중 경고 발생 (무시 가능)");
      logger.warn(error, true);
    }
    await ensureParticipantStatusColumn();
    await ensurePostUiDetailColumns();
    await ensureUserSettingsTable();
    await ensureNoticesTable();
    await ensureDefaultNotices();
    await ensureFaqsTable();
    await ensureDefaultFaqs();
    await ensureNotificationActionColumns();
    await ensureMessageTypeEnum();
    await ensurePostExceptionsTable();
    return;
  }
  try {
    await sequelize.sync({ force: true });
    await ensureParticipantStatusColumn();
    await ensurePostUiDetailColumns();
    await ensureUserSettingsTable();
    await ensureNoticesTable();
    await ensureDefaultNotices();
    await ensureFaqsTable();
    await ensureDefaultFaqs();
    await ensureNotificationActionColumns();
    await ensureMessageTypeEnum();
    await ensurePostExceptionsTable();
    logger.info("✓ 데이터베이스 force sync 완료");
  } catch (error) {
    logger.err("✗ 데이터베이스 동기화 실패");
    logger.err(error, true);
    throw error;
  }
}

/**
 * ---------------------------------------------------------------------------
 * Swagger Docs
 * ---------------------------------------------------------------------------
 */
setupSwagger(app);

/**
 * ---------------------------------------------------------------------------
 * API Router
 * ---------------------------------------------------------------------------
 */
app.use(Paths.Base, BaseRouter);

// 디버깅: 등록된 라우트 확인 (서버 시작 후)
// Express의 라우트 스택을 확인하기 위해 서버 시작 후 로깅
setTimeout(() => {
  logger.info("=== 등록된 라우트 확인 ===");
  const routes: string[] = [];

  // Express 5.x의 라우트 스택 확인
  const routerStack = (app as any)._router?.stack || [];

  function extractRoutes(stack: any[], basePath: string = ""): void {
    stack.forEach((layer: any) => {
      if (layer.route) {
        // 직접 등록된 라우트
        const method = Object.keys(layer.route.methods)
          .join(", ")
          .toUpperCase();
        routes.push(`${method} ${basePath}${layer.route.path}`);
      } else if (layer.name === "router" || layer.regexp) {
        // 서브 라우터
        const regexp = layer.regexp?.source || "";
        // 정규식에서 경로 추출 (간단한 방법)
        const match = regexp.match(/\\\/([^\\\/]+)/g);
        let subPath = basePath;
        if (match) {
          const pathParts = match.map((p: string) => p.replace(/\\\//g, "/"));
          subPath = basePath + pathParts.join("");
        }

        if (layer.handle?.stack) {
          extractRoutes(layer.handle.stack, subPath);
        }
      }
    });
  }

  extractRoutes(routerStack);

  logger.info(`등록된 라우트 수: ${routes.length}`);

  // PATCH /:id/status 라우트가 있는지 확인
  const statusRoute = routes.find(
    (r) =>
      r.includes("PATCH") && (r.includes("status") || r.includes("/:id/status"))
  );
  if (statusRoute) {
    logger.info(`✓ 상태 변경 라우트 발견: ${statusRoute}`);
  } else {
    logger.warn("⚠ PATCH /:id/status 라우트를 찾을 수 없습니다.");
    logger.warn(
      "실제 요청을 보내서 테스트해보세요. 라우트는 등록되어 있을 수 있습니다."
    );
  }

  if (routes.length > 0) {
    routes.slice(0, 30).forEach((route) => logger.info(`  - ${route}`));
    if (routes.length > 30) {
      logger.info(`  ... 외 ${routes.length - 30}개 라우트`);
    }
  } else {
    logger.warn(
      "⚠ 라우트를 찾을 수 없습니다. 라우트 확인 로직에 문제가 있을 수 있습니다."
    );
  }
}, 2000); // 서버 시작 후 2초 뒤에 확인

/**
 * ---------------------------------------------------------------------------
 * Global Error Handler
 * ---------------------------------------------------------------------------
 */
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.err(`[Unhandled Error] ${req.method} ${req.path}`);
  logger.err(err, true);

  if (err instanceof RouteError) {
    return res
      .status(err.status)
      .json(buildErrorResponse(err.error, err.message, err.details));
  }

  return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(
    buildErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "서버 내부 오류가 발생했습니다."
    )
  );
});

export default app;
