import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";
import PostModel from "./Post";
import UserModel from "./User";
import {
  REVIEW_POLICY_VERSION,
  REVIEW_RATINGS,
  REVIEW_ROLES,
  REVIEW_STATUSES,
  ReviewRating,
  ReviewRole,
  ReviewStatus,
} from "../types/trade-review";

export interface TradeReviewAttributes {
  id: string;
  postId: string;
  reviewerId: string;
  revieweeId: string;
  reviewerRole: ReviewRole;
  revieweeRole: ReviewRole;
  rating: ReviewRating;
  tags: string[];
  status: ReviewStatus;
  submittedAt: Date;
  publishedAt: Date | null;
  expiresAt: Date;
  scoreAppliedAt: Date | null;
  policyVersion: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TradeReviewCreationAttributes = Optional<
  TradeReviewAttributes,
  | "id"
  | "tags"
  | "status"
  | "submittedAt"
  | "publishedAt"
  | "scoreAppliedAt"
  | "policyVersion"
  | "createdAt"
  | "updatedAt"
>;

export class TradeReviewModel
  extends Model<TradeReviewAttributes, TradeReviewCreationAttributes>
  implements TradeReviewAttributes
{
  public id!: string;
  public postId!: string;
  public reviewerId!: string;
  public revieweeId!: string;
  public reviewerRole!: ReviewRole;
  public revieweeRole!: ReviewRole;
  public rating!: ReviewRating;
  public tags!: string[];
  public status!: ReviewStatus;
  public submittedAt!: Date;
  public publishedAt!: Date | null;
  public expiresAt!: Date;
  public scoreAppliedAt!: Date | null;
  public policyVersion!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

TradeReviewModel.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    postId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "post_id",
      references: { model: PostModel, key: "id" },
      onDelete: "CASCADE",
    },
    reviewerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "reviewer_id",
      references: { model: UserModel, key: "id" },
      onDelete: "CASCADE",
    },
    revieweeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "reviewee_id",
      references: { model: UserModel, key: "id" },
      onDelete: "CASCADE",
    },
    reviewerRole: {
      type: DataTypes.ENUM(...REVIEW_ROLES),
      allowNull: false,
      field: "reviewer_role",
    },
    revieweeRole: {
      type: DataTypes.ENUM(...REVIEW_ROLES),
      allowNull: false,
      field: "reviewee_role",
    },
    rating: {
      type: DataTypes.ENUM(...REVIEW_RATINGS),
      allowNull: false,
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    status: {
      type: DataTypes.ENUM(...REVIEW_STATUSES),
      allowNull: false,
      defaultValue: "pending",
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "submitted_at",
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "published_at",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expires_at",
    },
    scoreAppliedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "score_applied_at",
    },
    policyVersion: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: REVIEW_POLICY_VERSION,
      field: "policy_version",
    },
  },
  {
    sequelize,
    tableName: "trade_reviews",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["post_id", "reviewer_id", "reviewee_id"],
      },
      { fields: ["reviewee_id", "status", "published_at"] },
      { fields: ["reviewer_id", "status", "expires_at"] },
      { fields: ["post_id", "reviewee_role", "status"] },
    ],
  }
);

PostModel.hasMany(TradeReviewModel, {
  foreignKey: "postId",
  as: "tradeReviews",
});
TradeReviewModel.belongsTo(PostModel, { foreignKey: "postId", as: "post" });
UserModel.hasMany(TradeReviewModel, {
  foreignKey: "reviewerId",
  as: "writtenTradeReviews",
});
UserModel.hasMany(TradeReviewModel, {
  foreignKey: "revieweeId",
  as: "receivedTradeReviews",
});
TradeReviewModel.belongsTo(UserModel, {
  foreignKey: "reviewerId",
  as: "reviewer",
});
TradeReviewModel.belongsTo(UserModel, {
  foreignKey: "revieweeId",
  as: "reviewee",
});

export default TradeReviewModel;
