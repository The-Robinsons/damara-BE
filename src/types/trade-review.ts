export const REVIEW_RATINGS = ["positive", "neutral", "negative"] as const;

export type ReviewRating = (typeof REVIEW_RATINGS)[number];

export const REVIEW_STATUSES = [
  "pending",
  "published",
  "hidden",
  "disputed",
  "invalidated",
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_ROLES = ["organizer", "participant"] as const;

export type ReviewRole = (typeof REVIEW_ROLES)[number];

export const REVIEW_POLICY_VERSION = "trust-v2" as const;
export const REVIEW_WINDOW_DAYS = 7;

export const ORGANIZER_POSITIVE_REVIEW_TAGS = [
  "ACCURATE_DESCRIPTION",
  "CLEAR_SETTLEMENT",
  "GOOD_PROGRESS_UPDATES",
  "FAST_RESPONSE",
  "CLEAR_PICKUP_GUIDE",
  "ON_TIME",
  "WELL_PREPARED",
  "KIND_COMMUNICATION",
] as const;

export const ORGANIZER_NEGATIVE_REVIEW_TAGS = [
  "INACCURATE_DESCRIPTION",
  "UNCLEAR_SETTLEMENT",
  "MISSING_PROGRESS_UPDATES",
  "SLOW_RESPONSE",
  "FREQUENT_SCHEDULE_CHANGES",
  "LATE_FOR_PICKUP",
  "POOR_PREPARATION",
  "UNFRIENDLY_COMMUNICATION",
] as const;

export const PARTICIPANT_POSITIVE_REVIEW_TAGS = [
  "PAYMENT_ON_TIME",
  "FAST_RESPONSE",
  "ON_TIME",
  "EARLY_CHANGE_NOTICE",
  "KIND_COMMUNICATION",
  "SMOOTH_TRANSACTION",
] as const;

export const PARTICIPANT_NEGATIVE_REVIEW_TAGS = [
  "LATE_PAYMENT",
  "SLOW_RESPONSE",
  "LATE_FOR_PICKUP",
  "FREQUENT_SCHEDULE_CHANGES",
  "SAME_DAY_CANCELLATION",
  "UNFRIENDLY_COMMUNICATION",
] as const;

export const REVIEW_SCORE_BY_RATING: Record<ReviewRating, number> = {
  positive: 1,
  neutral: 0,
  negative: -2,
};

export function calculateAuthorReviewScore(ratings: ReviewRating[]) {
  const rawScore = ratings.reduce(
    (sum, rating) => sum + REVIEW_SCORE_BY_RATING[rating],
    0
  );
  return {
    rawScore,
    scoreChange: Math.max(-10, Math.min(5, rawScore)),
  };
}

export function getReviewTagsForTarget(
  revieweeRole: ReviewRole,
  rating: ReviewRating
) {
  if (rating === "neutral") {
    return [] as readonly string[];
  }

  if (revieweeRole === "organizer") {
    return rating === "positive"
      ? ORGANIZER_POSITIVE_REVIEW_TAGS
      : ORGANIZER_NEGATIVE_REVIEW_TAGS;
  }

  return rating === "positive"
    ? PARTICIPANT_POSITIVE_REVIEW_TAGS
    : PARTICIPANT_NEGATIVE_REVIEW_TAGS;
}
