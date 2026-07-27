import { Request, Response, NextFunction } from "express";
import HttpStatusCodes from "../common/constants/HttpStatusCodes";
import { parseReq } from "../routes/common/validation/parseReq";
import {
  SendEmailVerificationReq,
  sendEmailVerificationSchema,
  VerifyEmailVerificationReq,
  verifyEmailVerificationSchema,
} from "../routes/common/validation/email-verification-schemas";
import { EmailVerificationService } from "../services/EmailVerificationService";

export async function sendEmailVerification(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email } = parseReq<SendEmailVerificationReq>(
      sendEmailVerificationSchema
    )(req.body);
    const result = await EmailVerificationService.sendVerification(
      email,
      req.ip || req.socket.remoteAddress || "unknown"
    );
    res.status(HttpStatusCodes.ACCEPTED).json(result);
  } catch (error) {
    next(error);
  }
}

export async function verifyEmailVerification(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, code } = parseReq<VerifyEmailVerificationReq>(
      verifyEmailVerificationSchema
    )(req.body);
    const result = await EmailVerificationService.verifyCode(email, code);
    res.status(HttpStatusCodes.OK).json(result);
  } catch (error) {
    next(error);
  }
}
