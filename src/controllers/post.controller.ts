// src/controllers/post.controller.ts

import { Request, Response, NextFunction } from "express";
import { PostService, PostParticipantService } from "../services/PostService";
import { PostExceptionService } from "../services/PostExceptionService";
import { PostCreationAttributes } from "../models/Post";
import { parseReq } from "../routes/common/validation/parseReq";
import HttpStatusCodes from "../common/constants/HttpStatusCodes";
import {
  RouteError,
  sendErrorResponse,
} from "../common/util/route-errors";
import { getRequestUserId } from "../common/util/request-user";
import logger from "jet-logger";
import {
  createPostSchema,
  CreatePostReq,
  updatePostSchema,
  UpdatePostReq,
} from "../routes/common/validation/post-schemas";
import {
  updatePostStatusSchema,
  UpdatePostStatusReq,
} from "../routes/common/validation/post-status-schemas";
import {
  updateParticipantStatusSchema,
  UpdateParticipantStatusReq,
} from "../routes/common/validation/participant-status-schemas";
import {
  createPostExceptionSchema,
  CreatePostExceptionReq,
  updatePostExceptionStatusSchema,
  UpdatePostExceptionStatusReq,
} from "../routes/common/validation/post-exception-schemas";
import { PostListSort, PostListStatus } from "../types/post-list";

const POST_LIST_SORTS: PostListSort[] = ["latest", "deadline", "popular"];
const POST_LIST_STATUSES: PostListStatus[] = [
  "open",
  "closed",
  "in_progress",
  "completed",
  "cancelled",
];

function getSingleValue(value: unknown): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (rawValue === undefined || rawValue === null) {
    return undefined;
  }

  const valueString = String(rawValue).trim();
  return valueString === "" ? undefined : valueString;
}

function parseNonNegativeInteger(value: unknown, fallback: number) {
  const stringValue = getSingleValue(value);
  if (!stringValue) {
    return fallback;
  }

  const parsed = Number.parseInt(stringValue, 10);
  return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed;
}

const nullableStringPostFields = [
  "productName",
  "pickupLocation",
  "pickupZoneId",
  "pickupDate",
  "pickupStartTime",
  "pickupEndTime",
  "pickupGuide",
  "groupBuyType",
  "notice",
] as const;

type NullableStringPostField = (typeof nullableStringPostFields)[number];

