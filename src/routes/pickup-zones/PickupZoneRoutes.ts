import { Router } from "express";
import {
  getPickupZoneById,
  getPickupZones,
} from "../../controllers/pickup-zone.controller";

const pickupZoneRouter = Router();

/**
 * @swagger
 * /api/pickup-zones:
 *   get:
 *     summary: 다마라존 목록 조회
 *     description: 게시글 등록 화면에서 선택할 수 있는 공식 접선지 목록을 조회합니다.
 *     tags: [PickupZones]
 *     parameters:
 *       - in: query
 *         name: campus
 *         schema:
 *           type: string
 *           enum: [humanities, natural, shared]
 *         description: 캠퍼스 필터
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 장소명, 건물명, 설명 검색어. q 쿼리도 같은 의미로 사용할 수 있습니다.
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: keyword와 같은 의미의 검색어 alias입니다.
 *     responses:
 *       200:
 *         description: 다마라존 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [items, total]
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PickupZone'
 *                 total:
 *                   type: integer
 *                   example: 4
 */
pickupZoneRouter.get("/", getPickupZones);

/**
 * @swagger
 * /api/pickup-zones/{id}:
 *   get:
 *     summary: 다마라존 상세 조회
 *     description: 다마라존 ID로 공식 접선지 상세 정보를 조회합니다.
 *     tags: [PickupZones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 다마라존 ID
 *         example: student-hall-8f-stairs
 *     responses:
 *       200:
 *         description: 다마라존 상세 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PickupZone'
 *       404:
 *         description: 다마라존을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
pickupZoneRouter.get("/:id", getPickupZoneById);

export default pickupZoneRouter;
