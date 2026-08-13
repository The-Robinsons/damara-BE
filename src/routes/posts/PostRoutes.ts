import { Router } from "express";

import {
  getAllPosts,
  searchProductName,
  getPostsByStudentId,
  getPostById,
  createPost,
  updatePost,
  updatePostStatus,
  deletePost,
  joinPost,
  leavePost,
  getParticipants,
  getParticipatedPosts,
  updateParticipantStatus,
  createPostException,
  getPostExceptions,
  updatePostExceptionStatus,
  checkParticipation,
} from "../../controllers/post.controller";
import {
  addFavorite,
  removeFavorite,
  checkFavorite,
} from "../../controllers/favorite.controller";

const postRouter = Router();

// 디버깅: 라우트 등록 확인
import logger from "jet-logger";
import {
  createTradeReview,
  getReviewEligibility,
} from "../../controllers/trade-review.controller";
logger.info("PostRoutes: 라우터 초기화됨");

/**
 * @swagger
 * /api/posts/{id}/reviews/eligibility:
 *   get:
 *     summary: 거래 상호평가 대상 및 상태 조회
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: header
 *         name: X-User-Id
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 postId: { type: string, format: uuid }
 *                 targets:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ReviewEligibilityTarget' }
 */
postRouter.get("/:id/reviews/eligibility", getReviewEligibility);

/**
 * @swagger
 * /api/posts/{id}/reviews:
 *   post:
 *     summary: 거래 상호평가 제출
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: header
 *         name: X-User-Id
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TradeReviewRequest' }
 *     responses:
 *       201:
 *         description: 제출 성공
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TradeReview' }
 *       409: { description: 중복 제출 }
 */
postRouter.post("/:id/reviews", createTradeReview);

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: 홈 피드 상품 목록 조회 (페이징, 검색, 필터, 정렬 가능)
 *     tags: [Posts]
 *     parameters:
 *       - in: header
 *         name: x-user-id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 현재 사용자 UUID. 전달하면 각 게시글의 isFavorite, isParticipant, isOwner를 사용자 기준으로 계산합니다.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 조회 개수
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 시작 위치
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [food, daily, beauty, electronics, school, freemarket]
 *         description: "카테고리 필터 (food=먹거리, daily=일상용품, beauty=뷰티·패션, electronics=전자기기, school=학용품, freemarket=프리마켓)"
 *         example: food
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [latest, deadline, popular]
 *           default: latest
 *         description: "정렬 방식 (latest=최신순, deadline=마감임박순, popular=인기순. popular는 currentQuantity DESC, favoriteCount DESC, createdAt DESC 기준)"
 *         example: popular
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, closed, completed, cancelled]
 *         description: 게시글 상태 필터. 홈 화면 모집중 목록은 open을 사용합니다.
 *         example: open
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 제목, 내용, 픽업 장소 검색어. q 쿼리도 같은 의미로 사용할 수 있습니다.
 *         example: 물티슈
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: keyword와 같은 의미의 검색어 alias입니다.
 *         example: 물티슈
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 현재 사용자 UUID. x-user-id 헤더를 쓰기 어려운 클라이언트용 대체 파라미터입니다.
 *     responses:
 *       200:
 *         description: 상품 목록 조회 성공. items 각 항목에는 카드 UI에 필요한 관심/참여/작성자/마감 상태가 포함됩니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostListResponse'
 */
// GET /api/posts - 전체 조회 (페이징 가능)
postRouter.get("/", getAllPosts);

/**
 * @swagger
 * /api/posts/product-search:
 *   get:
 *     summary: 상품명 기반 게시글 존재 여부 검색
 *     description: 상품명 또는 게시글 제목에 같은/비슷한 공동구매가 있는지 확인합니다. 등록 화면에서 중복 공구 확인이나 검색 자동완성에 사용할 수 있습니다.
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: productName
 *         schema:
 *           type: string
 *         required: true
 *         description: 검색할 상품명. 앞뒤 공백과 연속 공백은 서버에서 정리합니다. q 또는 keyword도 같은 의미로 사용할 수 있습니다.
 *         example: 물티슈
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 20
 *         description: 함께 반환할 유사 게시글 개수. 1~20 범위로 보정됩니다.
 *       - in: header
 *         name: x-user-id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 현재 사용자 UUID. 전달하면 items의 isFavorite, isParticipant, isOwner를 계산합니다.
 *     responses:
 *       200:
 *         description: 상품명 검색 성공. exactMatchExists는 상품명/제목이 완전히 같은 게시글 존재 여부, partialMatchExists는 일부 포함 검색 결과 존재 여부입니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostProductSearchResponse'
 *       400:
 *         description: 상품명 누락
 */
