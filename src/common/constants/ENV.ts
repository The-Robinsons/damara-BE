/* eslint-disable n/no-process-env */

import { NodeEnvs } from ".";
import { z } from "zod";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

/******************************************************************************
                                 Setup
******************************************************************************/

// 현재 실행 환경
const NODE_ENV = process.env.NODE_ENV ?? "development";

// src/common/constants와 dist/src/common/constants 양쪽에서 프로젝트 root 탐색
const isCompiledSource = __dirname
  .split(path.sep)
  .includes("dist");
const rootDir = path.resolve(
  __dirname,
  isCompiledSource ? "../../../.." : "../../.."
);

// dotenv가 탐색할 경로들
const candidateEnvPaths = [
  path.join(rootDir, "config", `.env.${NODE_ENV}`),
  path.join(rootDir, `.env.${NODE_ENV}`),
  path.join(rootDir, ".env"),
];

let envLoaded = false;

// 파일 존재하면 해당 경로의 env 파일을 읽음
for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    envLoaded = true;
    break;
  }
}

// 그래도 못 찾으면 기본 dotenv 동작
if (!envLoaded) {
  dotenv.config();
}

// Zod로 환경 변수 검증
const envSchema = z.object({
  NODE_ENV: z
    .enum([NodeEnvs.Dev, NodeEnvs.Test, NodeEnvs.Production])
    .default(NodeEnvs.Dev),

  PORT: z.coerce.number().int().positive().default(3000),

  DB_HOST: z.string().min(1, "DB_HOST is required"),
  DB_USER: z.string().min(1, "DB_USER is required"),
  DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required"),
  DB_NAME: z.string().min(1, "DB_NAME is required"),
  DB_PORT: z.coerce.number().int().positive().optional().default(3306),

  API_BASE_URL: z.string().url().optional(),
  DB_FORCE_SYNC: z
    .string()
    .optional()
    .transform((val) => val === "true"),


  SESSION_SECRET: z.string().min(32).optional(),

  KAKAO_CLIENT_ID: z.string().min(1, "KAKAO_CLIENT_ID is required"),
  KAKAO_CALLBACK_URL: z.string().url().optional().default("http://localhost:3000/auth/kakao/callback"),

  MAIL_PROVIDER: z.enum(["smtp", "json"]).default("json"),
  MAIL_FROM: z.string().email().default("no-reply@damara.local"),
  MAIL_FROM_NAME: z.string().min(1).default("DAMARA"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  REPORT_RECIPIENT_EMAIL: z.string().email().optional(),
  EMAIL_VERIFICATION_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  EMAIL_VERIFICATION_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  EMAIL_VERIFICATION_RESEND_SECONDS: z.coerce.number().int().positive().default(60),
  EMAIL_VERIFICATION_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  EMAIL_VERIFICATION_MAX_SENDS_PER_HOUR: z.coerce.number().int().positive().default(5),
  EMAIL_VERIFICATION_MAX_IP_SENDS_PER_HOUR: z.coerce.number().int().positive().default(20),
  EMAIL_VERIFICATION_REQUIRED: z
    .string()
    .default("true")
    .transform((value) => value === "true"),
  EMAIL_VERIFICATION_HMAC_SECRET: z.string().default("local-email-verification-secret"),
});

// 실제 환경 변수 파싱
const isTestEnvironment = NODE_ENV === NodeEnvs.Test;
const parsed = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,

  DB_HOST: process.env.DB_HOST ?? (isTestEnvironment ? "localhost" : undefined),
  DB_USER: process.env.DB_USER ?? (isTestEnvironment ? "test" : undefined),
  DB_PASSWORD:
    process.env.DB_PASSWORD ?? (isTestEnvironment ? "test" : undefined),
  DB_NAME: process.env.DB_NAME ?? (isTestEnvironment ? "damara_test" : undefined),
  DB_PORT: process.env.DB_PORT,

  API_BASE_URL: process.env.API_BASE_URL,
  DB_FORCE_SYNC: process.env.DB_FORCE_SYNC,


  SESSION_SECRET: process.env.SESSION_SECRET,

  KAKAO_CLIENT_ID:
    process.env.KAKAO_CLIENT_ID ?? (isTestEnvironment ? "test" : undefined),
  KAKAO_CALLBACK_URL: process.env.KAKAO_CALLBACK_URL,

  MAIL_PROVIDER: process.env.MAIL_PROVIDER,
  MAIL_FROM: process.env.MAIL_FROM,
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  REPORT_RECIPIENT_EMAIL: process.env.REPORT_RECIPIENT_EMAIL,
  EMAIL_VERIFICATION_CODE_TTL_SECONDS:
    process.env.EMAIL_VERIFICATION_CODE_TTL_SECONDS,
  EMAIL_VERIFICATION_TOKEN_TTL_SECONDS:
    process.env.EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
  EMAIL_VERIFICATION_RESEND_SECONDS:
    process.env.EMAIL_VERIFICATION_RESEND_SECONDS,
  EMAIL_VERIFICATION_MAX_ATTEMPTS:
    process.env.EMAIL_VERIFICATION_MAX_ATTEMPTS,
  EMAIL_VERIFICATION_MAX_SENDS_PER_HOUR:
    process.env.EMAIL_VERIFICATION_MAX_SENDS_PER_HOUR,
  EMAIL_VERIFICATION_MAX_IP_SENDS_PER_HOUR:
    process.env.EMAIL_VERIFICATION_MAX_IP_SENDS_PER_HOUR,
  EMAIL_VERIFICATION_REQUIRED: process.env.EMAIL_VERIFICATION_REQUIRED,
  EMAIL_VERIFICATION_HMAC_SECRET:
    process.env.EMAIL_VERIFICATION_HMAC_SECRET,
});

