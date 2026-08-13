import z from "zod";
import { mjuEmailSchema } from "../../../common/validation/mju-email";

const passwordSchema = z.string().min(8).max(20);
const nicknameSchema = z.string().min(2).max(20);

// 유저 생성 요청 스키마 정의
export const createUserSchema = z.object({
  user: z.object({
    email: mjuEmailSchema,
    passwordHash: passwordSchema,
    nickname: nicknameSchema,
    department: z.string().optional(),
    studentId: z.string().min(1), // 학번 필수
    avatarUrl: z.string().optional(),
    emailVerificationToken: z.string().min(1).optional(),
  }),
});

//타입 추론?
export type CreateUserReq = z.infer<typeof createUserSchema>;

/**
 * 추론은 왜 하냐면
 */

//2. 사용자 수정 요청 타입
export const updateUserSchema = z.object({
  user: z.object({
    email: z.email().optional(),
    passwordHash: passwordSchema.optional(),
    nickname: nicknameSchema.optional(),
    department: z.string().optional(),
    studentId: z.string().optional(),
    avatarUrl: z.string().optional(),
  }),
});

export type UpdateUserReq = z.infer<typeof updateUserSchema>;

export const updateProfileImageSchema = z.object({
  avatarUrl: z.string().trim().min(1).max(500).nullable(),
});

export type UpdateProfileImageReq = z.infer<typeof updateProfileImageSchema>;

/**
 * 로그인 요청 스키마 (학번 + 비밀번호)
 */
export const loginSchema = z.object({
  studentId: z.string().min(1),
  password: passwordSchema,
});

export type LoginReq = z.infer<typeof loginSchema>;

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm 형식이어야 합니다.");

export const updateUserSettingsSchema = z.object({
  settings: z
    .object({
      pushEnabled: z.boolean().optional(),
      chatNotificationEnabled: z.boolean().optional(),
      postNotificationEnabled: z.boolean().optional(),
      marketingNotificationEnabled: z.boolean().optional(),
      quietHoursEnabled: z.boolean().optional(),
      quietHoursStart: timeSchema.optional(),
      quietHoursEnd: timeSchema.optional(),
    })
    .strict(),
});

export type UpdateUserSettingsReq = z.infer<typeof updateUserSettingsSchema>;
