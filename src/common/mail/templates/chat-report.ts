import {
  CHAT_REPORT_CATEGORY_LABELS,
  ChatReportCategory,
} from "../../../types/chat-report";

export type ChatReportEmailData = {
  reportId: string;
  reportedAt: Date;
  category?: ChatReportCategory;
  details?: string;
  chatRoomId: string;
  postId: string;
  postTitle: string;
  reporter: { id: string; nickname: string; email: string };
  reportedUser: { id: string; nickname: string; email: string };
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatKoreanDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export function renderChatReportEmail(data: ChatReportEmailData) {
  const categoryLabel = data.category
    ? CHAT_REPORT_CATEGORY_LABELS[data.category]
    : "선택 안 함";
  const details = data.details || "작성 안 함";
  const subject = `[DAMARA 신고] ${categoryLabel} / 채팅방 ${data.chatRoomId.slice(0, 8)}`;
  const rows = [
    ["접수 시각", formatKoreanDate(data.reportedAt)],
    ["신고 ID", data.reportId],
    ["카테고리", categoryLabel],
    ["신고자", `${data.reporter.nickname} (${data.reporter.id})`],
    ["신고자 이메일", data.reporter.email],
    ["신고 대상", `${data.reportedUser.nickname} (${data.reportedUser.id})`],
    ["신고 대상 이메일", data.reportedUser.email],
    ["채팅방 ID", data.chatRoomId],
    ["게시글", `${data.postTitle} (${data.postId})`],
  ];
  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><th style="padding:10px;text-align:left;background:#f5f6f8;border:1px solid #ddd;">${escapeHtml(label)}</th><td style="padding:10px;border:1px solid #ddd;">${escapeHtml(value)}</td></tr>`
    )
    .join("");
  const textRows = rows.map(([label, value]) => `${label}: ${value}`).join("\n");

  return {
    subject,
    html: `<!doctype html>
<html lang="ko"><head><meta charset="utf-8" /><title>${escapeHtml(subject)}</title></head>
<body style="font-family:Arial,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#202124;">
  <h1 style="font-size:22px;">DAMARA 채팅 사용자 신고</h1>
  <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;max-width:760px;">${htmlRows}</table>
  <h2 style="margin-top:24px;font-size:18px;">상세 내용</h2>
  <div style="max-width:720px;padding:16px;background:#f5f6f8;border-radius:8px;white-space:pre-wrap;">${escapeHtml(details)}</div>
</body></html>`,
    text: `DAMARA 채팅 사용자 신고\n\n${textRows}\n\n상세 내용\n${details}`,
  };
}
