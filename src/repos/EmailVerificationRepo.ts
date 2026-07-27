import { Op, Transaction } from "sequelize";
import EmailVerificationModel, {
  EmailVerificationCreationAttributes,
} from "../models/EmailVerification";

export const EmailVerificationRepo = {
  async create(data: EmailVerificationCreationAttributes) {
    return await EmailVerificationModel.create(data);
  },

  async invalidateActive(email: string, invalidatedAt: Date) {
    await EmailVerificationModel.update(
      { invalidatedAt },
      {
        where: {
          email,
          purpose: "signup",
          consumedAt: null,
          invalidatedAt: null,
        },
      }
    );
  },

  async findLatest(email: string) {
    return await EmailVerificationModel.findOne({
      where: { email, purpose: "signup", invalidatedAt: null },
      order: [["createdAt", "DESC"]],
    });
  },

  async countSinceByEmail(email: string, since: Date) {
    return await EmailVerificationModel.count({
      where: { email, createdAt: { [Op.gte]: since } },
    });
  },

  async countSinceByIp(requestIpHash: string, since: Date) {
    return await EmailVerificationModel.count({
      where: { requestIpHash, createdAt: { [Op.gte]: since } },
    });
  },

  async findLatestCreatedAt(email: string) {
    const verification = await EmailVerificationModel.findOne({
      where: { email },
      attributes: ["createdAt"],
      order: [["createdAt", "DESC"]],
    });
    return verification?.createdAt ?? null;
  },

  async findByTokenHashForUpdate(tokenHash: string, transaction: Transaction) {
    return await EmailVerificationModel.findOne({
      where: { tokenHash, purpose: "signup" },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  },
};
