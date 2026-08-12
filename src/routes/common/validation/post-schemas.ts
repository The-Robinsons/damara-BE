import z from "zod";
import { GROUP_BUY_MODES, GROUP_BUY_TYPES } from "../../../types/group-buy";
import { PICKUP_TYPES } from "../../../types/pickup-zone";

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Invalid date format. Use YYYY-MM-DD",
  })
  .refine((val) => !isNaN(Date.parse(`${val}T00:00:00.000Z`)), {
    message: "Invalid date value",
  });

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
  message: "Invalid time format. Use HH:mm or HH:mm:ss",
});

const tagsSchema = z.array(z.string().trim().min(1).max(50)).max(10);
const groupBuyTypeSchema = z.enum(GROUP_BUY_TYPES);
const groupBuyModeSchema = z.enum(GROUP_BUY_MODES);
const pickupTypeSchema = z.enum(PICKUP_TYPES);

/**
 * 공동구매 상품 생성 요청 스키마
 */
export const createPostSchema = z.object({
  post: z.object({
    authorId: z.string().uuid(),
    title: z.string().min(1).max(200),
    productName: z.string().trim().min(1).max(200).optional().nullable(),
    content: z.string().min(1),
    price: z.number().positive(),
    minParticipants: z.number().int().positive(),
    deadline: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid datetime format",
    }), // ISO 8601 형식 검증
    pickupType: pickupTypeSchema.optional().nullable(),
    pickupZoneId: z.string().trim().min(1).max(100).optional().nullable(),
    pickupLocation: z.string().max(200).optional().nullable(),
    pickupDate: dateOnlySchema.optional().nullable(),
    pickupStartTime: timeSchema.optional().nullable(),
    pickupEndTime: timeSchema.optional().nullable(),
    pickupGuide: z.string().trim().max(1000).optional().nullable(),
    groupBuyType: groupBuyTypeSchema.optional().nullable(),
    groupBuyMode: groupBuyModeSchema.optional().nullable(),
    targetParticipants: z.number().int().positive().optional().nullable(),
    targetPrice: z.number().positive().optional().nullable(),
    tags: tagsSchema.optional().nullable(),
    notice: z.string().trim().max(2000).optional().nullable(),
    images: z.array(z.string().min(1)).optional(), // 이미지 URL 배열 (상대 경로 또는 절대 URL 모두 허용)
    category: z
      .enum(["food", "daily", "beauty", "electronics", "school", "freemarket"])
      .optional()
      .nullable(), // 카테고리 필드 추가
  }),
});

export type CreatePostReq = z.infer<typeof createPostSchema>;

/**
 * 공동구매 상품 수정 요청 스키마
 */
export const updatePostSchema = z.object({
  post: z.object({
    title: z.string().min(1).max(200).optional(),
    productName: z.string().trim().min(1).max(200).optional().nullable(),
    content: z.string().min(1).optional(),
    price: z.number().positive().optional(),
    minParticipants: z.number().int().positive().optional(),
    status: z.enum(["open", "closed", "completed", "cancelled"]).optional(),
    deadline: z
      .string()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "Invalid datetime format",
      })
      .optional(),
    pickupType: pickupTypeSchema.optional().nullable(),
    pickupZoneId: z.string().trim().min(1).max(100).optional().nullable(),
    pickupLocation: z.string().max(200).optional().nullable(),
    pickupDate: dateOnlySchema.optional().nullable(),
    pickupStartTime: timeSchema.optional().nullable(),
    pickupEndTime: timeSchema.optional().nullable(),
    pickupGuide: z.string().trim().max(1000).optional().nullable(),
    groupBuyType: groupBuyTypeSchema.optional().nullable(),
    groupBuyMode: groupBuyModeSchema.optional().nullable(),
    targetParticipants: z.number().int().positive().optional().nullable(),
    targetPrice: z.number().positive().optional().nullable(),
    tags: tagsSchema.optional().nullable(),
    notice: z.string().trim().max(2000).optional().nullable(),
    images: z.array(z.string().min(1)).optional(), // 이미지 URL 배열 (상대 경로 또는 절대 URL 모두 허용)
    category: z
      .enum(["food", "daily", "beauty", "electronics", "school", "freemarket"])
      .optional()
      .nullable(), // 카테고리 필드 추가
  }),
});

export type UpdatePostReq = z.infer<typeof updatePostSchema>;
