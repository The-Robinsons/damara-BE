import { describe, expect, it } from "vitest";
import {
  tradeReviewBodySchema,
  updateTradeReviewBodySchema,
} from "../../src/routes/common/validation/trade-review-schemas";
import {
  getReviewTagsForTarget,
  calculateAuthorReviewScore,
  REVIEW_SCORE_BY_RATING,
} from "../../src/types/trade-review";

describe("tradeReviewBodySchema", () => {
  it("accepts a valid review request", () => {
    const result = tradeReviewBodySchema.safeParse({
      revieweeId: "4a1e5397-fe24-49f9-80ba-a05f7406a947",
      rating: "positive",
      tags: ["ON_TIME"],
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unsupported rating", () => {
    const result = tradeReviewBodySchema.safeParse({
      revieweeId: "4a1e5397-fe24-49f9-80ba-a05f7406a947",
      rating: "five-stars",
      tags: [],
    });

    expect(result.success).toBe(false);
  });

  it("requires tags for positive reviews and forbids them for neutral reviews", () => {
    const revieweeId = "4a1e5397-fe24-49f9-80ba-a05f7406a947";
    expect(
      tradeReviewBodySchema.safeParse({ revieweeId, rating: "positive", tags: [] })
        .success
    ).toBe(false);
    expect(
      tradeReviewBodySchema.safeParse({
        revieweeId,
        rating: "neutral",
        tags: ["ON_TIME"],
      }).success
    ).toBe(false);
  });

  it("updates only rating and tags without accepting a new target", () => {
    const result = updateTradeReviewBodySchema.parse({
      revieweeId: "4a1e5397-fe24-49f9-80ba-a05f7406a947",
      rating: "negative",
      tags: ["LATE_FOR_PICKUP"],
    });

    expect(result).toEqual({
      rating: "negative",
      tags: ["LATE_FOR_PICKUP"],
    });
  });
});

describe("trade review policy", () => {
  it("maps ratings to the documented score changes", () => {
    expect(REVIEW_SCORE_BY_RATING).toEqual({
      positive: 1,
      neutral: 0,
      negative: -2,
    });
  });

  it("keeps organizer and participant tags role-specific", () => {
    expect(getReviewTagsForTarget("organizer", "positive")).toContain(
      "CLEAR_SETTLEMENT"
    );
    expect(getReviewTagsForTarget("participant", "positive")).toContain(
      "PAYMENT_ON_TIME"
    );
  });

  it("caps organizer reviews per recruitment between -10 and +5", () => {
    expect(calculateAuthorReviewScore(Array(8).fill("positive"))).toEqual({
      rawScore: 8,
      scoreChange: 5,
    });
    expect(calculateAuthorReviewScore(Array(8).fill("negative"))).toEqual({
      rawScore: -16,
      scoreChange: -10,
    });
  });
});