postRouter.get("/product-search", searchProductName);

/**
 * @swagger
 * /api/posts/student/{studentId}:
 *   get:
 *     summary: 학번으로 상품 조회
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 작성자 학번
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: 해당 학번의 상품 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Post'
 */
// GET /api/posts/student/:studentId - 학번으로 상품 조회
postRouter.get("/student/:studentId", getPostsByStudentId);

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: 상품 등록
 *     tags: [Posts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - post
 *             properties:
 *               post:
 *                 type: object
 *                 required:
 *                   - authorId
 *                   - title
 *                   - content
 *                   - price
 *                   - minParticipants
 *                   - deadline
 *                 properties:
 *                   authorId:
 *                     type: string
 *                     format: uuid
 *                     example: "a87522bd-bc79-47b0-a73f-46ea4068a158"
 *                     description: 작성자 UUID
 *                   title:
 *                     type: string
 *                     minLength: 1
 *                     maxLength: 200
 *                     example: "맛있는 치킨 공동구매"
 *                     description: 상품명
 *                   productName:
 *                     type: string
 *                     maxLength: 200
 *                     nullable: true
 *                     example: "BBQ 황금올리브치킨 2마리 세트"
 *                     description: 상세/등록 UI 상품명. 없으면 title을 fallback으로 사용합니다.
 *                   content:
 *                     type: string
 *                     minLength: 1
 *                     example: "BBQ 황금올리브치킨 2마리 세트를 함께 주문하실 분 구합니다!"
 *                     description: 상품 설명
 *                   price:
 *                     type: number
 *                     minimum: 0
 *                     example: 25000
 *                     description: 가격
 *                   minParticipants:
 *                     type: integer
 *                     minimum: 1
 *                     example: 2
 *                     description: 최소 참여 인원
 *                   deadline:
 *                     type: string
 *                     format: date-time
 *                     example: "2025-11-27T23:59:59.000Z"
 *                     description: 마감 시간 (ISO 8601 형식)
 *                   pickupType:
 *                     type: string
 *                     enum: [custom, damara_zone]
 *                     nullable: true
 *                     example: "damara_zone"
 *                     description: "수령 장소 선택 방식 (custom=직접 입력, damara_zone=다마라존)"
 *                   pickupZoneId:
 *                     type: string
 *                     nullable: true
 *                     example: "s2810"
 *                     description: "다마라존 ID. pickupType=damara_zone일 때 사용"
 *                   pickupLocation:
 *                     type: string
 *                     nullable: true
 *                     maxLength: 200
 *                     example: "명지대학교 정문"
 *                     description: "직접 입력 장소. pickupType=custom일 때 필요하며 damara_zone이면 서버가 다마라존 표시명으로 채움"
 *                   pickupDate:
 *                     type: string
 *                     format: date
 *                     nullable: true
 *                     example: "2026-06-17"
 *                     description: 수령 날짜 (YYYY-MM-DD)
 *                   pickupStartTime:
 *                     type: string
 *                     nullable: true
 *                     example: "17:00"
 *                     description: 수령 시작 시간 (HH:mm 또는 HH:mm:ss)
 *                   pickupEndTime:
 *                     type: string
 *                     nullable: true
 *                     example: "19:00"
 *                     description: 수령 종료 시간 (HH:mm 또는 HH:mm:ss)
 *                   pickupGuide:
 *                     type: string
 *                     nullable: true
 *                     example: "정문 앞 파란 우산 근처에서 수령해 주세요."
 *                     description: 수령 안내
 *                   groupBuyType:
 *                     type: string
 *                     enum: [pre_recruit, post_recruit]
 *                     example: "pre_recruit"
 *                     description: "공구 A/B 타입 (pre_recruit=선모집형, post_recruit=후모집형)"
 *                   groupBuyMode:
 *                     type: string
 *                     enum: [normal, price_unlock]
 *                     example: "price_unlock"
 *                     description: "거래 세부 모드 (normal=기본형, price_unlock=모이면 싸지는 공구)"
 *                   targetParticipants:
 *                     type: integer
 *                     nullable: true
 *                     example: 5
 *                     description: price_unlock 목표 참여 인원
 *                   targetPrice:
 *                     type: number
 *                     nullable: true
 *                     example: 22500
 *                     description: price_unlock 목표 달성 가격
 *                   tags:
 *                     type: array
 *                     nullable: true
 *                     items:
 *                       type: string
 *                     example: ["대용량", "생활용품"]
 *                     description: 공구 태그 목록
 *                   notice:
 *                     type: string
 *                     nullable: true
 *                     example: "입금 확인 후 주문 예정입니다."
 *                     description: 상세 화면 공지사항
 *                   category:
 *                     type: string
 *                     enum: [food, daily, beauty, electronics, school, freemarket]
 *                     nullable: true
 *                     example: "food"
 *                     description: "카테고리 ID (food=먹거리, daily=일상용품, beauty=뷰티·패션, electronics=전자기기, school=학용품, freemarket=프리마켓)"
 *                   images:
 *                     type: array
 *                     items:
 *                       type: string
 *                       minLength: 1
 *                     example: ["https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400"]
 *                     description: 이미지 URL 배열 (선택사항)
 *           example:
 *             post:
 *               authorId: "a87522bd-bc79-47b0-a73f-46ea4068a158"
 *               title: "맛있는 치킨 공동구매"
 *               productName: "BBQ 황금올리브치킨 2마리 세트"
 *               content: "BBQ 황금올리브치킨 2마리 세트를 함께 주문하실 분 구합니다!"
 *               price: 25000
 *               minParticipants: 2
 *               deadline: "2025-11-27T23:59:59.000Z"
 *               pickupType: "damara_zone"
 *               pickupZoneId: "s2810"
 *               pickupDate: "2026-06-17"
 *               pickupStartTime: "17:00"
 *               pickupEndTime: "19:00"
 *               pickupGuide: "정문 앞 파란 우산 근처에서 수령해 주세요."
 *               groupBuyType: "pre_recruit"
 *               groupBuyMode: "price_unlock"
 *               targetParticipants: 5
 *               targetPrice: 22500
 *               tags: ["대용량", "생활용품"]
 *               notice: "입금 확인 후 주문 예정입니다."
 *               category: "food"
 *               images: ["https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400"]
 *     responses:
 *       201:
 *         description: 상품 등록 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       400:
 *         description: 유효성 검증 실패
 *       404:
 *         description: 작성자를 찾을 수 없음
 */
// POST /api/posts - 상품 등록
postRouter.post("/", createPost);

/**
 * @swagger
 * /api/posts/{id}:
 *   put:
 *     summary: 상품 수정
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               post:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                   productName:
 *                     type: string
 *                     nullable: true
 *                   content:
 *                     type: string
 *                   price:
 *                     type: number
 *                   minParticipants:
 *                     type: integer
 *                   status:
 *                     type: string
 *                     enum: [open, closed, completed, cancelled]
 *                   deadline:
 *                     type: string
 *                     format: date-time
 *                   pickupType:
 *                     type: string
 *                     enum: [custom, damara_zone]
 *                     nullable: true
 *                   pickupZoneId:
 *                     type: string
 *                     nullable: true
 *                   pickupLocation:
 *                     type: string
 *                     nullable: true
 *                   pickupDate:
 *                     type: string
 *                     format: date
 *                     nullable: true
 *                   pickupStartTime:
 *                     type: string
 *                     nullable: true
 *                   pickupEndTime:
 *                     type: string
 *                     nullable: true
 *                   pickupGuide:
 *                     type: string
 *                     nullable: true
 *                   groupBuyType:
 *                     type: string
 *                     enum: [pre_recruit, post_recruit]
 *                     nullable: true
 *                   groupBuyMode:
 *                     type: string
 *                     enum: [normal, price_unlock]
 *                     nullable: true
 *                   targetParticipants:
 *                     type: integer
 *                     nullable: true
 *                   targetPrice:
 *                     type: number
 *                     nullable: true
 *                   tags:
 *                     type: array
 *                     nullable: true
 *                     items:
 *                       type: string
 *                   notice:
 *                     type: string
 *                     nullable: true
 *                   category:
 *                     type: string
 *                     enum: [food, daily, beauty, electronics, school, freemarket]
 *                     nullable: true
 *                     description: 카테고리 ID
 *                   images:
 *                     type: array
 *                     items:
 *                       type: string
 *           example:
 *             post:
 *               title: "수정된 제목"
 *               productName: "수정된 상품명"
 *               category: "daily"
 *     responses:
 *       200:
 *         description: 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       404:
 *         description: 상품을 찾을 수 없음
 */
// PUT /api/posts/:id - 상품 수정
postRouter.put("/:id", updatePost);

/**
 * @swagger
 * /api/posts/{id}/status:
 *   patch:
 *     summary: 게시글 상태 변경 (작성자만 가능)
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 UUID
 *       - in: header
 *         name: X-User-Id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 작성자 UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [open, closed, completed, cancelled]
 *                 description: 변경할 상태
 *                 example: "closed"
 *           example:
 *             status: "closed"
 *     responses:
 *       200:
 *         description: 상태 변경 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       400:
 *         description: 잘못된 상태 전이 또는 요청 데이터
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: 권한 없음 (작성자가 아님)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "FORBIDDEN"
 *                 message:
 *                   type: string
 *                   example: "작성자만 상태를 변경할 수 있습니다."
 *       404:
 *         description: 게시글을 찾을 수 없음
 */
// PATCH /api/posts/:id/status - 게시글 상태 변경 (작성자만 가능)
// 중요: 이 라우트는 /:id 라우트보다 먼저 정의되어야 함 (더 구체적인 라우트 우선)
postRouter.patch("/:id/status", (req, res, next) => {
  logger.info("=== PATCH /:id/status 라우트 핸들러 호출됨 ===");
  logger.info(`요청 경로: ${req.path}`);
  logger.info(`요청 파라미터: ${JSON.stringify(req.params)}`);
  updatePostStatus(req, res, next);
});
logger.info("✓ PATCH /api/posts/:id/status 라우트 등록됨");

/**
 * @swagger
 * /api/posts/{id}:
 *   delete:
 *     summary: 상품 삭제
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: X-User-Id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 작성자 UUID
 *     responses:
 *       204:
 *         description: 삭제 성공
 *       404:
 *         description: 상품을 찾을 수 없음
 */
/**
 * @swagger
 * /api/posts/user/{userId}/participated:
 *   get:
 *     summary: 사용자가 참여한 게시글 목록 조회
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 참여한 게시글 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ParticipatedPost'
 */
// GET /api/posts/user/:userId/participated - 사용자가 참여한 게시글 목록 (더 구체적인 라우트를 먼저 배치)
postRouter.get("/user/:userId/participated", getParticipatedPosts);

/**
 * @swagger
 * /api/posts/{id}/participants:
 *   get:
 *     summary: 게시글의 참여자 목록 조회
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 조회 개수
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 시작 위치
 *     responses:
 *       200:
 *         description: 참여자 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostParticipantsResponse'
 */
// GET /api/posts/:id/participants - 참여자 목록 (더 구체적인 라우트를 먼저 배치)
postRouter.get("/:id/participants", getParticipants);

/**
 * @swagger
 * /api/posts/{id}/participants/{userId}/status:
 *   patch:
 *     summary: 참여자 상태 변경
 *     description: 모집자는 입금대기와 수령예정 단계를 순서대로 변경하고, 참여자는 수령예정 상태에서 수령완료를 확정합니다.
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 UUID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 상태를 변경할 참여자 UUID
 *       - in: header
 *         name: X-User-Id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 상태 변경 요청자 UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participantStatus
 *             properties:
 *               participantStatus:
 *                 $ref: '#/components/schemas/ParticipantStatus'
 *           example:
 *             participantStatus: payment_pending
 *     responses:
 *       200:
 *         description: 참여자 상태 변경 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostParticipant'
 *       400:
 *         description: 유효성 검증 실패 또는 요청자 ID 누락
 *       403:
 *         description: 작성자 또는 해당 참여자가 아님
 *       404:
 *         description: 게시글 또는 참여 정보를 찾을 수 없음
 */
// PATCH /api/posts/:id/participants/:userId/status - 참여자 상태 변경
postRouter.patch("/:id/participants/:userId/status", updateParticipantStatus);

/**
 * @swagger
 * /api/posts/{id}/exceptions:
 *   get:
 *     summary: 게시글 예외 케이스 목록 조회
 *     description: 가격 변경, 품절, 수령 정보 변경, 파손/누락/불량 등 게시글 진행 중 발생한 예외 케이스 이력을 조회합니다.
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 UUID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 조회 개수
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 시작 위치
 *     responses:
 *       200:
 *         description: 예외 케이스 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostExceptionsResponse'
 *       404:
 *         description: 게시글을 찾을 수 없음
 *   post:
 *     summary: 게시글 예외 케이스 등록
 *     description: 작성자 또는 참여자가 가격 변경, 품절, 수령 정보 변경, 파손/누락/불량, 주최자 취소, 기타 예외를 등록합니다. 등록 시 작성자와 참여자에게 알림이 생성됩니다.
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 UUID
 *       - in: header
 *         name: x-user-id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 예외 등록자 UUID. body.exception.reporterId 대신 사용할 수 있습니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - exception
 *             properties:
 *               exception:
 *                 type: object
 *                 required:
 *                   - type
 *                   - reason
 *                 properties:
 *                   reporterId:
 *                     type: string
 *                     format: uuid
 *                     description: 예외 등록자 UUID. x-user-id 헤더를 쓰면 생략할 수 있습니다.
 *                   type:
 *                     $ref: '#/components/schemas/PostExceptionType'
 *                   reason:
 *                     type: string
 *                     maxLength: 2000
 *                     description: 예외 사유
 *                   displayTitle:
 *                     type: string
 *                     maxLength: 200
 *                     description: 프론트 배너/배지용 제목. 없으면 type 기준 기본 문구를 사용합니다.
 *                   displayMessage:
 *                     type: string
 *                     maxLength: 500
 *                     description: 프론트 배너/모달용 문구. 없으면 reason을 사용합니다.
 *                   severity:
 *                     $ref: '#/components/schemas/PostExceptionSeverity'
 *                   oldPrice:
 *                     type: number
 *                     nullable: true
 *                     description: 변경 전 가격
 *                   newPrice:
 *                     type: number
 *                     nullable: true
 *                     description: 변경 후 가격
 *                   affectedQuantity:
 *                     type: integer
 *                     nullable: true
 *                     description: 파손/누락 등 영향을 받은 수량
 *                   metadata:
 *                     type: object
 *                     nullable: true
 *                     additionalProperties: true
 *                     description: 예외 유형별 확장 정보
 *           example:
 *             exception:
 *               type: price_changed
 *               reason: 할인 종료로 실제 구매 가격이 1000원 상승했습니다.
 *               displayTitle: 가격이 변경되었어요
 *               displayMessage: 할인 종료로 실제 구매 가격이 5,900원에서 6,900원으로 변경되었습니다.
 *               severity: warning
 *               oldPrice: 5900
 *               newPrice: 6900
 *     responses:
 *       201:
 *         description: 예외 케이스 등록 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostException'
 *       400:
 *         description: 유효성 검증 실패 또는 등록자 ID 누락
 *       403:
 *         description: 작성자 또는 참여자가 아님
 *       404:
 *         description: 게시글 또는 사용자를 찾을 수 없음
 */
postRouter.get("/:id/exceptions", getPostExceptions);
postRouter.post("/:id/exceptions", createPostException);

/**
 * @swagger
 * /api/posts/{id}/exceptions/{exceptionId}/status:
 *   patch:
 *     summary: 게시글 예외 케이스 상태 변경
 *     description: 작성자 또는 예외 등록자가 예외 케이스를 open, resolved, dismissed 상태로 변경합니다.
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 UUID
 *       - in: path
 *         name: exceptionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 예외 케이스 UUID
 *       - in: header
 *         name: x-user-id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 상태 변경 요청자 UUID. body.actorUserId 대신 사용할 수 있습니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 $ref: '#/components/schemas/PostExceptionStatus'
 *               actorUserId:
 *                 type: string
 *                 format: uuid
 *                 description: 상태 변경 요청자 UUID. x-user-id 헤더를 쓰면 생략할 수 있습니다.
 *               resolutionNote:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 2000
 *                 description: 처리 내용 또는 기각 사유
 *           example:
 *             status: resolved
 *             resolutionNote: 참여자 동의 후 변경 가격으로 진행했습니다.
 *     responses:
 *       200:
 *         description: 예외 케이스 상태 변경 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostException'
 *       400:
 *         description: 유효성 검증 실패 또는 요청자 ID 누락
 *       403:
 *         description: 작성자 또는 예외 등록자가 아님
 *       404:
 *         description: 게시글 또는 예외 케이스를 찾을 수 없음
 */
postRouter.patch(
  "/:id/exceptions/:exceptionId/status",
  updatePostExceptionStatus
);

/**
 * @swagger
 * /api/posts/{id}/participate/{userId}:
 *   get:
 *     summary: 사용자가 특정 게시글에 참여했는지 확인
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 참여 여부 확인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isParticipant:
 *                   type: boolean
 */
// GET /api/posts/:id/participate/:userId - 참여 여부 확인 (더 구체적인 라우트를 먼저 배치)
postRouter.get("/:id/participate/:userId", checkParticipation);

/**
 * @swagger
 * /api/posts/{postId}/favorite:
 *   post:
 *     summary: 관심 등록
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: 사용자 UUID
 *           example:
 *             userId: "a87522bd-bc79-47b0-a73f-46ea4068a158"
 *     responses:
 *       201:
 *         description: 관심 등록 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 postId:
 *                   type: string
 *                   format: uuid
 *                 userId:
 *                   type: string
 *                   format: uuid
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 isFavorite:
 *                   type: boolean
 *                   example: true
 *                 favoriteCount:
 *                   type: integer
 *                   example: 13
 *       400:
 *         description: 이미 관심 등록됨
 */
// POST /api/posts/:postId/favorite - 관심 등록
postRouter.post("/:postId/favorite", addFavorite);

/**
 * @swagger
 * /api/posts/{postId}/favorite/{userId}:
 *   get:
 *     summary: 관심 여부 확인
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 UUID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 사용자 UUID
 *     responses:
 *       200:
 *         description: 관심 여부 확인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isFavorite:
 *                   type: boolean
 *                 favoriteCount:
 *                   type: integer
 *                   description: 현재 게시글 관심 등록 수
 *                   example: 13
 */
// GET /api/posts/:postId/favorite/:userId - 관심 여부 확인
postRouter.get("/:postId/favorite/:userId", checkFavorite);

/**
 * @swagger
 * /api/posts/{postId}/favorite/{userId}:
 *   delete:
 *     summary: 관심 해제
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 UUID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 사용자 UUID
 *     responses:
 *       200:
 *         description: 관심 해제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "관심 해제되었습니다."
 *                 isFavorite:
 *                   type: boolean
 *                   example: false
 *                 favoriteCount:
 *                   type: integer
 *                   example: 12
 *       404:
 *         description: 관심 등록 또는 게시글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// DELETE /api/posts/:postId/favorite/:userId - 관심 해제
postRouter.delete("/:postId/favorite/:userId", removeFavorite);

/**
 * @swagger
 * /api/posts/{id}/participate:
 *   post:
 *     summary: 공동구매 참여
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: header
 *         name: X-User-Id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 참여 사용자 UUID. body.userId와 같아야 합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *           example:
 *             userId: "a87522bd-bc79-47b0-a73f-46ea4068a158"
 *     responses:
 *       201:
 *         description: 참여 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostParticipationResult'
 *       400:
 *         description: 이미 참여했거나 작성자는 참여할 수 없음
 *       404:
 *         description: 게시글 또는 사용자를 찾을 수 없음
 */
// POST /api/posts/:id/participate - 참여하기 (더 구체적인 라우트를 먼저 배치)
postRouter.post("/:id/participate", joinPost);

/**
 * @swagger
 * /api/posts/{id}/participate/{userId}:
 *   delete:
 *     summary: 공동구매 참여 취소
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: header
 *         name: X-User-Id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 취소하는 참여자 UUID. path userId와 같아야 합니다.
 *     responses:
 *       200:
 *         description: 참여 취소 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostParticipationResult'
 *       404:
 *         description: 참여 정보를 찾을 수 없음
 */
// DELETE /api/posts/:id/participate/:userId - 참여 취소 (더 구체적인 라우트를 먼저 배치)
postRouter.delete("/:id/participate/:userId", leavePost);

// DELETE /api/posts/:id - 상품 삭제 (일반 라우트는 마지막에 배치)
postRouter.delete("/:id", deletePost);

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     summary: 상품 상세 조회
 *     description: 상세 화면에 필요한 게시글 정보, 작성자 공개 프로필, 참여자 공개 프로필, 관심/참여 상태를 함께 조회합니다.
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 상품 UUID
 *       - in: header
 *         name: x-user-id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 사용자 ID (isFavorite, isParticipant, isOwner 확인용, 선택사항)
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 사용자 ID (isFavorite, isParticipant, isOwner 확인용, 선택사항)
 *     responses:
 *       200:
 *         description: 상품 상세 정보 (author, participants, participantsPreview, favoriteCount, isFavorite, isParticipant, isOwner 포함)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostDetail'
 *       404:
 *         description: 상품을 찾을 수 없음
 */
// GET /api/posts/:id - 상세 조회 (일반 라우트는 마지막에 배치)
// 주의: 더 구체적인 라우트들(:id/participate, :id/participants 등)이 먼저 정의되어야 함
postRouter.get("/:id", getPostById);

export default postRouter;
