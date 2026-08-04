import HttpStatusCodes from "../common/constants/HttpStatusCodes";
import { RouteError } from "../common/util/route-errors";
import { Op } from "sequelize";
import PostModel from "../models/Post";
import PostParticipantModel from "../models/PostParticipant";
import TradeReviewModel from "../models/TradeReview";
import UserModel from "../models/User";
import { TradeReviewRepo } from "../repos/TradeReviewRepo";
import {
  calculateAuthorReviewScore,
  getReviewTagsForTarget,
  REVIEW_POLICY_VERSION,
  REVIEW_SCORE_BY_RATING,
  REVIEW_WINDOW_DAYS,
  ReviewRating,
  ReviewRole,
} from "../types/trade-review";
import { TrustService } from "./TrustService";

const REVIEW_WINDOW_MS = REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function addReviewWindow(receivedAt: Date) {
  return new Date(receivedAt.getTime() + REVIEW_WINDOW_MS);
}

function serializeReview(review: TradeReviewModel) {
  return {
    id: review.id,
    postId: review.postId,
    revieweeId: review.revieweeId,
    reviewerRole: review.reviewerRole,
    revieweeRole: review.revieweeRole,
    rating: review.rating,
    tags: review.tags,
    status: review.status,
    submittedAt: review.submittedAt,
    publishedAt: review.publishedAt,
    expiresAt: review.expiresAt,
  };
}

function getAllowedTags(revieweeRole: ReviewRole) {
  return {
    positive: [...getReviewTagsForTarget(revieweeRole, "positive")],
    neutral: [],
    negative: [...getReviewTagsForTarget(revieweeRole, "negative")],
  };
}

function summarizeReviews(reviews: TradeReviewModel[]) {
  const ratings = { positive: 0, neutral: 0, negative: 0 };
  const tagCounts: Record<string, number> = {};
  reviews.forEach((review) => {
    ratings[review.rating] += 1;
    review.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    });
  });
  return {
    reviewCount: reviews.length,
    ratings,
    tags: Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count })),
  };
}

function validateTags(
  revieweeRole: ReviewRole,
  rating: ReviewRating,
  tags: string[]
) {
  if (rating === "neutral" && tags.length > 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "NEUTRAL_REVIEW_HAS_TAGS");
  }
  if (rating !== "neutral" && tags.length === 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "REVIEW_TAG_REQUIRED");
  }

  const allowedTags = new Set(getReviewTagsForTarget(revieweeRole, rating));
  if (tags.some((tag) => !allowedTags.has(tag))) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "INVALID_REVIEW_TAG");
  }
}

async function resolveRoles(
  postId: string,
  reviewerId: string,
  revieweeId: string
) {
  const post = await PostModel.findByPk(postId);
  if (!post) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "POST_NOT_FOUND");
  }
  if (post.status !== "completed") {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "REVIEW_NOT_AVAILABLE");
  }

  const reviewerIsAuthor = post.authorId === reviewerId;
  const revieweeIsAuthor = post.authorId === revieweeId;
  if (reviewerIsAuthor === revieweeIsAuthor) {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, "REVIEW_TARGET_FORBIDDEN");
  }

  const participantId = reviewerIsAuthor ? revieweeId : reviewerId;
  const participant = await PostParticipantModel.findOne({
    where: { postId, userId: participantId, participantStatus: "received" },
  });
  if (!participant || !participant.receivedAt) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "RECEIPT_REQUIRED");
  }

  const expiresAt = addReviewWindow(participant.receivedAt);
  if (expiresAt <= new Date()) {
    throw new RouteError(HttpStatusCodes.GONE, "REVIEW_WINDOW_EXPIRED");
  }

  return {
    post,
    reviewerRole: (reviewerIsAuthor ? "organizer" : "participant") as ReviewRole,
    revieweeRole: (revieweeIsAuthor ? "organizer" : "participant") as ReviewRole,
    expiresAt,
  };
}

async function applyPublishedReview(review: TradeReviewModel) {
  if (review.scoreAppliedAt || review.status !== "published") return;

  if (review.revieweeRole === "participant") {
    await TrustService.recordParticipantReview(
      review.id,
      review.postId,
      review.revieweeId,
      review.reviewerId,
      REVIEW_SCORE_BY_RATING[review.rating]
    );
    review.scoreAppliedAt = new Date();
    await review.save();
  }
}

