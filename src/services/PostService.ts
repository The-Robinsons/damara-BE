// src/services/PostService.ts

import { PostRepo } from "../repos/PostRepo";
import { PostCreationAttributes } from "../models/Post";
import { RouteError } from "../common/util/route-errors";
import HttpStatusCodes from "../common/constants/HttpStatusCodes";
import UserModel from "../models/User";
import { PostParticipantRepo } from "../repos/PostParticipantRepo";
import PostModel from "../models/Post";
import { FavoriteService } from "./FavoriteService";
import { NotificationService } from "./NotificationService";
import { TRUST_POLICY, TrustService } from "./TrustService";
import { PostExceptionService } from "./PostExceptionService";
import { PostExceptionRepo } from "../repos/PostExceptionRepo";
import { PostListOptions } from "../types/post-list";
import {
  ParticipantStatus,
  PARTICIPANT_STATUS_LABELS,
  canTransitionParticipantStatus,
} from "../types/participant-status";
import { GroupBuyMode, GroupBuyType } from "../types/group-buy";
import {
  findDamaraPickupZoneById,
  PickupType,
  PickupZone,
} from "../types/pickup-zone";

type PostListItem = Awaited<ReturnType<typeof PostRepo.list>>[number];

function getCancellationReferenceAt(post: {
  pickupDate: string | null;
  pickupStartTime: string | null;
  deadline: Date;
}) {
  if (post.pickupDate && post.pickupStartTime) {
    const pickupAt = new Date(
      `${post.pickupDate}T${post.pickupStartTime}+09:00`
    );
    if (!Number.isNaN(pickupAt.getTime())) return pickupAt;
  }
  return new Date(post.deadline);
}

async function getAuthorCancellationScore(postId: string) {
  const participants = await PostParticipantRepo.findByPostId(postId);
  if (participants.length === 0) return 0;

  const hasPickupReady = participants.some(
    (participant) =>
      participant.participantStatus === "pickup_ready" ||
      participant.participantStatus === "received"
  );
  return hasPickupReady
    ? TRUST_POLICY.AUTHOR_CANCELLED_POST_PAYMENT
    : TRUST_POLICY.AUTHOR_CANCELLED_PRE_PAYMENT;
}
type EnrichedPostListItem = PostListItem & {
  favoriteCount: number;
  isFavorite: boolean;
  isParticipant: boolean;
  isOwner: boolean;
  thumbnailUrl: string | null;
  exceptionSummary: Awaited<
    ReturnType<typeof PostExceptionService.getExceptionSummary>
  >;
  currentPrice: number;
  participantsToUnlock: number | null;
  priceUnlocked: boolean;
  dealMessage: string | null;
  pickupZone: PickupZone | null;
  deadlineStatus: "open" | "closingSoon" | "closed";
  deadlineLabel: string;
  remainingSeconds: number;
};
type PostListResponse = {
  items: EnrichedPostListItem[];
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
};
type PostImageSource = {
  id?: string;
  imageUrl?: string;
  sortOrder?: number;
};
type PublicUserProfileSource = {
  id: string;
  nickname: string;
  studentId: string;
  department: string | null;
  avatarUrl: string | null;
  trustScore: number;
};
type PostDetailSource = Awaited<ReturnType<typeof PostRepo.findDetailById>> & {
  author?: PublicUserProfileSource | null;
};
type PostParticipantProfileSource = Awaited<
  ReturnType<typeof PostParticipantRepo.findProfilesByPostId>
>[number] & {
  user?: PublicUserProfileSource | null;
};
type PostParticipantListSource = Awaited<
  ReturnType<typeof PostParticipantRepo.findByPostId>
>[number] & {
  user?: PublicUserProfileSource | null;
};
type ProductNamedPost = {
  title: string;
  productName?: string | null;
};
type TradeModePost = {
  price: number | string;
  minParticipants?: number | string | null;
  currentQuantity?: number | string | null;
  groupBuyType?: GroupBuyType | string | null;
  groupBuyMode?: GroupBuyMode | string | null;
  targetParticipants?: number | string | null;
  targetPrice?: number | string | null;
};
type PickupModePost = {
  pickupType?: PickupType | string | null;
  pickupZoneId?: string | null;
  pickupLocation?: string | null;
};

