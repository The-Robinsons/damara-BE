import { describe, expect, it } from "vitest";
import {
  sendEmailVerificationSchema,
  verifyEmailVerificationSchema,
} from "../../src/routes/common/validation/email-verification-schemas";

describe("email verification schemas", () => {
  it("이메일 앞뒤 공백과 대소문자를 정규화한다", () => {
    expect(
      sendEmailVerificationSchema.parse({ email: " User@Example.COM " })
    ).toEqual({ email: "user@example.com" });
  });

  it("일반적인 이메일 형식을 허용한다", () => {
    expect(
      sendEmailVerificationSchema.safeParse({ email: "user@sample.org" })
        .success
    ).toBe(true);
  });

  it.each(["12345", "1234567", "12A456", " 123456 "])(
    "6자리 숫자가 아닌 인증번호 %s를 거부한다",
    (code) => {
      expect(
        verifyEmailVerificationSchema.safeParse({
          email: "user@example.com",
          code,
        }).success
      ).toBe(false);
    }
  );
});
