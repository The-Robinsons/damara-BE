import { Router } from "express";
import { updateTradeReview } from "../../controllers/trade-review.controller";

const reviewRouter = Router();

/**
 * @swagger
 * /api/reviews/{id}:
 *   put:
 *     summary: 공개 전 상호평가 수정
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
 *           schema: { $ref: '#/components/schemas/TradeReviewUpdateRequest' }
 *     responses:
 *       200:
 *         description: 수정 성공
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TradeReview' }
 *       409: { description: 이미 공개되어 수정 불가 }
 */
reviewRouter.put("/:id", updateTradeReview);

export default reviewRouter;
