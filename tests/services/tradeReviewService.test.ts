import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  postModel,
  participantModel,
  tradeReviewModel,
  userModel,
  tradeReviewRepo,
  trustService,
} = vi.hoisted(() => ({
  postModel: {
    findByPk: vi.fn(),
    findAll: vi.fn(),
  },
  participantModel: {
    findOne: vi.fn(),
    findAll: vi.fn(),
  },
  tradeReviewModel: {
    create: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
  },
  userModel: {
    findByPk: vi.fn(),
  },
  tradeReviewRepo: {
    findExpiredPending: vi.fn(),
    findPublishedUnappliedParticipantReviews: vi.fn(),
    findPair: vi.fn(),
    findReciprocal: vi.fn(),
    findById: vi.fn(),
    findPublishedReceivedByUser: vi.fn(),
  },
  trustService: {
    recordParticipantReview: vi.fn(),
    recordAuthorReviewAggregate: vi.fn(),
    calculateTrustGrade: vi.fn(),
  },
}));

vi.mock("../../src/models/Post", () => ({ default: postModel }));
vi.mock("../../src/models/PostParticipant", () => ({
  default: participantModel,
}));
vi.mock("../../src/models/TradeReview", () => ({
  default: tradeReviewModel,
}));
vi.mock("../../src/models/User", () => ({ default: userModel }));
vi.mock("../../src/repos/TradeReviewRepo", () => ({
  TradeReviewRepo: tradeReviewRepo,
}));
vi.mock("../../src/services/TrustService", () => ({
  TrustService: trustService,
}));

import { TradeReviewService } from "../../src/services/TradeReviewService";

function reviewFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "review-1",
    postId: "post-1",
    reviewerId: "participant-1",
    revieweeId: "author-1",
    reviewerRole: "participant",
    revieweeRole: "organizer",
    rating: "positive",
    tags: ["ON_TIME"],
    status: "pending",
    submittedAt: new Date(),
    publishedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    scoreAppliedAt: null,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("TradeReviewService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tradeReviewRepo.findExpiredPending.mockResolvedValue([]);
    tradeReviewRepo.findPublishedUnappliedParticipantReviews.mockResolvedValue(
      []
    );
    participantModel.findAll.mockResolvedValue([]);
  });

  it("creates a blind pending review with roles derived from the trade", async () => {
    const receivedAt = new Date();
    const created = reviewFixture();
    postModel.findByPk.mockResolvedValue({
      id: "post-1",
      authorId: "author-1",
      status: "completed",
    });
    participantModel.findOne.mockResolvedValue({ receivedAt });
    tradeReviewRepo.findPair.mockResolvedValue(null);
    tradeReviewRepo.findReciprocal.mockResolvedValue(null);
    tradeReviewModel.create.mockResolvedValue(created);

    await expect(
      TradeReviewService.createReview("post-1", "participant-1", {
        revieweeId: "author-1",
        rating: "positive",
        tags: ["ON_TIME"],
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: "review-1",
        reviewerRole: "participant",
        revieweeRole: "organizer",
        status: "pending",
      })
    );

    expect(tradeReviewModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewerRole: "participant",
        revieweeRole: "organizer",
        policyVersion: "trust-v2",
      })
    );
    expect(trustService.recordAuthorReviewAggregate).not.toHaveBeenCalled();
  });

  it("publishes reciprocal reviews and applies both role score rules", async () => {
    const receivedAt = new Date();
    const participantReview = reviewFixture();
    const organizerReview = reviewFixture({
      id: "review-2",
      reviewerId: "author-1",
      revieweeId: "participant-1",
      reviewerRole: "organizer",
      revieweeRole: "participant",
      rating: "positive",
      tags: ["PAYMENT_ON_TIME"],
    });

    postModel.findByPk
      .mockResolvedValueOnce({
        id: "post-1",
        authorId: "author-1",
        status: "completed",
      })
      .mockResolvedValueOnce({
        id: "post-1",
        authorId: "author-1",
        status: "completed",
      });
    participantModel.findOne.mockResolvedValue({ receivedAt });
    participantModel.findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { userId: "participant-1", receivedAt },
      ]);
    tradeReviewRepo.findPair.mockResolvedValue(null);
    tradeReviewRepo.findReciprocal.mockResolvedValue(organizerReview);
    tradeReviewModel.create.mockResolvedValue(participantReview);
    tradeReviewModel.findAll.mockResolvedValue([participantReview]);
    tradeReviewModel.update.mockResolvedValue([1]);

    const result = await TradeReviewService.createReview(
      "post-1",
      "participant-1",
      {
        revieweeId: "author-1",
        rating: "positive",
        tags: ["ON_TIME"],
      }
    );

    expect(result.status).toBe("published");
    expect(organizerReview.status).toBe("published");
    expect(trustService.recordParticipantReview).toHaveBeenCalledWith(
      "review-2",
      "post-1",
      "participant-1",
      "author-1",
      1
    );
    expect(trustService.recordAuthorReviewAggregate).toHaveBeenCalledWith(
      "post-1",
      "author-1",
      1,
      expect.objectContaining({ reviewCount: 1 })
    );
  });

  it("does not expose review eligibility before post completion", async () => {
    postModel.findByPk.mockResolvedValue({
      id: "post-1",
      authorId: "author-1",
      status: "in_progress",
    });

    await expect(
      TradeReviewService.getEligibility("post-1", "author-1")
    ).rejects.toMatchObject({ message: "REVIEW_NOT_AVAILABLE" });
  });

  it("returns public review statistics separated by trade role", async () => {
    userModel.findByPk.mockResolvedValue({ id: "user-1", trustScore: 60 });
    trustService.calculateTrustGrade.mockReturnValue(3.7);
    tradeReviewRepo.findPublishedReceivedByUser.mockResolvedValue([
      reviewFixture({ revieweeRole: "organizer", rating: "positive" }),
      reviewFixture({
        id: "review-2",
        revieweeRole: "organizer",
        rating: "negative",
        tags: ["LATE_FOR_PICKUP"],
      }),
      reviewFixture({
        id: "review-3",
        revieweeRole: "participant",
        rating: "positive",
        tags: ["PAYMENT_ON_TIME"],
      }),
    ]);

    const summary = await TradeReviewService.getReviewSummary("user-1");

    expect(summary).toMatchObject({
      reviewCount: 3,
      roles: {
        organizer: { reviewCount: 2 },
        participant: { reviewCount: 1 },
      },
    });
  });
});
