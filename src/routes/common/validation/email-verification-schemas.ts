import z from "zod";
import { mjuEmailSchema } from "../../../common/validation/mju-email";

export const sendEmailVerificationSchema = z.object({
  email: mjuEmailSchema,
});

export const verifyEmailVerificationSchema = z.object({
  email: mjuEmailSchema,
  code: z.string().regex(/^\d{6}$/, "인증번호는 6자리 숫자여야 합니다."),
});

export type SendEmailVerificationReq = z.infer<
  typeof sendEmailVerificationSchema
>;
export type VerifyEmailVerificationReq = z.infer<
  typeof verifyEmailVerificationSchema
>;