function normalizeNullableString(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeTags(tags: string[] | null | undefined) {
  if (!Array.isArray(tags)) {
    return null;
  }

  const normalizedTags = tags
    .map((tag) => String(tag).trim())
    .filter((tag) => tag !== "");

  return normalizedTags.length > 0 ? normalizedTags : null;
}

function normalizePostDetailFields<T extends Record<string, unknown>>(data: T) {
  const mutableData = data as T &
    Record<NullableStringPostField, string | null | undefined> & {
      tags?: string[] | null;
      groupBuyMode?: string | null;
      pickupType?: string | null;
    };

  for (const field of nullableStringPostFields) {
    if (Object.prototype.hasOwnProperty.call(mutableData, field)) {
      mutableData[field] = normalizeNullableString(mutableData[field]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(mutableData, "tags")) {
    mutableData.tags = normalizeTags(mutableData.tags);
  }

  if (
    Object.prototype.hasOwnProperty.call(mutableData, "groupBuyMode") &&
    mutableData.groupBuyMode === null
  ) {
    mutableData.groupBuyMode = undefined;
  }

  if (
    Object.prototype.hasOwnProperty.call(mutableData, "pickupType") &&
    mutableData.pickupType === null
  ) {
    mutableData.pickupType = undefined;
  }

  return mutableData;
}

/**
 * 공동구매 상품 전체 목록 / 홈 피드 목록
 * GET /api/posts?limit&offset&category&sort&status&keyword&userId
 *
 * - pagination 기본값은 (20, 0)
 * - category 쿼리 파라미터로 필터링 가능
 * - sort(latest/deadline/popular), status, keyword 검색 지원
 * - userId 또는 x-user-id가 있으면 isFavorite를 사용자 기준으로 계산
 * - Service.listPosts로 위임하여 DB 접근을 추상화
 */
export async function getAllPosts(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const limit = parseNonNegativeInteger(req.query.limit, 20);
    const offset = parseNonNegativeInteger(req.query.offset, 0);
    const category = getSingleValue(req.query.category);
    const keyword =
      getSingleValue(req.query.keyword) || getSingleValue(req.query.q);
    const userId =
      getSingleValue(req.headers["x-user-id"]) ||
      getSingleValue(req.query.userId);
    const sortValue = getSingleValue(req.query.sort) || "latest";
    const statusValue = getSingleValue(req.query.status);

    if (!POST_LIST_SORTS.includes(sortValue as PostListSort)) {
      return sendErrorResponse(
        res,
        HttpStatusCodes.BAD_REQUEST,
        "INVALID_SORT",
        "sort는 latest, deadline, popular 중 하나여야 합니다."
      );
    }

    if (
      statusValue &&
      !POST_LIST_STATUSES.includes(statusValue as PostListStatus)
    ) {
      return sendErrorResponse(
        res,
        HttpStatusCodes.BAD_REQUEST,
        "INVALID_STATUS",
        "status는 open, closed, in_progress, completed, cancelled 중 하나여야 합니다."
      );
    }

    logger.info(
      `getAllPosts - category=${category}, sort=${sortValue}, status=${statusValue}, keyword=${keyword}`
    );
    const posts = await PostService.listPosts({
      limit,
      offset,
      category,
      keyword,
      userId,
      sort: sortValue as PostListSort,
      status: statusValue as PostListStatus | undefined,
    });
    logger.info(`getAllPosts - 반환된 게시글 수: ${posts.items.length}`);

    res.status(HttpStatusCodes.OK).json(posts);
  } catch (error) {
    next(error);
  }
}

export async function searchProductName(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const productName =
      getSingleValue(req.query.productName) ||
      getSingleValue(req.query.q) ||
      getSingleValue(req.query.keyword);
    const userId =
      getSingleValue(req.headers["x-user-id"]) ||
      getSingleValue(req.query.userId);

    if (!productName) {
      return sendErrorResponse(
        res,
        HttpStatusCodes.BAD_REQUEST,
        "PRODUCT_NAME_REQUIRED",
        "상품명을 입력해 주세요."
      );
    }

    const result = await PostService.searchProductName(
      productName,
      parseNonNegativeInteger(req.query.limit, 10),
      userId
    );

    res.status(HttpStatusCodes.OK).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * 특정 작성자의 상품 목록 (학번 기준)
 * GET /api/posts/student/:studentId
 */
export async function getPostsByStudentId(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { studentId } = req.params;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 20;
    const offset = req.query.offset
      ? parseInt(req.query.offset as string, 10)
      : 0;

    const posts = await PostService.listPostsByStudentId(
      studentId,
      limit,
      offset
    );
    res.status(HttpStatusCodes.OK).json(posts);
  } catch (error) {
    next(error);
  }
}

/**
 * 공동구매 상품 상세 조회
 * GET /api/posts/:id
 *
 * - 존재하지 않으면 Service에서 RouteError(404)를 던짐
 */
export async function getPostById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const userId =
      getSingleValue(req.headers["x-user-id"]) ||
      getSingleValue(req.query.userId);

    const post = await PostService.getPostById(id, userId);

    res.status(HttpStatusCodes.OK).json(post);
  } catch (error) {
    next(error);
  }
}

/**
 * 공동구매 상품 등록
 * POST /api/posts
 * body: { post: { ... } }
 *
 * - deadline 문자열을 Date 객체로 변환
 * - 이미지 배열을 그대로 Service.createPost에 전달
 */
