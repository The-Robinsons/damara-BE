import { Op, Transaction } from "sequelize";
import TradeReviewModel, {
  TradeReviewCreationAttributes,
} from "../models/TradeReview";

export const TradeReviewRepo = {
  async create(data: TradeReviewCreationAttributes, transaction?: Transaction) {
    const review = await TradeReviewModel.create(data, { transaction });
    return review.get({ plain: true });
  },

  async findById(id: string) {
    return await TradeReviewModel.findByPk(id);
  },

  async findPair(postId: string, reviewerId: string, revieweeId: string) {
    return await TradeReviewModel.findOne({
      where: { postId, reviewerId, revieweeId },
    });
  },

  async findReciprocal(postId: string, reviewerId: string, revieweeId: string) {
    return await TradeReviewModel.findOne({
      where: {
        postId,
        reviewerId: revieweeId,
        revieweeId: reviewerId,
        status: "pending",
      },
    });
  },

  async findExpiredPending(now = new Date()) {
    return await TradeReviewModel.findAll({
      where: { status: "pending", expiresAt: { [Op.lte]: now } },
    });
  },

  async findByPost(postId: string) {
    return await TradeReviewModel.findAll({ where: { postId } });
  },

  async findPublishedReceivedByUser(revieweeId: string) {
    return await TradeReviewModel.findAll({
      where: { revieweeId, status: "published" },
      order: [["publishedAt", "DESC"]],
    });
  },

  async findPublishedUnappliedParticipantReviews() {
    return await TradeReviewModel.findAll({
      where: {
        status: "published",
        revieweeRole: "participant",
        scoreAppliedAt: null,
      },
    });
  },
};
