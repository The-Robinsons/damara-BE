// src/services/TrustService.ts

import HttpStatusCodes from "../common/constants/HttpStatusCodes";
import { RouteError } from "../common/util/route-errors";
import { sequelize } from "../db";
import TrustEventModel, {
  TrustEventType,
} from "../models/TrustEvent";
import UserModel from "../models/User";
import { TrustEventRepo } from "../repos/TrustEventRepo";
import { REVIEW_POLICY_VERSION } from "../types/trade-review";

export const TRUST_POLICY = {
  MIN_SCORE: 0,
  MAX_SCORE: 100,
  DEFAULT_SCORE: 50,
  MIN_GRADE: 2.5,
  MAX_GRADE: 4.5,
  DEFAULT_GRADE: 3.5,
  AUTHOR_COMPLETED: 5,
  PARTICIPANT_RECEIVED: 4,
  AUTHOR_CANCELLED_PRE_PAYMENT: -2,
  AUTHOR_CANCELLED_POST_PAYMENT: -5,
  PARTICIPANT_CANCELLED_WITHIN_24_HOURS: -1,
  PARTICIPANT_CANCELLED_AFTER_PAYMENT: -3,
  PARTICIPANT_CANCELLED_PICKUP_READY: -4,
} as const;

type TrustEventMetadata = Record<string, unknown>;

interface ApplyTrustEventInput {
  userId: string;
  type: TrustEventType;
  scoreChange: number;
  postId?: string | null;
  actorUserId?: string | null;
  reason?: string | null;
  metadata?: TrustEventMetadata | null;
  sourceReviewId?: string | null;
  policyVersion?: string;
  occurredAt?: Date;
  expiresAt?: Date | null;
  idempotencyKey?: string | null;
}

const clampTrustScore = (score: number) =>
  Math.max(TRUST_POLICY.MIN_SCORE, Math.min(TRUST_POLICY.MAX_SCORE, score));

type UserWithTrustScore = {
  trustScore: number;
};

