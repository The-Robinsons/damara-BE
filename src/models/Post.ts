// src/models/Post.ts

import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";
import UserModel from "./User";
import { GroupBuyMode, GroupBuyType } from "../types/group-buy";
import { PickupType } from "../types/pickup-zone";

// ----------------------------
// TypeScript 타입 정의
// ----------------------------

/**
 * DB 컬럼 기반 attributes
 * 실제 posts 테이블의 컬럼 스키마를 TypeScript로 옮겨온 타입
 */
export interface PostAttributes {
  id: string;
  authorId: string; // users.id와 외래키 관계
  title: string;
  productName: string | null;
  content: string;
  price: number;
  minParticipants: number; // 최소 인원 수
  currentQuantity: number;
  status: "open" | "closed" | "in_progress" | "completed" | "cancelled";
  deadline: Date;
  pickupType: PickupType;
  pickupZoneId: string | null;
  pickupLocation: string | null;
  pickupDate: string | null;
  pickupStartTime: string | null;
  pickupEndTime: string | null;
  pickupGuide: string | null;
  groupBuyType: GroupBuyType | null;
  groupBuyMode: GroupBuyMode;
  targetParticipants: number | null;
  targetPrice: number | null;
  tags: string[] | null;
  notice: string | null;
  category: string | null; // 카테고리 ID (food, daily, beauty, electronics, school, freemarket)
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Create 시 필요한 값(자동 생성되는 id 제거)
 * Optional<T, K>를 이용해 생성 시 선택 입력 필드를 지정한다.
 */
export type PostCreationAttributes = Optional<
  PostAttributes,
  | "id"
  | "productName"
  // | "minParticipants"
  | "currentQuantity"
  | "status"
  // | "pickupLocation"
  | "pickupType"
  | "pickupZoneId"
  | "pickupDate"
  | "pickupStartTime"
  | "pickupEndTime"
  | "pickupGuide"
  | "groupBuyType"
  | "groupBuyMode"
  | "targetParticipants"
  | "targetPrice"
  | "tags"
  | "notice"
  | "createdAt"
  | "updatedAt"
>;

/**
 * Sequelize 모델 타입 선언
 * Model<Attributes, CreationAttributes>를 상속하면
 * PostModel.create(...) 같은 ORM 메서드에서 타입 안전성을 확보할 수 있다.
 */
export class PostModel
  extends Model<PostAttributes, PostCreationAttributes>
  implements PostAttributes
{
  public id!: string;
  public authorId!: string;
  public title!: string;
  public productName!: string | null;
  public content!: string;
  public price!: number;
  public minParticipants!: number;
  public currentQuantity!: number;
  public status!: "open" | "closed" | "in_progress" | "completed" | "cancelled";
  public deadline!: Date;
  public pickupType!: PickupType;
  public pickupZoneId!: string | null;
  public pickupLocation!: string | null;
  public pickupDate!: string | null;
  public pickupStartTime!: string | null;
  public pickupEndTime!: string | null;
  public pickupGuide!: string | null;
  public groupBuyType!: GroupBuyType | null;
  public groupBuyMode!: GroupBuyMode;
  public targetParticipants!: number | null;
  public targetPrice!: number | null;
  public tags!: string[] | null;
  public notice!: string | null;
  public category!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// ----------------------------
// Sequelize 모델 초기화
// init 메서드로 실제 테이블 컬럼 정의 + 옵션을 설정한다.
// ----------------------------
PostModel.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    authorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "author_id",
      references: {
        model: UserModel,
        key: "id",
      },
    },

    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },

    productName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      defaultValue: null,
      field: "product_name",
    },

    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    minParticipants: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: "min_participants",
    },

    currentQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "current_quantity",
    },

    status: {
      type: DataTypes.ENUM(
        "open",
        "closed",
        "in_progress",
        "completed",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "open",
    },

    deadline: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    pickupType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "custom",
      field: "pickup_type",
    },

    pickupZoneId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
      field: "pickup_zone_id",
    },

    pickupLocation: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "pickup_location",
    },

    pickupDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      defaultValue: null,
      field: "pickup_date",
    },

    pickupStartTime: {
      type: DataTypes.TIME,
      allowNull: true,
      defaultValue: null,
      field: "pickup_start_time",
    },

    pickupEndTime: {
      type: DataTypes.TIME,
      allowNull: true,
      defaultValue: null,
      field: "pickup_end_time",
    },

    pickupGuide: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
      field: "pickup_guide",
    },

    groupBuyType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
      field: "group_buy_type",
    },

    groupBuyMode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "normal",
      field: "group_buy_mode",
    },

    targetParticipants: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: "target_participants",
    },

    targetPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      field: "target_price",
    },

    tags: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },

    notice: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },

    category: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
      // 카테고리: food, daily, beauty, electronics, school, freemarket
    },
  },

  {
    sequelize,
    tableName: "posts",
    timestamps: true, // createdAt, updatedAt 자동 관리
    underscored: true, // created_at / updated_at 자동 snake_case
  }
);

// ----------------------------2
// 관계 설정 (Associations)
// User와 Post의 1:N 관계 설정
// ----------------------------
UserModel.hasMany(PostModel, {
  foreignKey: "authorId",
  as: "posts", // UserModel.posts로 접근 가능
});

PostModel.belongsTo(UserModel, {
  foreignKey: "authorId",
  as: "author", // PostModel.author로 접근 가능
});

export default PostModel;
