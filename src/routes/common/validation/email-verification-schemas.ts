import z from "zod";

const normalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email());

export const sendEmailVerificationSchema = z.object({
  email: normalizedEmailSchema,
});

export const verifyEmailVerificationSchema = z.object({
  email: normalizedEmailSchema,
  code: z.string().regex(/^\d{6}$/, "인증번호는 6자리 숫자여야 합니다."),
});

export type SendEmailVerificationReq = z.infer<
  typeof sendEmailVerificationSchema
>;
export type VerifyEmailVerificationReq = z.infer<
  typeof verifyEmailVerificationSchema
>;
