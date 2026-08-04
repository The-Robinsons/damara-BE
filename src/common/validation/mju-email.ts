import z from "zod";

export const MJU_EMAIL_DOMAIN = "@mju.ac.kr";
export const MJU_EMAIL_PATTERN = /^[^@\s]+@mju\.ac\.kr$/;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isMjuEmail(email: string) {
  return MJU_EMAIL_PATTERN.test(normalizeEmail(email));
}

export const mjuEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email())
  .refine(isMjuEmail, {
    message: `명지대학교 이메일(${MJU_EMAIL_DOMAIN})만 사용할 수 있습니다.`,
  });