const getPostCreatedTime = (post: PostListItem) => {
  if (!post.createdAt) {
    return 0;
  }

  const createdTime = new Date(post.createdAt).getTime();
  return Number.isNaN(createdTime) ? 0 : createdTime;
};

function getSortedImages(post: { images?: PostImageSource[] | null }) {
  const images = Array.isArray(post.images) ? post.images : [];
  return [...images].sort(
    (a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
  );
}

function getThumbnailUrl(post: { images?: PostImageSource[] | null }) {
  return getSortedImages(post)[0]?.imageUrl ?? null;
}

function getDeadlineMeta(deadline: Date | string) {
  const now = new Date();
  const deadlineTime = new Date(deadline).getTime();

  if (Number.isNaN(deadlineTime)) {
    return {
      deadlineStatus: "open" as const,
      deadlineLabel: "모집중",
      remainingSeconds: 0,
    };
  }

  const remainingSeconds = Math.max(
    0,
    Math.floor((deadlineTime - now.getTime()) / 1000)
  );

  if (remainingSeconds <= 0) {
    return {
      deadlineStatus: "closed" as const,
      deadlineLabel: "마감",
      remainingSeconds,
    };
  }

  const closingSoonSeconds = 24 * 60 * 60;
  if (remainingSeconds <= closingSoonSeconds) {
    return {
      deadlineStatus: "closingSoon" as const,
      deadlineLabel: "오늘 마감",
      remainingSeconds,
    };
  }

  return {
    deadlineStatus: "open" as const,
    deadlineLabel: "모집중",
    remainingSeconds,
  };
}

function normalizeGroupBuyType(
  groupBuyType?: GroupBuyType | string | null
): GroupBuyType {
  return groupBuyType === "post_recruit" ? "post_recruit" : "pre_recruit";
}

function normalizeGroupBuyMode(
  groupBuyMode?: GroupBuyMode | string | null
): GroupBuyMode {
  return groupBuyMode === "price_unlock" ? "price_unlock" : "normal";
}

function normalizePickupType(
  pickupType?: PickupType | string | null,
  pickupZoneId?: string | null
): PickupType {
  if (pickupType === "damara_zone") {
    return "damara_zone";
  }

  if (pickupType === "custom") {
    return "custom";
  }

  if (pickupZoneId) {
    return "damara_zone";
  }

  return "custom";
}

function toNullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableInteger(value: number | string | null | undefined) {
  const parsed = toNullableNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function formatPrice(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function getDealMeta(post: TradeModePost) {
  const groupBuyType = normalizeGroupBuyType(post.groupBuyType);
  const groupBuyMode = normalizeGroupBuyMode(post.groupBuyMode);
  const price = toNullableNumber(post.price) ?? 0;
  const currentQuantity = Math.max(
    0,
    toNullableInteger(post.currentQuantity) ?? 0
  );
  const targetParticipants = toNullableInteger(post.targetParticipants);
  const targetPrice = toNullableNumber(post.targetPrice);
  const hasPriceUnlock =
    groupBuyType === "pre_recruit" &&
    groupBuyMode === "price_unlock" &&
    targetParticipants !== null &&
    targetPrice !== null;

  if (!hasPriceUnlock) {
    return {
      groupBuyType,
      groupBuyMode,
      currentPrice: price,
      participantsToUnlock: null,
      priceUnlocked: false,
      dealMessage: null,
    };
  }

  const participantsToUnlock = Math.max(
    0,
    targetParticipants - currentQuantity
  );
  const priceUnlocked = participantsToUnlock === 0;
  const currentPrice = priceUnlocked ? targetPrice : price;
  const dealMessage = priceUnlocked
    ? `목표 달성! 현재 ${formatPrice(targetPrice)}`
    : `${participantsToUnlock}명만 더 모이면 ${formatPrice(targetPrice)}`;

  return {
    groupBuyType,
    groupBuyMode,
    currentPrice,
    participantsToUnlock,
    priceUnlocked,
    dealMessage,
  };
}

function withProductNameFallback<T extends ProductNamedPost>(post: T) {
  return {
    ...post,
    productName: post.productName ?? post.title,
  };
}

function withTradeDealFields<T extends TradeModePost>(post: T) {
  return {
    ...post,
    ...getDealMeta(post),
  };
}

function getPickupMeta(post: PickupModePost): {
  pickupType: PickupType;
  pickupZoneId: string | null;
  pickupZone: PickupZone | null;
} {
  const pickupZoneId = post.pickupZoneId ?? null;
  const pickupType = normalizePickupType(post.pickupType, pickupZoneId);
  const pickupZone =
    pickupType === "damara_zone"
      ? findDamaraPickupZoneById(pickupZoneId)
      : null;

  return {
    pickupType,
    pickupZoneId: pickupType === "damara_zone" ? pickupZoneId : null,
    pickupZone: pickupZone?.isActive ? pickupZone : null,
  };
}

function withPickupFields<T extends PickupModePost>(post: T) {
  return {
    ...post,
    ...getPickupMeta(post),
  };
}

function withPostComputedFields<
  T extends ProductNamedPost & TradeModePost & PickupModePost,
>(post: T) {
  return withPickupFields(withTradeDealFields(withProductNameFallback(post)));
}

function validatePickupFields(
  data: Partial<PostCreationAttributes>,
  base?: Partial<PostCreationAttributes>
) {
  const hasPickupType = Object.prototype.hasOwnProperty.call(data, "pickupType");
  const hasPickupZoneId = Object.prototype.hasOwnProperty.call(
    data,
    "pickupZoneId"
  );
  const hasPickupLocation = Object.prototype.hasOwnProperty.call(
    data,
    "pickupLocation"
  );

  const pickupZoneId = hasPickupZoneId
    ? data.pickupZoneId
    : base?.pickupZoneId;
  const pickupType = normalizePickupType(
    hasPickupType ? data.pickupType : base?.pickupType,
    pickupZoneId
  );
  const pickupLocation = hasPickupLocation
    ? data.pickupLocation
    : base?.pickupLocation;

  data.pickupType = pickupType;

  if (pickupType === "damara_zone") {
    const zone = findDamaraPickupZoneById(pickupZoneId);
    if (!zone || !zone.isActive) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "유효한 다마라존을 선택해야 합니다.",
        "INVALID_PICKUP_ZONE"
      );
    }

    data.pickupZoneId = zone.id;
    data.pickupLocation = zone.displayName;
    return data;
  }

  const normalizedLocation =
    typeof pickupLocation === "string" ? pickupLocation.trim() : "";
  if (!normalizedLocation) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "직접 입력 수령 방식에는 pickupLocation이 필요합니다.",
      "PICKUP_LOCATION_REQUIRED"
    );
  }

  data.pickupZoneId = null;
  data.pickupLocation = normalizedLocation;
  return data;
}

