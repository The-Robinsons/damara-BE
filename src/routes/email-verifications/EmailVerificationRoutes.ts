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
 *         description: 이메일 형식 오류 또는 @mju.ac.kr 이외 도메인 (VALIDATION_ERROR 또는 INVALID_MJU_EMAIL)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: VALIDATION_ERROR
 *               message: VALIDATION_ERROR
 *               details:
 *                 issues:
 *                   - path: [email]
 *                     message: 명지대학교 이메일(@mju.ac.kr)만 사용할 수 있습니다.
 *       409:
 *         description: 이미 가입된 이메일 (EMAIL_ALREADY_EXISTS). 인증번호를 생성하거나 이메일을 발송하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: EMAIL_ALREADY_EXISTS
 *               message: EMAIL_ALREADY_EXISTS
 *               details: {}
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
 *         description: 이메일 형식/도메인 오류 또는 인증 실패 (VALIDATION_ERROR, INVALID_MJU_EMAIL, EMAIL_VERIFICATION_FAILED)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       410:
 *         description: 인증번호 만료
 *       423:
 *         description: 인증 시도 횟수 초과
 */
emailVerificationRouter.post("/verify", verifyEmailVerification);

export default emailVerificationRouter;
