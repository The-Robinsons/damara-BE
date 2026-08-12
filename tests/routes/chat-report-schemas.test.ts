import { describe, expect, it } from "vitest";
import { createChatReportSchema } from "../../src/routes/common/validation/chat-schemas";

const reportedUserId = "a87522bd-bc79-47b0-a73f-46ea4068a158";

describe("createChatReportSchema", () => {
  it("카테고리만 있는 신고를 허용한다", () => {
    const parsed = createChatReportSchema.parse({
      reportedUserId,
      category: "ABUSIVE_LANGUAGE",
    });

    expect(parsed.category).toBe("ABUSIVE_LANGUAGE");
  });

  it("상세 내용만 있는 신고를 허용하고 공백을 제거한다", () => {
    const parsed = createChatReportSchema.parse({
      reportedUserId,
      details: "  반복적으로 욕설을 했습니다.  ",
    });

    expect(parsed.details).toBe("반복적으로 욕설을 했습니다.");
  });

  it("카테고리와 상세 내용이 모두 없으면 거부한다", () => {
    expect(() => createChatReportSchema.parse({ reportedUserId })).toThrow(
      "REPORT_REASON_REQUIRED"
    );
  });

  it("정의되지 않은 카테고리를 거부한다", () => {
    expect(() =>
      createChatReportSchema.parse({ reportedUserId, category: "UNKNOWN" })
    ).toThrow();
  });
});
