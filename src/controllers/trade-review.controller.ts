import { NextFunction, Request, Response } from "express";
import HttpStatusCodes from "../common/constants/HttpStatusCodes";
import { getRequestUserId } from "../common/util/request-user";
import { parseReq } from "../routes/common/validation/parseReq";
import {
  TradeReviewBodyReq,
  tradeReviewBodySchema,
  UpdateTradeReviewBodyReq,
  updateTradeReviewBodySchema,
} from "../routes/common/validation/trade-review-schemas";
import { TradeReviewService } from "../services/TradeReviewService";

export async function createTradeReview(req: Request, res: Response, next: NextFunction) {
  try {
    const reviewerId = getRequestUserId(req);
    const input = parseReq<TradeReviewBodyReq>(tradeReviewBodySchema)(req.body);
    const review = await TradeReviewService.createReview(req.params.id, reviewerId, input);
    res.status(HttpStatusCodes.CREATED).json(review);
  } catch (error) {
    next(error);
  }
}

export async function updateTradeReview(req: Request, res: Response, next: NextFunction) {
  try {
    const reviewerId = getRequestUserId(req);
    const input = parseReq<UpdateTradeReviewBodyReq>(
      updateTradeReviewBodySchema
    )(req.body);
    const review = await TradeReviewService.updateReview(req.params.id, reviewerId, input);
    res.status(HttpStatusCodes.OK).json(review);
  } catch (error) {
    next(error);
  }
}

export async function getReviewEligibility(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getRequestUserId(req);
    const targets = await TradeReviewService.getEligibility(req.params.id, userId);
    res.status(HttpStatusCodes.OK).json({ postId: req.params.id, targets });
  } catch (error) {
    next(error);
  }
}

export async function getPendingReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getRequestUserId(req);
    const reviews = await TradeReviewService.getPendingReviews(userId);
    res.status(HttpStatusCodes.OK).json({ reviews, total: reviews.length });
  } catch (error) {
    next(error);
  }
}

export async function getReviewSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await TradeReviewService.getReviewSummary(req.params.id);
    res.status(HttpStatusCodes.OK).json(summary);
  } catch (error) {
    next(error);
  }
}