function validateTradeModeFields(
  data: Partial<PostCreationAttributes>,
  base?: Partial<PostCreationAttributes>
) {
  const price = toNullableNumber(data.price ?? base?.price);
  const minParticipants =
    toNullableInteger(data.minParticipants ?? base?.minParticipants) ?? 1;
  const groupBuyType = normalizeGroupBuyType(
    data.groupBuyType ?? base?.groupBuyType
  );
  const groupBuyMode = normalizeGroupBuyMode(
    data.groupBuyMode ?? base?.groupBuyMode
  );
  const targetParticipants = toNullableInteger(
    Object.prototype.hasOwnProperty.call(data, "targetParticipants")
      ? data.targetParticipants
      : base?.targetParticipants
  );
  const targetPrice = toNullableNumber(
    Object.prototype.hasOwnProperty.call(data, "targetPrice")
      ? data.targetPrice
      : base?.targetPrice
  );

  data.groupBuyType = groupBuyType;
  data.groupBuyMode = groupBuyMode;

  if (groupBuyMode === "normal") {
    data.targetParticipants = null;
    data.targetPrice = null;
    return data;
  }

  if (groupBuyType !== "pre_recruit") {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "price_unlock은 선모집형(pre_recruit)에서만 사용할 수 있습니다.",
      "INVALID_GROUP_BUY_MODE"
    );
  }

  if (targetParticipants === null || targetPrice === null || price === null) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "price_unlock에는 기본 가격, 목표 인원, 목표 달성 가격이 필요합니다.",
      "PRICE_UNLOCK_FIELDS_REQUIRED"
    );
  }

  if (targetParticipants < minParticipants) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "targetParticipants는 minParticipants 이상이어야 합니다.",
      "INVALID_TARGET_PARTICIPANTS"
    );
  }

  if (targetPrice >= price) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "targetPrice는 기본 price보다 낮아야 합니다.",
      "INVALID_TARGET_PRICE"
    );
  }

  data.targetParticipants = targetParticipants;
  data.targetPrice = targetPrice;

  return data;
}

