import z from "zod";
import { MESSAGE_TYPES } from "../../../types/chat";
import { CHAT_REPORT_CATEGORIES } from "../../../types/chat-report";

/**
 * 채팅방 생성 요청 스키마
 */
export const createChatRoomSchema = z.object({
  chatRoom: z.object({
    postId: z.string().uuid(),
  }),
});

export type CreateChatRoomReq = z.infer<typeof createChatRoomSchema>;

/**
 * 메시지 생성 요청 스키마
 */
export const createMessageSchema = z.object({
  message: z.object({
    chatRoomId: z.string().uuid(),
    senderId: z.string().uuid(),
    content: z.string().min(1),
    messageType: z.enum(MESSAGE_TYPES).optional().default("text"),
  }),
});

export type CreateMessageReq = z.infer<typeof createMessageSchema>;

/**
 * 메시지 수정 요청 스키마 (읽음 처리 등)
 */
export const updateMessageSchema = z.object({
  message: z.object({
    isRead: z.boolean().optional(),
  }),
});

export type UpdateMessageReq = z.infer<typeof updateMessageSchema>;

export const createChatReportSchema = z
  .object({
    reportedUserId: z.string().uuid(),
    category: z.enum(CHAT_REPORT_CATEGORIES).nullish(),
    details: z.string().trim().max(1000).nullish(),
  })
  .superRefine((value, context) => {
    if (!value.category && !value.details) {
      context.addIssue({
        code: "custom",
        message: "REPORT_REASON_REQUIRED",
        path: ["details"],
      });
    }
  });

export type CreateChatReportReq = z.infer<typeof createChatReportSchema>;