export async function createPost(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validatedData = parseReq<CreatePostReq>(createPostSchema)(req.body);
    const { post } = validatedData;

    // deadline과 category를 명시적으로 처리
    const { images = [], deadline, category, ...postData } = post;

    // category 값 정규화 (빈 문자열을 null로, trim 처리)
    const normalizedCategory =
      category && String(category).trim() !== ""
        ? String(category).trim()
        : null;

    logger.info(
      `createPost - 카테고리 처리: 원본=${category}, 정규화됨=${normalizedCategory}`
    );

    const createData = normalizePostDetailFields({
      ...postData,
      deadline: new Date(deadline),
      category: normalizedCategory,
    }) as PostCreationAttributes;
    createData.productName = createData.productName ?? post.title;

    const createdPost = await PostService.createPost(createData, images);

    logger.info(
      `createPost - 생성된 게시글 카테고리: ${createdPost?.category}`
    );

    res.status(HttpStatusCodes.CREATED).json(createdPost);
  } catch (error) {
    next(error);
  }
}

/**
 * 공동구매 상품 수정
 * PUT /api/posts/:id
 * body: { post: { ...patch } }
 *
 * - 부분 업데이트를 허용하므로 Partial<PostCreationAttributes> 사용
 */
export async function updatePost(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const validatedData = parseReq<UpdatePostReq>(updatePostSchema)(req.body);
    const { post } = validatedData;

    // deadline을 분리하여 Date 객체로 변환
    const { deadline, ...patchWithoutDeadline } = post;
    const updateData = normalizePostDetailFields({
      ...patchWithoutDeadline,
    }) as Partial<PostCreationAttributes>;
    if (deadline) {
      updateData.deadline = new Date(deadline);
    }

    const updatedPost = await PostService.updatePost(id, updateData);

    res.status(HttpStatusCodes.OK).json(updatedPost);
  } catch (error) {
    next(error);
  }
}

/**
 * 공동구매 상품 삭제
 * DELETE /api/posts/:id
 *
 * - 성공 시 204 No Content
 */
export async function deletePost(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const userId = getRequestUserId(req);
    await PostService.deletePost(id, userId);

    res.status(HttpStatusCodes.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
}

/**
 * 게시글 상태 변경
 * PATCH /api/posts/:id/status
 * body: { status: "closed" }
 *
 * - 작성자만 변경 가능
 * - 상태 전이 규칙 적용 (선택사항)
 */
export async function updatePostStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    logger.info("=== updatePostStatus 호출됨 ===");
    logger.info(`Request method: ${req.method}`);
    logger.info(`Request path: ${req.path}`);
    logger.info(`Request params: ${JSON.stringify(req.params)}`);
    logger.info(`Request body: ${JSON.stringify(req.body)}`);

    const { id } = req.params;
    const validatedData = parseReq<UpdatePostStatusReq>(updatePostStatusSchema)(
      req.body
    );
    const { status } = validatedData;

    const authorId = getRequestUserId(req);

    const updatedPost = await PostService.updatePostStatus(
      id,
      status,
      authorId
    );

    res.status(HttpStatusCodes.OK).json(updatedPost);
  } catch (error) {
    next(error);
  }
}

/**
 * 공동구매 참여
 * POST /api/posts/:id/participate
 * body: { userId }
 */
export async function joinPost(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const userId = getRequestUserId(req);
    if (req.body.userId && req.body.userId !== userId) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "PARTICIPATION_USER_MISMATCH"
      );
    }

    await PostParticipantService.joinPost(id, userId);
    const post = await PostService.getParticipationPostSnapshot(id);

    res.status(HttpStatusCodes.CREATED).json({
      isParticipant: true,
      post,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 공동구매 참여 취소
 * DELETE /api/posts/:id/participate/:userId
 */
export async function leavePost(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id, userId } = req.params;
    const actorUserId = getRequestUserId(req);
    if (actorUserId !== userId) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "PARTICIPATION_CANCEL_FORBIDDEN"
      );
    }

    await PostParticipantService.leavePost(id, userId);
    const post = await PostService.getParticipationPostSnapshot(id);

    res.status(HttpStatusCodes.OK).json({
      isParticipant: false,
      post,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 게시글의 참여자 목록 조회
 * GET /api/posts/:id/participants
 */
export async function getParticipants(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const limit = parseNonNegativeInteger(req.query.limit, 20);
    const offset = parseNonNegativeInteger(req.query.offset, 0);
    const participants = await PostParticipantService.getParticipants(
      id,
      limit,
      offset
    );

    res.status(HttpStatusCodes.OK).json(participants);
  } catch (error) {
    next(error);
  }
}

/**
 * 사용자가 참여한 게시글 목록 조회
 * GET /api/posts/user/:userId/participated
 */
export async function getParticipatedPosts(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { userId } = req.params;
    const posts = await PostParticipantService.getParticipatedPosts(userId);

    res.status(HttpStatusCodes.OK).json(posts);
  } catch (error) {
    next(error);
  }
}