function toPostSnapshot(
  post: Pick<
    PostListItem,
    | "id"
    | "currentQuantity"
    | "minParticipants"
    | "status"
    | "price"
    | "groupBuyType"
    | "groupBuyMode"
    | "targetParticipants"
    | "targetPrice"
    | "pickupType"
    | "pickupZoneId"
    | "pickupLocation"
  >
) {
  return {
    id: post.id,
    currentQuantity: post.currentQuantity,
    minParticipants: post.minParticipants,
    status: post.status,
    price: post.price,
    pickupLocation: post.pickupLocation ?? null,
    targetParticipants: post.targetParticipants ?? null,
    targetPrice: post.targetPrice ?? null,
    ...getDealMeta(post),
    ...getPickupMeta(post),
  };
}

async function enrichPostListItem(
  post: PostListItem,
  userId?: string
): Promise<EnrichedPostListItem> {
  const [
    favoriteCount,
    isFavorite,
    isParticipant,
    exceptionSummary,
  ] = await Promise.all([
    FavoriteService.getFavoriteCount(post.id),
    userId ? FavoriteService.isFavorite(post.id, userId) : false,
    userId ? PostParticipantRepo.isParticipant(post.id, userId) : false,
    PostExceptionService.getExceptionSummary(post.id),
  ]);
  const isOwner = userId ? post.authorId === userId : false;

  return {
    ...withPostComputedFields(post),
    favoriteCount,
    isFavorite,
    isParticipant,
    isOwner,
    thumbnailUrl: getThumbnailUrl(post as { images?: PostImageSource[] }),
    exceptionSummary,
    ...getDeadlineMeta(post.deadline),
  };
}

function comparePopularPosts(
  a: EnrichedPostListItem,
  b: EnrichedPostListItem
) {
  const participantDiff =
    Number(b.currentQuantity || 0) - Number(a.currentQuantity || 0);
  if (participantDiff !== 0) {
    return participantDiff;
  }

  const favoriteDiff = b.favoriteCount - a.favoriteCount;
  if (favoriteDiff !== 0) {
    return favoriteDiff;
  }

  return getPostCreatedTime(b) - getPostCreatedTime(a);
}

function toPublicUserProfile(user?: PublicUserProfileSource | null) {
  if (!user) {
    return null;
  }

  const { trustScore, ...profile } = user;

  return {
    ...profile,
    trustGrade: TrustService.calculateTrustGrade(Number(trustScore || 0)),
  };
}

function toParticipantListItem(participant: PostParticipantListSource) {
  const user = participant.user ?? null;
  const trustGrade =
    user?.trustScore !== undefined && user?.trustScore !== null
      ? TrustService.calculateTrustGrade(Number(user.trustScore))
      : null;

  return {
    id: participant.id,
    postId: participant.postId,
    userId: participant.userId,
    nickname: user?.nickname ?? null,
    studentId: user?.studentId ?? null,
    department: user?.department ?? null,
    avatarUrl: user?.avatarUrl ?? null,
    trustGrade,
    joinedAt: participant.createdAt,
    status: "joined",
    participantStatus: participant.participantStatus,
    participantStatusLabel:
      PARTICIPANT_STATUS_LABELS[participant.participantStatus],
    user: user
      ? {
          id: user.id,
          nickname: user.nickname,
          studentId: user.studentId,
          department: user.department,
          avatarUrl: user.avatarUrl,
          trustGrade,
        }
      : null,
  };
}

