import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";

export interface EmailVerificationAttributes {
  id: string;
  email: string;
  purpose: "signup";
  codeHash: string;
  tokenHash: string | null;
  attemptCount: number;
  maxAttempts: number;
  expiresAt: Date;
  verifiedAt: Date | null;
  tokenExpiresAt: Date | null;
  consumedAt: Date | null;
  invalidatedAt: Date | null;
  requestIpHash: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type EmailVerificationCreationAttributes = Optional<
  EmailVerificationAttributes,
  | "id"
  | "purpose"
  | "tokenHash"
  | "attemptCount"
  | "verifiedAt"
  | "tokenExpiresAt"
  | "consumedAt"
  | "invalidatedAt"
  | "requestIpHash"
  | "createdAt"
  | "updatedAt"
>;

export class EmailVerificationModel
  extends Model<
    EmailVerificationAttributes,
    EmailVerificationCreationAttributes
  >
  implements EmailVerificationAttributes
{
  public id!: string;
  public email!: string;
  public purpose!: "signup";
  public codeHash!: string;
  public tokenHash!: string | null;
  public attemptCount!: number;
  public maxAttempts!: number;
  public expiresAt!: Date;
  public verifiedAt!: Date | null;
  public tokenExpiresAt!: Date | null;
  public consumedAt!: Date | null;
  public invalidatedAt!: Date | null;
  public requestIpHash!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EmailVerificationModel.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    purpose: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "signup",
    },
    codeHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "code_hash",
    },
    tokenHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      field: "token_hash",
    },
    attemptCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "attempt_count",
    },
    maxAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      field: "max_attempts",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expires_at",
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "verified_at",
    },
    tokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "token_expires_at",
    },
    consumedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "consumed_at",
    },
    invalidatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "invalidated_at",
    },
    requestIpHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "request_ip_hash",
    },
  },
  {
    sequelize,
    tableName: "email_verifications",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["email", "purpose", "created_at"] },
      { fields: ["expires_at"] },
      { fields: ["request_ip_hash", "created_at"] },
    ],
  }
);

export default EmailVerificationModel;
