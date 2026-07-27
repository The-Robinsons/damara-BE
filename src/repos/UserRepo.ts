// src/repos/UserRepo.ts (Sequelize 버전)
import { UserModel } from "../models/User";

import { UserCreationAttributes } from "../models/User";
import {
  EmailAlreadyExistsError,
  StudentIdAlreadyExistsError,
} from "../common/util/route-errors";
import { Transaction } from "sequelize";

export const UserRepo = {
  /**
   * 사용자 생성
   */
  async create(data: UserCreationAttributes, transaction?: Transaction) {
    try {
      // trustScore가 제공되지 않으면 기본 내부 점수 50으로 설정
      const userData = {
        ...data,
        trustScore: data.trustScore ?? 50,
      };
      const user = await UserModel.create(userData, { transaction });
      return user.get(); // plain object로 변환
    } catch (e: unknown) {
      // Sequelize 고유 에러 코드: unique constraint
      if (e instanceof Error && e.name === "SequelizeUniqueConstraintError") {
        // 에러 메시지에서 어떤 필드가 중복인지 확인
        const errorMessage = e instanceof Error ? e.message : String(e);
        if (
          errorMessage.includes("student_id") ||
          errorMessage.includes("studentId")
        ) {
          throw new StudentIdAlreadyExistsError();
        }
        // 기본적으로는 이메일 중복으로 처리
        throw new EmailAlreadyExistsError();
      }
      throw e;
    }
  },

  /**
   * 이메일 기반 조회
   */
  async findByEmail(email: string) {
    const user = await UserModel.findOne({
      where: { email },
    });
    return user ? user.get() : null;
  },

  /**
   * 학번 기반 조회
   */
  async findByStudentId(studentId: string) {
    const user = await UserModel.findOne({
      where: { studentId },
    });
    return user ? user.get() : null;
  },

  /**
   * ID 기반 조회
   */
  async findById(id: string) {
    const user = await UserModel.findByPk(id);
    return user ? user.get() : null;
  },

  /**
   * 부분 업데이트
   */
  async update(id: string, patch: Partial<UserCreationAttributes>) {
    const user = await UserModel.findByPk(id);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    await user.update(patch);

    return user.get();
  },

  /**
   * 삭제
   */
  async delete(id: string) {
    await UserModel.destroy({ where: { id } });
  },

  /**
   * 전체 조회 + pagination
   */
  async list(limit = 20, offset = 0) {
    const users = await UserModel.findAll({
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return users.map((u) => u.get());
  },
};