export const TrustService = {
  calculateTrustGrade(trustScore: number) {
    const clampedScore = clampTrustScore(trustScore);
    const gradeRange = TRUST_POLICY.MAX_GRADE - TRUST_POLICY.MIN_GRADE;
    const scoreRange = TRUST_POLICY.MAX_SCORE - TRUST_POLICY.MIN_SCORE;
    const grade =
      TRUST_POLICY.MIN_GRADE +
      ((clampedScore - TRUST_POLICY.MIN_SCORE) / scoreRange) * gradeRange;

    return Number(grade.toFixed(1));
  },

  withTrustGrade<T extends UserWithTrustScore>(user: T) {
    return {
      ...user,
      trustGrade: this.calculateTrustGrade(user.trustScore),
    };
  },

  async applyEvent(input: ApplyTrustEventInput) {
    try {
      return await sequelize.transaction(async (transaction) => {
        if (input.idempotencyKey) {
          const existingEvent = await TrustEventModel.findOne({
            where: { idempotencyKey: input.idempotencyKey },
            transaction,
          });
          if (existingEvent) {
            return existingEvent.get();
          }
        }

        const user = await UserModel.findByPk(input.userId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!user) {
          throw new RouteError(HttpStatusCodes.NOT_FOUND, "USER_NOT_FOUND");
        }

        const previousScore = user.trustScore;
        const nextScore = clampTrustScore(previousScore + input.scoreChange);
        const effectiveScoreChange = nextScore - previousScore;

        await user.update({ trustScore: nextScore }, { transaction });

        const event = await TrustEventModel.create(
          {
            userId: input.userId,
            postId: input.postId ?? null,
            actorUserId: input.actorUserId ?? null,
            type: input.type,
            scoreChange: effectiveScoreChange,
            previousScore,
            nextScore,
            reason: input.reason ?? null,
            metadata: input.metadata ?? null,
            sourceReviewId: input.sourceReviewId ?? null,
            policyVersion: input.policyVersion ?? "trust-v1",
            effectiveScoreChange,
            occurredAt: input.occurredAt ?? new Date(),
            expiresAt: input.expiresAt ?? null,
            idempotencyKey: input.idempotencyKey ?? null,
          },
          { transaction }
        );

        return event.get();
      });
    } catch (error) {
      if (
        input.idempotencyKey &&
        error instanceof Error &&
        error.name === "SequelizeUniqueConstraintError"
      ) {
        const existingEvent = await TrustEventModel.findOne({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existingEvent) return existingEvent.get();
      }
      throw error;
    }
  },

  async listEventsByUserId(userId: string, limit = 20, offset = 0) {
    const user = await UserModel.findByPk(userId, {
      attributes: ["id"],
    });
    if (!user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "USER_NOT_FOUND");
    }

    const [events, total] = await Promise.all([
      TrustEventRepo.findByUserId(userId, limit, offset),
      TrustEventRepo.countByUserId(userId),
    ]);
    const trustEvents = events.map((event) => ({
      ...event,
      previousGrade: this.calculateTrustGrade(event.previousScore),
      nextGrade: this.calculateTrustGrade(event.nextScore),
    }));

    return {
      trustEvents,
      total,
      limit,
      offset,
      hasNext: offset + trustEvents.length < total,
    };
  },

  async recordPostCompletedForAuthor(postId: string, authorId: string) {
    return await this.applyEvent({
      userId: authorId,
      postId,
      actorUserId: authorId,
      type: "post_completed_author",
      scoreChange: TRUST_POLICY.AUTHOR_COMPLETED,
      reason: "공동구매 거래 완료: 모집자 보상",
      policyVersion: REVIEW_POLICY_VERSION,
      idempotencyKey: `post:${postId}:author:completed:${REVIEW_POLICY_VERSION}`,
    });
  },

  async recordParticipantReceived(postId: string, participantUserId: string) {
    return await this.applyEvent({
      userId: participantUserId,
      postId,
      actorUserId: participantUserId,
      type: "participant_received",
      scoreChange: TRUST_POLICY.PARTICIPANT_RECEIVED,
      reason: "공동구매 물품 수령 완료: 참여자 보상",
      policyVersion: REVIEW_POLICY_VERSION,
      idempotencyKey: `post:${postId}:participant:${participantUserId}:received:${REVIEW_POLICY_VERSION}`,
    });
  },

  async recordParticipantReview(
    reviewId: string,
    postId: string,
    participantUserId: string,
    reviewerUserId: string,
    scoreChange: number
  ) {
    return await this.applyEvent({
      userId: participantUserId,
      postId,
      actorUserId: reviewerUserId,
      sourceReviewId: reviewId,
      type: "trade_review_participant",
      scoreChange,
      reason: "거래 상호평가: 참여자 평가",
      policyVersion: REVIEW_POLICY_VERSION,
      idempotencyKey: `review:${reviewId}:score:${REVIEW_POLICY_VERSION}`,
    });
  },

  async recordAuthorReviewAggregate(
    postId: string,
    authorId: string,
    scoreChange: number,
    metadata: TrustEventMetadata
  ) {
    return await this.applyEvent({
      userId: authorId,
      postId,
      type: "post_review_aggregate_author",
      scoreChange,
      reason: "거래 상호평가: 모집자 모집 단위 합산",
      metadata,
      policyVersion: REVIEW_POLICY_VERSION,
      idempotencyKey: `post:${postId}:author:review-aggregate:${REVIEW_POLICY_VERSION}`,
    });
  },

  async recordPostCancelledByAuthor(
    postId: string,
    authorId: string,
    scoreChange: number
  ) {
    return await this.applyEvent({
      userId: authorId,
      postId,
      actorUserId: authorId,
      type: "post_cancelled_by_author",
      scoreChange,
      reason: "공동구매 취소: 작성자 감점",
      policyVersion: REVIEW_POLICY_VERSION,
      idempotencyKey: `post:${postId}:author:cancelled:${REVIEW_POLICY_VERSION}`,
    });
  },

  async recordParticipantCancelled(
    postId: string,
    participantUserId: string,
    scoreChange: number
  ) {
    return await this.applyEvent({
      userId: participantUserId,
      postId,
      actorUserId: participantUserId,
      type: "participant_cancelled",
      scoreChange,
      reason: "공동구매 참여 취소: 참여자 감점",
      policyVersion: REVIEW_POLICY_VERSION,
      idempotencyKey: `post:${postId}:participant:${participantUserId}:cancelled:${REVIEW_POLICY_VERSION}`,
    });
  },
};
