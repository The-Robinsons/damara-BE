import logger from "jet-logger";
import { TradeReviewService } from "../services/TradeReviewService";

const REVIEW_PUBLICATION_INTERVAL_MS = 15 * 60 * 1000;

async function publishExpiredReviews() {
  try {
    await TradeReviewService.publishExpiredReviews();
  } catch (error) {
    logger.warn("만료된 거래 평가 공개 작업 중 경고 발생");
    logger.warn(error, true);
  }
}

export function startTradeReviewPublicationJob() {
  void publishExpiredReviews();
  const timer = setInterval(
    () => void publishExpiredReviews(),
    REVIEW_PUBLICATION_INTERVAL_MS
  );
  timer.unref();
}
