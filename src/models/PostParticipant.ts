// src/models/PostParticipant.ts

import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";
import PostModel from "./Post";
import UserModel from "./User";
import {
  PARTICIPANT_STATUSES,
  ParticipantStatus,
} from "../types/participant-status";

// ----------------------------
// TypeScript 타입 정의
// ----------------------------

/**
 * DB 컬럼 기반 attributes
 * 실제 post_participants 테이블의 컬럼 스키마를 TypeScript로 옮겨온 타입
 * Post와 User의 N:M 관계를 위한 중간 테이블
 */
export interface PostParticipantAttributes {
  id: string;
  postId: string; // posts.id와 외래키 관계
  userId: string; // users.id와 외래키 관계
  participantStatus: ParticipantStatus; // 참여자별 진행 상태
  receivedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Create 시 필요한 값(자동 생성되는 id 제거)
 */
export type PostParticipantCreationAttributes = Optional<
  PostParticipantAttributes,
  "id" | "participantStatus" | "receivedAt" | "createdAt" | "updatedAt"
>;

/**
 * Sequelize 모델 타입 선언
 */
export class PostParticipantModel
  extends Model<PostParticipantAttributes, PostParticipantCreationAttributes>
  implements PostParticipantAttributes
{
  public id!: string;
  public postId!: string;
  public userId!: string;
  public participantStatus!: ParticipantStatus;
  public receivedAt!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// ----------------------------
// Sequelize 모델 초기화
// ----------------------------
PostParticipantModel.init(
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
      references: {
        model: PostModel,
        key: "id",
      },
      onDelete: "CASCADE", // Post 삭제 시 참여자 정보도 삭제
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "user_id",
      references: {
        model: UserModel,
        key: "id",
      },
      onDelete: "CASCADE", // User 삭제 시 참여자 정보도 삭제
    },
    participantStatus: {
      type: DataTypes.ENUM(...PARTICIPANT_STATUSES),
      allowNull: false,
      defaultValue: "participating",
      field: "participant_status",
    },
    receivedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "received_at",
    },
  },
  {
    sequelize,
    tableName: "post_participants",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["post_id", "user_id"], // 같은 사용자가 같은 게시글에 중복 참여 방지
      },
      {
        fields: ["participant_status", "received_at"],
      },
    ],
  }
);

// ----------------------------
// 관계 설정 (Associations)
// ----------------------------
PostParticipantModel.belongsTo(PostModel, {
  foreignKey: "postId",
  as: "post",
});

PostParticipantModel.belongsTo(UserModel, {
  foreignKey: "userId",
  as: "user",
});

PostModel.belongsToMany(UserModel, {
  through: PostParticipantModel,
  foreignKey: "postId",
  otherKey: "userId",
  as: "participants", // PostModel.participants로 접근 가능
});

UserModel.belongsToMany(PostModel, {
  through: PostParticipantModel,
  foreignKey: "userId",
  otherKey: "postId",
  as: "participatedPosts", // UserModel.participatedPosts로 접근 가능
});

export default PostParticipantModel;
