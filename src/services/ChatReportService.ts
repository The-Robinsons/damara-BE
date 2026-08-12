import { randomUUID } from "node:crypto";
import HttpStatusCodes from "../common/constants/HttpStatusCodes";
import ENV from "../common/constants/ENV";
import { emailSender, EmailSender } from "../common/mail/EmailSender";
import { renderChatReportEmail } from "../common/mail/templates/chat-report";
import { RouteError } from "../common/util/route-errors";
import UserModel from "../models/User";
import { ChatRoomRepo } from "../repos/ChatRoomRepo";
import { PostParticipantRepo } from "../repos/PostParticipantRepo";
import { ChatReportCategory } from "../types/chat-report";

const HOUR_MS = 60 * 60 * 1000;
const USER_REPORT_LIMIT = 5;
const IP_REPORT_LIMIT = 20;
const reportAttempts = new Map<string, number[]>();

function routeError(status: HttpStatusCodes, code: string) {
  return new RouteError(status, code);
}

function assertWithinRateLimit(key: string, limit: number, now: Date) {
  const cutoff = now.getTime() - HOUR_MS;
  const attempts = (reportAttempts.get(key) || []).filter(
    (timestamp) => timestamp > cutoff
  );

  if (attempts.length >= limit) {
    throw routeError(
      HttpStatusCodes.TOO_MANY_REQUESTS,
      "CHAT_REPORT_RATE_LIMITED"
    );
  }

  attempts.push(now.getTime());
  reportAttempts.set(key, attempts);
}

async function isChatMember(postId: string, authorId: string, userId: string) {
  if (authorId === userId) {
    return true;
  }

  return PostParticipantRepo.isParticipant(postId, userId);
}

export type CreateChatReportInput = {
  chatRoomId: string;
  reporterId: string;
  reportedUserId: string;
  category?: ChatReportCategory | null;
  details?: string | null;
  requestIp: string;
};

export const ChatReportService = {
  async createReport(
    input: CreateChatReportInput,
    sender: EmailSender = emailSender
  ) {
    if (input.reporterId === input.reportedUserId) {
      throw routeError(HttpStatusCodes.BAD_REQUEST, "CANNOT_REPORT_SELF");
    }

    const chatRoom = await ChatRoomRepo.findById(input.chatRoomId);
    if (!chatRoom) {
      throw routeError(HttpStatusCodes.NOT_FOUND, "CHAT_ROOM_NOT_FOUND");
    }

    const post = (chatRoom as any).post;
    const [reporter, reportedUser] = await Promise.all([
      UserModel.findByPk(input.reporterId, {
        attributes: ["id", "nickname", "email"],
      }),
      UserModel.findByPk(input.reportedUserId, {
        attributes: ["id", "nickname", "email"],
      }),
    ]);

    if (!reporter) {
      throw routeError(HttpStatusCodes.NOT_FOUND, "USER_NOT_FOUND");
    }
    if (!reportedUser) {
      throw routeError(HttpStatusCodes.NOT_FOUND, "REPORTED_USER_NOT_FOUND");
    }

    const [reporterIsMember, reportedUserIsMember] = await Promise.all([
      isChatMember(chatRoom.postId, post.authorId, input.reporterId),
      isChatMember(chatRoom.postId, post.authorId, input.reportedUserId),
    ]);
    if (!reporterIsMember || !reportedUserIsMember) {
      throw routeError(HttpStatusCodes.FORBIDDEN, "CHAT_REPORT_FORBIDDEN");
    }

    const reportedAt = new Date();
    assertWithinRateLimit(`user:${input.reporterId}`, USER_REPORT_LIMIT, reportedAt);
    assertWithinRateLimit(`ip:${input.requestIp || "unknown"}`, IP_REPORT_LIMIT, reportedAt);

    const reportId = randomUUID();
    const template = renderChatReportEmail({
      reportId,
      reportedAt,
      category: input.category || undefined,
      details: input.details || undefined,
      chatRoomId: chatRoom.id,
      postId: chatRoom.postId,
      postTitle: post.title,
      reporter: reporter.get({ plain: true }),
      reportedUser: reportedUser.get({ plain: true }),
    });

    try {
      await sender.send({ to: ENV.ReportRecipientEmail, ...template });
    } catch {
      throw routeError(
        HttpStatusCodes.BAD_GATEWAY,
        "REPORT_EMAIL_DELIVERY_FAILED"
      );
    }

    return { message: "CHAT_REPORT_ACCEPTED", reportId };
  },
};
