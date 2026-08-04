import { describe, expect, it } from "vitest";
import {
  sendEmailVerificationSchema,
  verifyEmailVerificationSchema,
} from "../../src/routes/common/validation/email-verification-schemas";

describe("email verification schemas", () => {
  it("이메일 앞뒤 공백과 대소문자를 정규화한다", () => {
    expect(
      sendEmailVerificationSchema.parse({ email: " Student@MJU.AC.KR " })
    ).toEqual({ email: "student@mju.ac.kr" });
  });

  it.each([
    "domain-check@example.invalid",
    "user@example.com",
    "user@sub.mju.ac.kr",
    "user@mju.ac.kr.evil.com",
  ])("비명지대 이메일 %s를 거부한다", (email) => {
    expect(sendEmailVerificationSchema.safeParse({ email }).success).toBe(
      false
    );
    expect(
      verifyEmailVerificationSchema.safeParse({ email, code: "123456" })
        .success
    ).toBe(false);
  });

  it.each(["12345", "1234567", "12A456", " 123456 "])(
    "6자리 숫자가 아닌 인증번호 %s를 거부한다",
    (code) => {
      expect(
        verifyEmailVerificationSchema.safeParse({
          email: "user@mju.ac.kr",
          code,
        }).success
      ).toBe(false);
    }
  );
});