if (parsed.NODE_ENV === NodeEnvs.Production) {
  if (!parsed.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required in production");
  }
  const missingMailConfig = [
    parsed.MAIL_PROVIDER !== "smtp" && "MAIL_PROVIDER=smtp",
    !process.env.MAIL_FROM && "MAIL_FROM",
    !process.env.EMAIL_VERIFICATION_HMAC_SECRET &&
      "EMAIL_VERIFICATION_HMAC_SECRET",
    parsed.MAIL_PROVIDER === "smtp" && !process.env.SMTP_HOST && "SMTP_HOST",
  ].filter(Boolean);

  if (missingMailConfig.length > 0) {
    throw new Error(
      `Missing production email configuration: ${missingMailConfig.join(", ")}`
    );
  }
}

// 최종 ENV 객체
const ENV = {
  NodeEnv: parsed.NODE_ENV,
  Port: parsed.PORT,

  DbHost: parsed.DB_HOST,
  DbUser: parsed.DB_USER,
  DbPassword: parsed.DB_PASSWORD,
  DbName: parsed.DB_NAME,
  DbPort: parsed.DB_PORT,

  ApiBaseUrl: parsed.API_BASE_URL || `http://localhost:${parsed.PORT}`,
  ApiBaseUrlConfigured: Boolean(parsed.API_BASE_URL),
  DbForceSync: parsed.DB_FORCE_SYNC ?? false,


  SessionSecret:
    parsed.SESSION_SECRET ??
    "damara-local-development-session-secret",

  KakaoClientId: parsed.KAKAO_CLIENT_ID,
  KakaoCallbackUrl: parsed.KAKAO_CALLBACK_URL,

  MailProvider: parsed.MAIL_PROVIDER,
  MailFrom: parsed.MAIL_FROM,
  MailFromName: parsed.MAIL_FROM_NAME,
  SmtpHost: parsed.SMTP_HOST,
  SmtpPort: parsed.SMTP_PORT,
  SmtpSecure: parsed.SMTP_SECURE,
  SmtpUser: parsed.SMTP_USER,
  SmtpPassword: parsed.SMTP_PASSWORD,
  ReportRecipientEmail: parsed.REPORT_RECIPIENT_EMAIL || parsed.MAIL_FROM,
  EmailVerificationCodeTtlSeconds:
    parsed.EMAIL_VERIFICATION_CODE_TTL_SECONDS,
  EmailVerificationTokenTtlSeconds:
    parsed.EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
  EmailVerificationResendSeconds: parsed.EMAIL_VERIFICATION_RESEND_SECONDS,
  EmailVerificationMaxAttempts: parsed.EMAIL_VERIFICATION_MAX_ATTEMPTS,
  EmailVerificationMaxSendsPerHour:
    parsed.EMAIL_VERIFICATION_MAX_SENDS_PER_HOUR,
  EmailVerificationMaxIpSendsPerHour:
    parsed.EMAIL_VERIFICATION_MAX_IP_SENDS_PER_HOUR,
  EmailVerificationRequired: parsed.EMAIL_VERIFICATION_REQUIRED,
  EmailVerificationHmacSecret: parsed.EMAIL_VERIFICATION_HMAC_SECRET,
};

/******************************************************************************
                            Export default
******************************************************************************/

export default ENV;

export type AppEnv = typeof ENV;
