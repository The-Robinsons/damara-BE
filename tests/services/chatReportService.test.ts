import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/common/constants/ENV", () => ({
  default: {
    ReportRecipientEmail: "reports@damara.test",
  },
}));

vi.mock("../../src/repos/ChatRoomRepo", () => ({
  ChatRoomRepo: { findById: vi.fn() },
}));

vi.mock("../../src/repos/PostParticipantRepo", () => ({
  PostParticipantRepo: { isParticipant: vi.fn() },
}));

vi.mock("../../src/models/User", () => ({
  default: { findByPk: vi.fn() },
}));

import UserModel from "../../src/models/User";
import { ChatRoomRepo } from "../../src/repos/ChatRoomRepo";
import { PostParticipantRepo } from "../../src/repos/PostParticipantRepo";
import { ChatReportService } from "../../src/services/ChatReportService";

const reporterId = "123e4567-e89b-12d3-a456-426614174000";
const reportedUserId = "a87522bd-bc79-47b0-a73f-46ea4068a158";
const chatRoomId = "988fcac2-d0f3-43a8-831d-07c9fd343e50";

function user(id: string, nickname: string, email: string) {
  return {
    get: () => ({ id, nickname, email }),
  };
}

function mockValidChat() {
  vi.mocked(ChatRoomRepo.findById).mockResolvedValue({
    id: chatRoomId,
    postId: "04f5465a-140f-41cf-bdcb-b3359511c88c",
    post: {
      id: "04f5465a-140f-41cf-bdcb-b3359511c88c",
      title: "공동구매",
      authorId: reporterId,
    },
  } as never);
  vi.mocked(UserModel.findByPk)
    .mockResolvedValueOnce(user(reporterId, "신고자", "reporter@mju.ac.kr") as never)
    .mockResolvedValueOnce(
      user(reportedUserId, "신고대상", "reported@mju.ac.kr") as never
    );
  vi.mocked(PostParticipantRepo.isParticipant).mockResolvedValue(true);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("ChatReportService", () => {
  it("기존 운영 메일 주소로 정리된 신고 내용을 전송한다", async () => {
    mockValidChat();
    const send = vi.fn().mockResolvedValue(undefined);

    const result = await ChatReportService.createReport(
      {
        chatRoomId,
        reporterId,
        reportedUserId,
        category: "ABUSIVE_LANGUAGE",
        details: "<script>alert('xss')</script>",
        requestIp: "127.0.0.1",
      },
      { send }
    );

    expect(result.message).toBe("CHAT_REPORT_ACCEPTED");
    expect(result.reportId).toMatch(/^[0-9a-f-]{36}$/);
    expect(send).toHaveBeenCalledOnce();
    const message = send.mock.calls[0][0];
    expect(message.to).toBe("reports@damara.test");
    expect(message.subject).toContain("욕설이나 혐오 표현을 해요");
    expect(message.html).toContain("&lt;script&gt;");
    expect(message.html).not.toContain("<script>");
    expect(message.text).toContain("<script>alert('xss')</script>");
  });

  it("자기 자신은 신고할 수 없다", async () => {
    await expect(
      ChatReportService.createReport({
        chatRoomId,
        reporterId,
        reportedUserId: reporterId,
        category: "OTHER",
        requestIp: "127.0.0.2",
      })
    ).rejects.toMatchObject({ status: 400, error: "CANNOT_REPORT_SELF" });
  });

  it("채팅 참여자가 아닌 사용자의 신고를 거부한다", async () => {
    mockValidChat();
    vi.mocked(PostParticipantRepo.isParticipant).mockResolvedValue(false);

    await expect(
      ChatReportService.createReport({
        chatRoomId,
        reporterId: reportedUserId,
        reportedUserId: reporterId,
        category: "OTHER",
        requestIp: "127.0.0.3",
      })
    ).rejects.toMatchObject({ status: 403, error: "CHAT_REPORT_FORBIDDEN" });
  });

  it("메일 제공자 오류를 502 오류로 변환한다", async () => {
    mockValidChat();

    await expect(
      ChatReportService.createReport(
        {
          chatRoomId,
          reporterId,
          reportedUserId,
          details: "신고 내용",
          requestIp: "127.0.0.4",
        },
        { send: vi.fn().mockRejectedValue(new Error("SMTP failed")) }
      )
    ).rejects.toMatchObject({
      status: 502,
      error: "REPORT_EMAIL_DELIVERY_FAILED",
    });
  });
});