async function finalizeAuthorAggregate(postId: string) {
  const post = await PostModel.findByPk(postId);
  if (!post || post.status !== "completed") return;

  const participants = await PostParticipantModel.findAll({
    where: { postId, participantStatus: "received" },
  });
  if (participants.length === 0) return;

  const reviews = await TradeReviewModel.findAll({
    where: { postId, revieweeId: post.authorId, revieweeRole: "organizer" },
  });
  const publishedReviewerIds = new Set(
    reviews
      .filter((review) => review.status === "published")
      .map((review) => review.reviewerId)
  );
  const allSubmitted = participants.every((participant) =>
    publishedReviewerIds.has(participant.userId)
  );
  const allExpired = participants.every(
    (participant) =>
      participant.receivedAt &&
      addReviewWindow(participant.receivedAt) <= new Date()
  );
  if (!allSubmitted && !allExpired) return;

  const { rawScore, scoreChange } = calculateAuthorReviewScore(
    reviews
      .filter((review) => review.status === "published")
      .map((review) => review.rating)
  );
  await TrustService.recordAuthorReviewAggregate(
    postId,
    post.authorId,
    scoreChange,
    {
      rawScore,
      appliedScore: scoreChange,
      reviewCount: publishedReviewerIds.size,
    }
  );

  await TradeReviewModel.update(
    { scoreAppliedAt: new Date() },
    {
      where: {
        postId,
        revieweeId: post.authorId,
        status: "published",
        scoreAppliedAt: null,
      },
    }
  );
}

async function publishReviews(reviews: TradeReviewModel[]) {
  const now = new Date();
  for (const review of reviews) {
    if (review.status !== "pending") continue;
    review.status = "published";
    review.publishedAt = now;
    await review.save();
  }
  for (const review of reviews) {
    await applyPublishedReview(review);
  }
  for (const postId of new Set(reviews.map((review) => review.postId))) {
    await finalizeAuthorAggregate(postId);
  }
}

async function publishExpiredReviews() {
  const expired = await TradeReviewRepo.findExpiredPending();
  await publishReviews(expired);

  const unappliedParticipantReviews =
    await TradeReviewRepo.findPublishedUnappliedParticipantReviews();
  for (const review of unappliedParticipantReviews) {
    await applyPublishedReview(review);
  }

  const expiredParticipants = await PostParticipantModel.findAll({
    where: {
      participantStatus: "received",
      receivedAt: { [Op.lte]: new Date(Date.now() - REVIEW_WINDOW_MS) },
    },
    attributes: ["postId"],
    group: ["postId"],
  });
  for (const participant of expiredParticipants) {
    await finalizeAuthorAggregate(participant.postId);
  }
}

