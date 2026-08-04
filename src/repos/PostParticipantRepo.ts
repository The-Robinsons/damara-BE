// src/repos/PostParticipantRepo.ts

import PostParticipantModel, {
  PostParticipantCreationAttributes,
} from "../models/PostParticipant";
import PostModel from "../models/Post";
import PostImageModel from "../models/PostImage";
import UserModel from "../models/User";
import { RouteError } from "../common/util/route-errors";
import HttpStatusCodes from "../common/constants/HttpStatusCodes";
import { ParticipantStatus } from "../types/participant-status";
import { buildPostListWhere } from "./PostRepo";
import { PostListOptions } from "../types/post-list";

export const PostParticipantRepo = {
  /**
   * 공동구매 참여
   * - 중복 참여 방지 (unique 제약)
   */
  async create(data: PostParticipantCreationAttributes) {
    try {
      // Post 존재 확인
      const post = await PostModel.findByPk(data.postId);
      if (!post) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, "POST_NOT_FOUND");
      }

      // User 존재 확인
      const user = await UserModel.findByPk(data.userId);
      if (!user) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, "USER_NOT_FOUND");
      }

      // 작성자는 참여할 수 없음
      if (post.authorId === data.userId) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "OWNER_CANNOT_PARTICIPATE"
        );
      }

      // 이미 마감되었거나 취소된 게시글은 참여 불가
      if (post.status !== "open") {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "POST_CLOSED");
      }

      const participant = await PostParticipantModel.create(data);
      return participant.get();
    } catch (e: unknown) {
      // 이미 참여한 경우
      if (e instanceof Error && e.name === "SequelizeUniqueConstraintError") {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "ALREADY_PARTICIPATED"
        );
      }
      throw e;
    }
  },

  /**
   * 참여 취소
   */
  async delete(postId: string, userId: string) {
    const deleted = await PostParticipantModel.destroy({
      where: { postId, userId },
    });
    if (deleted === 0) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "PARTICIPANT_NOT_FOUND");
    }
  },

  /**
   * 게시글의 참여자 목록 조회
   */
  async findByPostId(
    postId: string,
    options: { limit?: number; offset?: number } = {}
  ) {
    const queryOptions: any = {
      where: { postId },
      include: [
        {
          model: UserModel,
          as: "user",
          attributes: [
            "id",
            "nickname",
            "studentId",
            "department",
            "avatarUrl",
            "trustScore",
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
    };

    if (options.limit !== undefined) {
      queryOptions.limit = options.limit;
      queryOptions.offset = options.offset ?? 0;
    }

    const participants = await PostParticipantModel.findAll(queryOptions);

    return participants.map((p) => p.get({ plain: true }));
  },

  /**
   * 상세 화면용 참여자 목록 조회 (참여자 공개 프로필 포함)
   */
  async findProfilesByPostId(postId: string) {
    const participants = await PostParticipantModel.findAll({
      where: { postId },
      include: [
        {
          model: UserModel,
          as: "user",
          attributes: [
            "id",
            "nickname",
            "studentId",
            "department",
            "avatarUrl",
            "trustScore",
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    return participants.map((p) => p.get({ plain: true }));
  },

  /**
   * 사용자가 참여한 게시글 목록 조회
   */
  async findByUserId(userId: string) {
    const participants = await PostParticipantModel.findAll({
      where: { userId },
      include: [
        {
          model: PostModel,
          as: "post",
          attributes: [
            "id",
            "title",
            "price",
            "minParticipants",
            "status",
            "deadline",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return participants.map((p) => p.get());
  },

  /**
   * 내 공구 참여 탭 목록 조회
   */
  async findMyPostsByUserId(
    userId: string,
    options: PostListOptions & { participantStatus?: ParticipantStatus | null } = {}
  ) {
    const {
      limit = 20,
      offset = 0,
      sort = "latest",
      participantStatus,
    } = options;
    const participantWhere: Record<string, unknown> = { userId };

    if (participantStatus) {
      participantWhere.participantStatus = participantStatus;
    }

    const order =
      sort === "deadline"
        ? [[{ model: PostModel, as: "post" }, "deadline", "ASC"]]
        : [["createdAt", "DESC"]];

    const queryOptions: any = {
      where: participantWhere,
      include: [
        {
          model: PostModel,
          as: "post",
          required: true,
          where: buildPostListWhere(options),
          include: [
            {
              model: PostImageModel,
              as: "images",
              attributes: ["id", "imageUrl", "sortOrder"],
              order: [["sortOrder", "ASC"]],
            },
          ],
        },
      ],
      order: order as any,
    };

    if (sort !== "popular") {
      queryOptions.limit = limit;
      queryOptions.offset = offset;
    }

    const participants = await PostParticipantModel.findAll(queryOptions);

    return participants.map((participant) =>
      participant.get({ plain: true })
    );
  },

  /**
   * 내 공구 참여 탭 목록 개수 조회
   */
  async countMyPostsByUserId(
    userId: string,
    options: PostListOptions & { participantStatus?: ParticipantStatus | null } = {}
  ) {
    const { participantStatus } = options;
    const participantWhere: Record<string, unknown> = { userId };

    if (participantStatus) {
      participantWhere.participantStatus = participantStatus;
    }

    return await PostParticipantModel.count({
      where: participantWhere,
      include: [
        {
          model: PostModel,
          as: "post",
          required: true,
          where: buildPostListWhere(options),
        },
      ],
    });
  },

  /**
   * 사용자별 참여 상태 카운트 조회
   */
  async countByUserIdAndStatus(
    userId: string,
    participantStatus: ParticipantStatus
  ) {
    return await PostParticipantModel.count({
      where: { userId, participantStatus },
    });
  },

  /**
   * 사용자별 전체 참여 공구 수 조회
   */
  async countByUserId(userId: string) {
    return await PostParticipantModel.count({
      where: { userId },
    });
  },

  /**
   * 참여자별 진행 상태 변경
   */
  async updateStatus(
    postId: string,
    userId: string,
    participantStatus: ParticipantStatus
  ) {
    const participant = await PostParticipantModel.findOne({
      where: { postId, userId },
      include: [
        {
          model: UserModel,
          as: "user",
          attributes: ["id", "nickname", "studentId", "avatarUrl"],
        },
      ],
    });

    if (!participant) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "PARTICIPANT_NOT_FOUND");
    }

    participant.participantStatus = participantStatus;
    if (participantStatus === "received" && !participant.receivedAt) {
      participant.receivedAt = new Date();
    }
    await participant.save();

    return participant.get({ plain: true });
  },

  /**
   * 게시글의 참여자 수 조회
   */
  async countByPostId(postId: string) {
    return await PostParticipantModel.count({
      where: { postId },
    });
  },

  async findByPostAndUser(postId: string, userId: string) {
    const participant = await PostParticipantModel.findOne({
      where: { postId, userId },
    });
    return participant ? participant.get({ plain: true }) : null;
  },

  async countByPostIdAndStatus(
    postId: string,
    participantStatus: ParticipantStatus
  ) {
    return await PostParticipantModel.count({
      where: { postId, participantStatus },
    });
  },

  /**
   * 사용자가 특정 게시글에 참여했는지 확인
   */
  async isParticipant(postId: string, userId: string) {
    const participant = await PostParticipantModel.findOne({
      where: { postId, userId },
    });
    return participant !== null;
  },
};
