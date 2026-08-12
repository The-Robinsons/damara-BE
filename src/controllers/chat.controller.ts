// src/controllers/chat.controller.ts

import { Request, Response, NextFunction } from "express";
import { ChatService } from "../services/ChatService";
import { parseReq } from "../routes/common/validation/parseReq";
import HttpStatusCodes from "../common/constants/HttpStatusCodes";
import { sendErrorResponse } from "../common/util/route-errors";
import {
  createChatRoomSchema,
  CreateChatRoomReq,
  createMessageSchema,
  CreateMessageReq,
  createChatReportSchema,
  CreateChatReportReq,
} from "../routes/common/validation/chat-schemas";
import { getRequestUserId } from "../common/util/request-user";
import { ChatReportService } from "../services/ChatReportService";

/**
 * 채팅방 생성
 * POST /api/chat/rooms
 * body: { chatRoom: { postId } }
 */
export async function createChatRoom(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validatedData = parseReq<CreateChatRoomReq>(createChatRoomSchema)(
      req.body
    );
    const { chatRoom } = validatedData;

    const createdRoom = await ChatService.createChatRoom(chatRoom);

    res.status(HttpStatusCodes.CREATED).json(createdRoom);
  } catch (error) {
    next(error);
  }
}

/**
 * Post ID로 채팅방 조회 또는 생성
 * GET /api/chat/rooms/post/:postId
 */
export async function getOrCreateChatRoomByPostId(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { postId } = req.params;
    const chatRoom = await ChatService.getOrCreateChatRoomByPostId(postId);

    res.status(HttpStatusCodes.OK).json(chatRoom);
  } catch (error) {
    next(error);
  }
}

/**
 * 채팅방 ID로 조회
 * GET /api/chat/rooms/:id
 */
export async function getChatRoomById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const chatRoom = await ChatService.getChatRoomById(id);

    res.status(HttpStatusCodes.OK).json(chatRoom);
  } catch (error) {
    next(error);
  }
}

/**
 * 메시지 전송
 * POST /api/chat/messages
 * body: { message: { chatRoomId, senderId, content, messageType? } }
 */
export async function sendMessage(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validatedData = parseReq<CreateMessageReq>(createMessageSchema)(
      req.body
    );
    const { message } = validatedData;

    const createdMessage = await ChatService.sendMessage(message);

    res.status(HttpStatusCodes.CREATED).json(createdMessage);
  } catch (error) {
    next(error);
  }
}

/**
 * 채팅방의 메시지 목록 조회
 * GET /api/chat/rooms/:chatRoomId/messages?limit&offset
 */
export async function getMessagesByChatRoomId(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { chatRoomId } = req.params;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 50;
    const offset = req.query.offset
      ? parseInt(req.query.offset as string, 10)
      : 0;

    const messages = await ChatService.getMessagesByChatRoomId(
      chatRoomId,
      limit,
      offset
    );

    res.status(HttpStatusCodes.OK).json(messages);
  } catch (error) {
    next(error);
  }
}

/**
 * 메시지 읽음 처리
 * PATCH /api/chat/messages/:id/read
 */
export async function markMessageAsRead(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const userId = req.body.userId || req.query.userId; // TODO: 실제로는 인증 미들웨어에서 가져와야 함

    if (!userId || typeof userId !== "string") {
      return sendErrorResponse(
        res,
        HttpStatusCodes.BAD_REQUEST,
        "USER_ID_REQUIRED",
        "사용자 ID가 필요합니다."
      );
    }

    const message = await ChatService.markMessageAsRead(id, userId);

    res.status(HttpStatusCodes.OK).json(message);
  } catch (error) {
    next(error);
  }
}

/**
 * 채팅방의 모든 메시지 읽음 처리
 * PATCH /api/chat/rooms/:chatRoomId/read-all
 */
export async function markAllMessagesAsRead(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { chatRoomId } = req.params;
    const userId = req.body.userId || req.query.userId; // TODO: 실제로는 인증 미들웨어에서 가져와야 함

    if (!userId || typeof userId !== "string") {
      return sendErrorResponse(
        res,
        HttpStatusCodes.BAD_REQUEST,
        "USER_ID_REQUIRED",
        "사용자 ID가 필요합니다."
      );
    }

    await ChatService.markAllMessagesAsRead(chatRoomId, userId);

    res.status(HttpStatusCodes.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
}

/**
 * 읽지 않은 메시지 수 조회
 * GET /api/chat/rooms/:chatRoomId/unread-count?userId
 */
export async function getUnreadMessageCount(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { chatRoomId } = req.params;
    const userId = req.query.userId as string;

    if (!userId) {
      return sendErrorResponse(
        res,
        HttpStatusCodes.BAD_REQUEST,
        "USER_ID_REQUIRED",
        "사용자 ID가 필요합니다."
      );
    }

    const count = await ChatService.getUnreadMessageCount(chatRoomId, userId);

    res.status(HttpStatusCodes.OK).json({ unreadCount: count });
  } catch (error) {
    next(error);
  }
}

/**
 * 채팅방 삭제
 * DELETE /api/chat/rooms/:id
 */
export async function deleteChatRoom(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    await ChatService.deleteChatRoom(id);

    res.status(HttpStatusCodes.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
}

/**
 * 메시지 삭제
 * DELETE /api/chat/messages/:id
 */
export async function deleteMessage(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    await ChatService.deleteMessage(id);

    res.status(HttpStatusCodes.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
}

/**
 * 사용자가 참여한 채팅방 목록 조회
 * GET /api/chat/rooms/user/:userId
 */
export async function getChatRoomsByUserId(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { userId } = req.params;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 20;
    const offset = req.query.offset
      ? parseInt(req.query.offset as string, 10)
      : 0;

    const result = await ChatService.getChatRoomsByUserId(
      userId,
      limit,
      offset
    );

    res.status(HttpStatusCodes.OK).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * 채팅 사용자 신고
 * POST /api/chat/rooms/:chatRoomId/reports
 */
export async function createChatReport(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const reporterId = getRequestUserId(req);
    const report = parseReq<CreateChatReportReq>(createChatReportSchema)(
      req.body
    );
    const result = await ChatReportService.createReport({
      chatRoomId: req.params.chatRoomId,
      reporterId,
      reportedUserId: report.reportedUserId,
      category: report.category,
      details: report.details,
      requestIp: req.ip || req.socket.remoteAddress || "unknown",
    });

    res.status(HttpStatusCodes.ACCEPTED).json(result);
  } catch (error) {
    next(error);
  }
}
