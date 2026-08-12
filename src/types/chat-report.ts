export const CHAT_REPORT_CATEGORIES = [
  "COMMERCIAL_SPAM",
  "MANNER",
  "ABUSIVE_LANGUAGE",
  "SEXUAL_HARASSMENT",
  "TRANSACTION_DISPUTE",
  "FRAUD",
  "DATING_ATTEMPT",
  "OTHER",
] as const;

export type ChatReportCategory = (typeof CHAT_REPORT_CATEGORIES)[number];

export const CHAT_REPORT_CATEGORY_LABELS: Record<ChatReportCategory, string> = {
  COMMERCIAL_SPAM: "전문 판매자 또는 스팸 같아요",
  MANNER: "비매너 사용자예요",
  ABUSIVE_LANGUAGE: "욕설이나 혐오 표현을 해요",
  SEXUAL_HARASSMENT: "성희롱을 해요",
  TRANSACTION_DISPUTE: "거래 또는 환불 문제가 있어요",
  FRAUD: "사기당했어요",
  DATING_ATTEMPT: "연애 목적의 대화를 시도해요",
  OTHER: "다른 문제가 있어요",
};