export const TradeReviewService = {
  async publishExpiredReviews() {
    await publishExpiredReviews();
  },

  async createReview(
    postId: string,
    reviewerId: string,
    input: { revieweeId: string; rating: ReviewRating; tags: string[] }
  ) {
    if (reviewerId === input.revieweeId) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "SELF_REVIEW_FORBIDDEN");
    }
    await publishExpiredReviews();
    const roles = await resolveRoles(postId, reviewerId, input.revieweeId);
    validateTags(roles.revieweeRole, input.rating, input.tags);

    if (await TradeReviewRepo.findPair(postId, reviewerId, input.revieweeId)) {
      throw new RouteError(HttpStatusCodes.CONFLICT, "REVIEW_ALREADY_SUBMITTED");
    }

    let created;
    try {
      created = await TradeReviewModel.create({
        postId,
        reviewerId,
        revieweeId: input.revieweeId,
        reviewerRole: roles.reviewerRole,
        revieweeRole: roles.revieweeRole,
        rating: input.rating,
        tags: [...new Set(input.tags)],
        expiresAt: roles.expiresAt,
        policyVersion: REVIEW_POLICY_VERSION,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "SequelizeUniqueConstraintError") {
        throw new RouteError(HttpStatusCodes.CONFLICT, "REVIEW_ALREADY_SUBMITTED");
      }
      throw error;
    }

    const reciprocal = await TradeReviewRepo.findReciprocal(
      postId,
      reviewerId,
      input.revieweeId
    );
    if (reciprocal) await publishReviews([created, reciprocal]);
    return serializeReview(created);
  },

  async updateReview(
    reviewId: string,
    reviewerId: string,
    input: { rating: ReviewRating; tags: string[] }
  ) {
    await publishExpiredReviews();
    const review = await TradeReviewRepo.findById(reviewId);
    if (!review) throw new RouteError(HttpStatusCodes.NOT_FOUND, "REVIEW_NOT_FOUND");
    if (review.reviewerId !== reviewerId) {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, "REVIEW_UPDATE_FORBIDDEN");
    }
    if (review.status !== "pending") {
      throw new RouteError(HttpStatusCodes.CONFLICT, "REVIEW_NOT_EDITABLE");
    }
    validateTags(review.revieweeRole, input.rating, input.tags);
    review.rating = input.rating;
    review.tags = [...new Set(input.tags)];
    await review.save();
    return serializeReview(review);
  },

  async getEligibility(
    postId: string,
    userId: string,
    skipPublication = false
  ) {
    if (!skipPublication) await publishExpiredReviews();
    const post = await PostModel.findByPk(postId);
    if (!post) throw new RouteError(HttpStatusCodes.NOT_FOUND, "POST_NOT_FOUND");
    if (post.status !== "completed") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "REVIEW_NOT_AVAILABLE");
    }

    if (post.authorId === userId) {
      const participants = await PostParticipantModel.findAll({
        where: { postId, participantStatus: "received" },
        include: [
          {
            model: UserModel,
            as: "user",
            attributes: ["id", "nickname", "avatarUrl"],
          },
        ],
      });
      return await Promise.all(
        participants.map(async (participant) => {
          const review = await TradeReviewRepo.findPair(
            postId,
            userId,
            participant.userId
          );
          const expiresAt = participant.receivedAt
            ? addReviewWindow(participant.receivedAt)
            : null;
          return {
            reviewee: participant.get("user"),
            revieweeRole: "participant",
            allowedTags: getAllowedTags("participant"),
            status:
              review?.status ??
              (expiresAt && expiresAt <= new Date()
                ? "expired"
                : "not_submitted"),
            reviewId: review?.id ?? null,
            expiresAt,
          };
        })
      );
    }

    const participant = await PostParticipantModel.findOne({
      where: { postId, userId },
    });
    if (
      !participant ||
      participant.participantStatus !== "received" ||
      !participant.receivedAt
    ) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "REVIEW_NOT_ELIGIBLE"
      );
    }
    const review = await TradeReviewRepo.findPair(postId, userId, post.authorId);
    const expiresAt = participant.receivedAt
      ? addReviewWindow(participant.receivedAt)
      : null;
    return [
      {
        reviewee: await UserModel.findByPk(post.authorId, {
          attributes: ["id", "nickname", "avatarUrl"],
        }),
        revieweeRole: "organizer",
        allowedTags: getAllowedTags("organizer"),
        status:
          review?.status ??
          (expiresAt && expiresAt <= new Date()
            ? "expired"
            : "not_submitted"),
        reviewId: review?.id ?? null,
        expiresAt,
      },
    ];
  },

  async getPendingReviews(userId: string) {
    await publishExpiredReviews();
    const authoredPosts = await PostModel.findAll({
      where: { authorId: userId, status: "completed" },
    });
    const participated = await PostParticipantModel.findAll({
      where: { userId, participantStatus: "received" },
      include: [
        {
          model: PostModel,
          as: "post",
          where: { status: "completed" },
          required: true,
        },
      ],
    });
    const result: unknown[] = [];
    for (const post of authoredPosts) {
      const targets = await this.getEligibility(post.id, userId, true);
      result.push(
        ...targets
          .filter((target) => target.status === "not_submitted")
          .map((target) => ({
            postId: post.id,
            postTitle: post.title,
            ...target,
          }))
      );
    }
    for (const participant of participated) {
      const post = participant.get("post") as PostModel;
      const targets = await this.getEligibility(post.id, userId, true);
      result.push(
        ...targets
          .filter((target) => target.status === "not_submitted")
          .map((target) => ({
            postId: post.id,
            postTitle: post.title,
            ...target,
          }))
      );
    }
    return result;
  },

  async getReviewSummary(userId: string) {
    await publishExpiredReviews();
    const user = await UserModel.findByPk(userId, {
      attributes: ["id", "trustScore"],
    });
    if (!user) throw new RouteError(HttpStatusCodes.NOT_FOUND, "USER_NOT_FOUND");
    const reviews = await TradeReviewRepo.findPublishedReceivedByUser(userId);
    const summary = summarizeReviews(reviews);
    return {
      userId,
      trustScore: user.trustScore,
      trustGrade: TrustService.calculateTrustGrade(user.trustScore),
      ...summary,
      confidence:
        reviews.length >= 10 ? "high" : reviews.length >= 3 ? "medium" : "low",
      roles: {
        organizer: summarizeReviews(
          reviews.filter((review) => review.revieweeRole === "organizer")
        ),
        participant: summarizeReviews(
          reviews.filter((review) => review.revieweeRole === "participant")
        ),
      },
    };
  },
};
