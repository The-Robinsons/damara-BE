import { describe, expect, it } from "vitest";
import { createUserSchema } from "../../src/routes/common/validation/user-schemas";

const validRequest = {
  user: {
    email: " Student@MJU.AC.KR ",
    passwordHash: "password123",
    nickname: "다마라",
    studentId: "20241234",
    emailVerificationToken: "verification-token",
  },
};

describe("createUserSchema email verification", () => {
  it("인증 토큰을 필수로 받고 이메일을 정규화한다", () => {
    const parsed = createUserSchema.parse(validRequest);
    expect(parsed.user.email).toBe("student@mju.ac.kr");
    expect(parsed.user.emailVerificationToken).toBe("verification-token");
  });

  it("인증 토큰 누락은 서비스가 전용 오류로 처리할 수 있게 파싱한다", () => {
    const request = structuredClone(validRequest);
    const user = request.user as Partial<typeof request.user>;
    delete user.emailVerificationToken;

    expect(createUserSchema.safeParse(request).success).toBe(true);
  });

  it.each([
    "domain-check@example.invalid",
    "user@example.com",
    "user@sub.mju.ac.kr",
    "user@mju.ac.kr.evil.com",
  ])("비명지대 이메일 %s로 회원가입할 수 없다", (email) => {
    expect(
      createUserSchema.safeParse({
        user: {
          ...validRequest.user,
          email,
        },
      }).success
    ).toBe(false);
  });
});
