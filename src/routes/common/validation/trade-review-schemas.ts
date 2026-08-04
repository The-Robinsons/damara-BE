import z from "zod";
import { REVIEW_RATINGS } from "../../../types/trade-review";

export const tradeReviewBodySchema = z
  .object({
    revieweeId: z.string().uuid(),
    rating: z.enum(REVIEW_RATINGS),
    tags: z.array(z.string().min(1)).max(5).default([]),
  })
  .superRefine((input, ctx) => {
    if (input.rating === "neutral" && input.tags.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["tags"],
        message: "Neutral reviews cannot include tags",
      });
    }
    if (input.rating !== "neutral" && input.tags.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["tags"],
        message: "Positive and negative reviews require at least one tag",
      });
    }
    if (new Set(input.tags).size !== input.tags.length) {
      ctx.addIssue({
        code: "custom",
        path: ["tags"],
        message: "Review tags must be unique",
      });
    }
  });

export type TradeReviewBodyReq = z.infer<typeof tradeReviewBodySchema>;

export const updateTradeReviewBodySchema = z
  .object({
    rating: z.enum(REVIEW_RATINGS),
    tags: z.array(z.string().min(1)).max(5).default([]),
  })
  .superRefine((input, ctx) => {
    if (input.rating === "neutral" && input.tags.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["tags"],
        message: "Neutral reviews cannot include tags",
      });
    }
    if (input.rating !== "neutral" && input.tags.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["tags"],
        message: "Positive and negative reviews require at least one tag",
      });
    }
    if (new Set(input.tags).size !== input.tags.length) {
      ctx.addIssue({
        code: "custom",
        path: ["tags"],
        message: "Review tags must be unique",
      });
    }
  });

export type UpdateTradeReviewBodyReq = z.infer<
  typeof updateTradeReviewBodySchema
>;
