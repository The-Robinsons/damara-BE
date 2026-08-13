// src/models/UserModel.ts

import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";

/**
 * Sequelize 인스턴스는 src/db에서 중앙 관리됩니다.
 */

// ----------------------------
// TypeScript 타입 정의
// ----------------------------

// DB 컬럼 기반 attributes
// 실제 users 테이블의 컬럼 스키마를 TypeScript로 옮겨온 타입
export interface UserAttributes {
  id: string;
  email: string;
  passwordHash: string;
  nickname: string;
  department: string | null;
  studentId: string; // 필수 필드로 변경
  avatarUrl: string | null;
  trustScore: number; // 내부 신뢰점수 (기본값: 50, 최소: 0, 최대: 100)
  createdAt?: Date;
  updatedAt?: Date;
}

// Create 시 필요한 값(자동 생성되는 id 제거)
// Optional<T, K>를 이용해 생성 시 선택 입력 필드를 지정한다.
export type UserCreationAttributes = Optional<
  UserAttributes,
  "id" | "department" | "avatarUrl" | "trustScore" | "createdAt" | "updatedAt"
>; // studentId는 필수이므로 Optional에서 제거, trustScore는 기본 내부 점수로 설정

// Sequelize 모델 타입 선언
// Model<Attributes, CreationAttributes>를 상속하면
// UserModel.create(...) 같은 ORM 메서드에서 타입 안전성을 확보할 수 있다.
export class UserModel
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  public id!: string;
  public email!: string;
  public passwordHash!: string;
  public nickname!: string;
  public department!: string | null;
  public studentId!: string; // 필수 필드로 변경
  public avatarUrl!: string | null;
  public trustScore!: number; // 내부 신뢰점수

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// ----------------------------
// Sequelize 모델 초기화
// init 메서드로 실제 테이블 컬럼 정의 + 옵션을 설정한다.
// ----------------------------
UserModel.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },

    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "password_hash", // actual DB column name
    },

    nickname: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },

    department: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    studentId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true, // 학번은 unique해야 함
      field: "student_id",
    },

    avatarUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "avatar_url",
    },

    trustScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 50,
      field: "trust_score",
      validate: {
        min: 0,
        max: 100,
      },
    },
  },

  {
    sequelize,
    tableName: "users",
    timestamps: true, // createdAt, updatedAt 자동 관리
    underscored: true, // created_at / updated_at 자동 snake_case
  }
);

export default UserModel;
