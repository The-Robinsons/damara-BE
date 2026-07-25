import { Router } from "express";
import {
  sendEmailVerification,
  verifyEmailVerification,
} from "../../controllers/email-verification.controller";

const emailVerificationRouter = Router();

/**
 * @swagger
 * /api/auth/email-verifications/send:
 *   post:
 *     summary: 회원가입 이메일 인증번호 발송
 *     tags: [Email Verifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendEmailVerificationRequest'
 *     responses:
 *       202:
 *         description: 발송 요청 접수
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SendEmailVerificationResponse'
 *       400:
 *         description: 이메일 형식 오류
 *       429:
 *         description: 발송 횟수 제한
 *       502:
 *         description: 이메일 전송 실패
 */
emailVerificationRouter.post("/send", sendEmailVerification);

/**
 * @swagger
 * /api/auth/email-verifications/verify:
 *   post:
 *     summary: 회원가입 이메일 인증번호 확인
 *     tags: [Email Verifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyEmailVerificationRequest'
 *     responses:
 *       200:
 *         description: 인증 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VerifyEmailVerificationResponse'
 *       400:
 *         description: 인증 실패
 *       410:
 *         description: 인증번호 만료
 *       423:
 *         description: 인증 시도 횟수 초과
 */
emailVerificationRouter.post("/verify", verifyEmailVerification);

export default emailVerificationRouter;