export const PostService = {
  /**
   * 공동구매 상품 등록
   * - 작성자가 존재하는지 확인
   * - 이미지 URL 배열을 PostRepo로 전달
   */
  async createPost(data: PostCreationAttributes, imageUrls: string[] = []) {
    // 작성자 존재 확인
    const author = await UserModel.findByPk(data.authorId);
    if (!author) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "AUTHOR_NOT_FOUND");
    }

    const createData = validateTradeModeFields(
      validatePickupFields(data)
    ) as PostCreationAttributes;
    const post = await PostRepo.create(createData, imageUrls);
    const plainPost = post?.get();
    return plainPost ? withPostComputedFields(plainPost) : plainPost;
  },

  /**
   * 여러 화면에서 공통으로 쓰는 카드 UI 필드 보강
   */
  async enrichPostCard(post: PostListItem, userId?: string) {
    return await enrichPostListItem(post, userId);
  },

  /**
   * ID로 상품 조회
   * - favoriteCount와 isFavorite 포함
   */
  async getPostById(id: string, userId?: string) {
    const post = (await PostRepo.findDetailById(id)) as PostDetailSource;
    if (!post) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "POST_NOT_FOUND");
    }

    const [
      favoriteCount,
      isFavorite,
      participants,
      exceptionSummary,
    ] = await Promise.all([
      FavoriteService.getFavoriteCount(id),
      userId ? FavoriteService.isFavorite(id, userId) : false,
      PostParticipantRepo.findProfilesByPostId(
        id
      ) as Promise<PostParticipantProfileSource[]>,
      PostExceptionService.getExceptionSummary(id),
    ]);
    const participantProfiles = participants.map((participant) => ({
      id: participant.id,
      userId: participant.userId,
      participantStatus: participant.participantStatus,
      joinedAt: participant.createdAt,
      user: toPublicUserProfile(participant.user),
    }));
    const isParticipant = userId
      ? participants.some((participant) => participant.userId === userId)
      : false;
    const isOwner = userId ? post.authorId === userId : false;
    const { author, ...postWithoutAuthor } = post;
    const participantsPreview = participants.slice(0, 5).map((participant) => {
      const user = participant.user;

      return {
        userId: participant.userId,
        nickname: user?.nickname ?? "",
        avatarUrl: user?.avatarUrl ?? null,
        trustGrade: user
          ? TrustService.calculateTrustGrade(Number(user.trustScore || 0))
          : null,
        joinedAt: participant.createdAt,
      };
    });

    return {
      ...withPostComputedFields(postWithoutAuthor),
      author: toPublicUserProfile(author),
      participants: participantProfiles,
      participantCount: participantProfiles.length,
      participantsPreview,
      participantsTotal: participantProfiles.length,
      exceptionSummary,
      favoriteCount,
      isFavorite,
      isParticipant,
      isOwner,
      thumbnailUrl: getThumbnailUrl(
        postWithoutAuthor as { images?: PostImageSource[] }
      ),
      ...getDeadlineMeta(post.deadline),
    };
  },

  /**
   * 전체 조회 + pagination
   * category/status/keyword 필터링과 홈 피드 정렬 지원
   */
  async listPosts(
    limitOrOptions: number | PostListOptions = 20,
    offset = 0,
    category?: string | null
  ) {
    const options: PostListOptions =
      typeof limitOrOptions === "number"
        ? { limit: limitOrOptions, offset, category }
        : limitOrOptions;
    const limit = options.limit ?? 20;
    const normalizedOffset = options.offset ?? 0;
    const userId =
      options.userId && String(options.userId).trim() !== ""
        ? String(options.userId).trim()
        : undefined;

    const [posts, total] = await Promise.all([
      PostRepo.list({
        ...options,
        limit,
        offset: normalizedOffset,
      }),
      PostRepo.count(options),
    ]);
    const enrichedPosts = await Promise.all(
      posts.map((post) => enrichPostListItem(post, userId))
    );

    let items = enrichedPosts;
    if (options.sort === "popular") {
      items = enrichedPosts
        .sort(comparePopularPosts)
        .slice(normalizedOffset, normalizedOffset + limit);
    }

    const response: PostListResponse = {
      items,
      total,
      limit,
      offset: normalizedOffset,
      hasNext: normalizedOffset + items.length < total,
    };

    return response;
  },

  async searchProductName(productName: string, limit = 10, userId?: string) {
    const query = productName.trim().replace(/\s+/g, " ");
    if (!query) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "상품명을 입력해 주세요.",
        "PRODUCT_NAME_REQUIRED"
      );
    }

    const normalizedLimit = Math.min(Math.max(limit, 1), 20);
    const { posts, total, exactTotal } = await PostRepo.searchByProductName(
      query,
      normalizedLimit
    );
    const items = await Promise.all(
      posts.map((post) => enrichPostListItem(post, userId))
    );

    return {
      query,
      exists: total > 0,
      exactMatchExists: exactTotal > 0,
      partialMatchExists: total > 0,
      total,
      exactMatchCount: exactTotal,
      limit: normalizedLimit,
      items,
    };
  },

  /**
   * 참여/참여취소 후 프론트 진행률 갱신용 최소 게시글 스냅샷
   */
  async getParticipationPostSnapshot(id: string) {
    const post = await PostRepo.findById(id);
    if (!post) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "POST_NOT_FOUND");
    }

    return toPostSnapshot(post);
  },

  /**
   * 작성자 ID로 조회
   */
  async listPostsByAuthor(authorId: string, limit = 20, offset = 0) {
    const posts = await PostRepo.findByAuthorId(authorId, limit, offset);
    return posts.map((post) =>
      withPostComputedFields(post)
    );
  },

  /**
   * 작성자 학번으로 조회
   * - 학번으로 User를 찾은 뒤 해당 사용자의 게시글을 반환
   */
  async listPostsByStudentId(studentId: string, limit = 20, offset = 0) {
    const author = await UserModel.findOne({ where: { studentId } });
    if (!author) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "AUTHOR_NOT_FOUND");
    }
    const posts = await PostRepo.findByAuthorId(author.id, limit, offset);
    return posts.map((post) =>
      withPostComputedFields(post)
    );
  },

  /**
   * 게시글 상태 변경
   * - 작성자만 변경 가능
   * - 상태 전이 규칙 적용 (선택사항)
   * - 상태 변경 시 신뢰도 업데이트
   */
  async updatePostStatus(
    id: string,
    newStatus: "open" | "closed" | "in_progress" | "completed" | "cancelled",
    authorId: string
  ) {
    const post = await PostRepo.findById(id);
    if (!post) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "POST_NOT_FOUND");
    }

    // 작성자 권한 체크
    if (post.authorId !== authorId) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "작성자만 상태를 변경할 수 있습니다.",
        "FORBIDDEN"
      );
    }

    // 상태 전이 규칙 적용 (선택사항)
    // 주석 처리하면 모든 상태 간 자유롭게 변경 가능
    const ENABLE_STATUS_TRANSITION_RULES = true; // false로 변경하면 규칙 비활성화

    if (ENABLE_STATUS_TRANSITION_RULES) {
      const validTransitions: Record<string, string[]> = {
        open: ["closed", "cancelled"],
        closed: ["in_progress", "cancelled"],
        in_progress: ["completed", "cancelled"],
        completed: [], // 변경 불가
        cancelled: [], // 변경 불가
      };

      const currentStatus = post.status;
      const allowedStatuses = validTransitions[currentStatus] || [];

      // completed나 cancelled 상태에서는 변경 불가
      if (currentStatus === "completed" || currentStatus === "cancelled") {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "현재 상태에서는 상태를 변경할 수 없습니다.",
          "INVALID_STATUS_TRANSITION"
        );
      }

      // 상태 전이 규칙 체크
      if (allowedStatuses.length > 0 && !allowedStatuses.includes(newStatus)) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          `${currentStatus} 상태에서 ${newStatus} 상태로 변경할 수 없습니다. 가능한 상태: ${allowedStatuses.join(
            ", "
          )}`,
          "INVALID_STATUS_TRANSITION"
        );
      }
    }

    if (post.status === newStatus) {
      if (newStatus === "completed") {
        await TrustService.recordPostCompletedForAuthor(id, post.authorId);
      } else if (newStatus === "cancelled") {
        const cancelScore = await getAuthorCancellationScore(id);
        if (cancelScore !== 0) {
          await TrustService.recordPostCancelledByAuthor(
            id,
            post.authorId,
            cancelScore
          );
        }
      }
      return withPostComputedFields(post);
    }

    if (newStatus === "completed") {
      const [receivedCount, openExceptionCount] = await Promise.all([
        PostParticipantRepo.countByPostIdAndStatus(id, "received"),
        PostExceptionRepo.countOpenByPostId(id),
      ]);
      if (receivedCount === 0) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "RECEIVED_PARTICIPANT_REQUIRED"
        );
      }
      if (openExceptionCount > 0) {
        throw new RouteError(HttpStatusCodes.CONFLICT, "OPEN_EXCEPTION_EXISTS");
      }
    }

    // 상태 업데이트
    await PostRepo.update(id, { status: newStatus });

    // 업데이트 후 최신 데이터 조회 (관계 데이터 포함)
    const newPost = await PostRepo.findById(id);
    if (!newPost) {
      throw new RouteError(
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
        "게시글 업데이트 후 조회에 실패했습니다.",
        "INTERNAL_SERVER_ERROR"
      );
    }

    // 상태 변경 시 신뢰도 업데이트
    if (newStatus === "completed") {
      // 거래 완료 시 모집자 행동 점수만 반영한다. 참여자는 수령 시 반영한다.
      await TrustService.recordPostCompletedForAuthor(id, post.authorId);

      const participants = await PostParticipantRepo.findByPostId(id);
      const participantUserIds = participants.map((participant) => participant.userId);

      // 공동구매 완료 알림 생성 (주최자 + 참여자)
      try {
        const allUserIds = [post.authorId, ...participantUserIds];
        await NotificationService.createPostCompletedNotification(
          id,
          allUserIds
        );
      } catch (error) {
        console.error("Failed to create completion notification:", error);
      }
    } else if (newStatus === "cancelled") {
      const cancelScore = await getAuthorCancellationScore(id);
      if (cancelScore !== 0) {
        await TrustService.recordPostCancelledByAuthor(
          id,
          post.authorId,
          cancelScore
        );
      }

      // 공동구매 취소 알림 생성 (참여자 + 관심 등록자)
      try {
        const participants = await PostParticipantRepo.findByPostId(id);
        const participantUserIds = participants.map((p) => p.userId);

        // 관심 등록자 목록 가져오기
        const { FavoriteRepo } = await import("../repos/FavoriteRepo");
        const favorites = await FavoriteRepo.findByPostId(id);
        const favoriteUserIds = favorites.map((f) => f.userId);

        // 중복 제거
        const allUserIds = [
          ...new Set([...participantUserIds, ...favoriteUserIds]),
        ];

        if (allUserIds.length > 0) {
          await NotificationService.createPostCancelledNotification(
            id,
            allUserIds
          );
        }
      } catch (error) {
        console.error("Failed to create cancellation notification:", error);
      }
    }

    return withPostComputedFields(newPost);
  },

  /**
   * 부분 업데이트
   * - status가 completed 또는 cancelled로 변경될 때 신뢰도 업데이트
   */
  async updatePost(id: string, patch: Partial<PostCreationAttributes>) {
    // 이전 상태 확인
    const oldPost = await PostRepo.findById(id);
    if (!oldPost) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "POST_NOT_FOUND");
    }

    if (patch.status !== undefined) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "POST_STATUS_ENDPOINT_REQUIRED"
      );
    }

    const updatePatch = validateTradeModeFields(
      validatePickupFields(patch, oldPost),
      oldPost
    );
    const updatedPost = await PostRepo.update(id, updatePatch);
    const newPost = updatedPost?.get();

    return newPost ? withPostComputedFields(newPost) : newPost;
  },

  /**
   * 삭제
   * - 삭제 시 주최자 내부 신뢰점수 -5점
   */
  async deletePost(id: string, actorUserId: string) {
    // 삭제 전에 게시글 정보 조회
    const post = await PostRepo.findById(id);
    if (!post) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "POST_NOT_FOUND");
    }
    if (post.authorId !== actorUserId) {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, "POST_DELETE_FORBIDDEN");
    }

    const participantCount = await PostParticipantRepo.countByPostId(id);
    if (participantCount > 0) {
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        "POST_HAS_PARTICIPANTS_CANCEL_REQUIRED"
      );
    }

    await PostRepo.delete(id);
  },
};