/**
 * 참여자별 진행 상태 변경
 * PATCH /api/posts/:id/participants/:userId/status
 * body: { participantStatus }
 */
export async function updateParticipantStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id, userId } = req.params;
    const validatedData = parseReq<UpdateParticipantStatusReq>(
      updateParticipantStatusSchema
    )(req.body);
    const actorUserId = getRequestUserId(req);

    const participant = await PostParticipantService.updateParticipantStatus(
      id,
      userId,
      validatedData.participantStatus,
      actorUserId
    );

    res.status(HttpStatusCodes.OK).json(participant);
  } catch (error) {
    next(error);
  }
}

/**
 * 게시글 예외 케이스 등록
 * POST /api/posts/:id/exceptions
 */
export async function createPostException(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const validatedData = parseReq<CreatePostExceptionReq>(
      createPostExceptionSchema
    )(req.body);
    const reporterId =
      validatedData.exception.reporterId ||
      getSingleValue(req.headers["x-user-id"]);

    if (!reporterId) {
      return sendErrorResponse(
        res,
        HttpStatusCodes.BAD_REQUEST,
        "REPORTER_ID_REQUIRED",
        "예외 케이스를 등록하는 사용자 ID가 필요합니다."
      );
    }

    const postException = await PostExceptionService.createPostException(id, {
      ...validatedData.exception,
      reporterId,
    });

    res.status(HttpStatusCodes.CREATED).json(postException);
  } catch (error) {
    next(error);
  }
}

/**
 * 게시글 예외 케이스 목록 조회
 * GET /api/posts/:id/exceptions
 */
export async function getPostExceptions(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const limit = parseNonNegativeInteger(req.query.limit, 20);
    const offset = parseNonNegativeInteger(req.query.offset, 0);
    const exceptions = await PostExceptionService.listPostExceptions(
      id,
      limit,
      offset
    );

    res.status(HttpStatusCodes.OK).json(exceptions);
  } catch (error) {
    next(error);
  }
}

/**
 * 게시글 예외 케이스 처리 상태 변경
 * PATCH /api/posts/:id/exceptions/:exceptionId/status
 */
export async function updatePostExceptionStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id, exceptionId } = req.params;
    const validatedData = parseReq<UpdatePostExceptionStatusReq>(
      updatePostExceptionStatusSchema
    )(req.body);
    const actorUserId =
      validatedData.actorUserId || getSingleValue(req.headers["x-user-id"]);

    if (!actorUserId) {
      return sendErrorResponse(
        res,
        HttpStatusCodes.BAD_REQUEST,
        "ACTOR_USER_ID_REQUIRED",
        "예외 케이스 상태를 변경하는 사용자 ID가 필요합니다."
      );
    }

    const postException = await PostExceptionService.updatePostExceptionStatus(
      id,
      exceptionId,
      validatedData.status,
      actorUserId,
      validatedData.resolutionNote
    );

    res.status(HttpStatusCodes.OK).json(postException);
  } catch (error) {
    next(error);
  }
}

/**
 * 사용자가 특정 게시글에 참여했는지 확인
 * GET /api/posts/:id/participate/:userId
 */
export async function checkParticipation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id, userId } = req.params;
    const isParticipant = await PostParticipantService.isParticipant(
      id,
      userId
    );

    res.status(HttpStatusCodes.OK).json({ isParticipant });
  } catch (error) {
    next(error);
  }
}