// 참여 기능을 위한 별도 Service
export const PostParticipantService = {
  /**
   * 공동구매 참여
   * - 참여 후 currentQuantity 업데이트
   * - 주최자에게 새 참여자 알림 생성
   */
  async joinPost(postId: string, userId: string) {
    // 참여 처리
    const participant = await PostParticipantRepo.create({
      postId,
      userId,
    });

    // currentQuantity 업데이트
    const count = await PostParticipantRepo.countByPostId(postId);
    await PostModel.update(
      { currentQuantity: count },
      { where: { id: postId } }
    );

    // 주최자에게 새 참여자 알림 생성
    try {
      await NotificationService.createNewParticipantNotification(
        postId,
        userId
      );
    } catch (error) {
      // 알림 생성 실패해도 참여는 성공으로 처리
      console.error("Failed to create notification:", error);
    }

    return participant;
  },

  /**
   * 참여 취소
   * - 취소 후 currentQuantity 업데이트
   * - 참여자 내부 신뢰점수 -3점
   * - 주최자에게 참여자 취소 알림 생성
   */
  async leavePost(postId: string, userId: string) {
    const [post, participant] = await Promise.all([
      PostModel.findByPk(postId),
      PostParticipantRepo.findByPostAndUser(postId, userId),
    ]);
    if (!post) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "POST_NOT_FOUND");
    }
    if (!participant) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "PARTICIPANT_NOT_FOUND");
    }
    if (participant.participantStatus === "received") {
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        "RECEIVED_PARTICIPATION_CANNOT_CANCEL"
      );
    }

    const hoursUntilPickup =
      (getCancellationReferenceAt(post).getTime() - Date.now()) /
      (60 * 60 * 1000);
    const cancelScore =
      participant.participantStatus === "pickup_ready"
        ? TRUST_POLICY.PARTICIPANT_CANCELLED_PICKUP_READY
        : participant.participantStatus === "payment_pending"
          ? TRUST_POLICY.PARTICIPANT_CANCELLED_AFTER_PAYMENT
          : hoursUntilPickup <= 24
            ? TRUST_POLICY.PARTICIPANT_CANCELLED_WITHIN_24_HOURS
            : 0;
    if (cancelScore !== 0) {
      await TrustService.recordParticipantCancelled(
        postId,
        userId,
        cancelScore
      );
    }
    await PostParticipantRepo.delete(postId, userId);

    // currentQuantity 업데이트
    const count = await PostParticipantRepo.countByPostId(postId);
    await PostModel.update(
      { currentQuantity: count },
      { where: { id: postId } }
    );

    // 주최자에게 참여자 취소 알림 생성
    try {
      await NotificationService.createParticipantCancelNotification(
        postId,
        userId
      );
    } catch (error) {
      // 알림 생성 실패해도 참여 취소는 성공으로 처리
      console.error("Failed to create notification:", error);
    }
  },

  /**
   * 게시글의 참여자 목록 조회
   */
  async getParticipants(postId: string, limit = 20, offset = 0) {
    const [participants, total] = await Promise.all([
      PostParticipantRepo.findByPostId(postId, { limit, offset }) as Promise<
        PostParticipantListSource[]
      >,
      PostParticipantRepo.countByPostId(postId),
    ]);
    const items = participants.map(toParticipantListItem);

    return {
      participants: items,
      total,
      limit,
      offset,
      hasNext: offset + items.length < total,
    };
  },

  /**
   * 사용자가 참여한 게시글 목록 조회
   */
  async getParticipatedPosts(userId: string) {
    return await PostParticipantRepo.findByUserId(userId);
  },

  /**
   * 참여자별 진행 상태 변경
   * - 작성자 또는 해당 참여자 본인만 변경 가능
   */
  async updateParticipantStatus(
    postId: string,
    userId: string,
    participantStatus: ParticipantStatus,
    actorUserId: string
  ) {
    const post = await PostModel.findByPk(postId, {
      attributes: ["id", "authorId"],
    });
    if (!post) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "POST_NOT_FOUND");
    }

    const canUpdate =
      actorUserId === post.authorId || actorUserId === userId;
    if (!canUpdate) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "PARTICIPANT_STATUS_FORBIDDEN"
      );
    }

    const previousParticipant = await PostParticipantRepo.findByPostAndUser(
      postId,
      userId
    );
    if (!previousParticipant) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "PARTICIPANT_NOT_FOUND");
    }

    if (participantStatus === "received" && actorUserId !== userId) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "RECEIPT_MUST_BE_CONFIRMED_BY_PARTICIPANT"
      );
    }

    if (
      participantStatus !== "received" &&
      participantStatus !== previousParticipant.participantStatus &&
      actorUserId !== post.authorId
    ) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "PARTICIPANT_PROGRESS_MUST_BE_UPDATED_BY_AUTHOR"
      );
    }

    if (
      !canTransitionParticipantStatus(
        previousParticipant.participantStatus,
        participantStatus
      )
    ) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "INVALID_PARTICIPANT_STATUS_TRANSITION"
      );
    }

    const participant = await PostParticipantRepo.updateStatus(
      postId,
      userId,
      participantStatus
    );
    if (participantStatus === "received") {
      await TrustService.recordParticipantReceived(postId, userId);
    }
    return participant;
  },

  /**
   * 사용자가 특정 게시글에 참여했는지 확인
   */
  async isParticipant(postId: string, userId: string) {
    return await PostParticipantRepo.isParticipant(postId, userId);
  },
};
