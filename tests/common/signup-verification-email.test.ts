import { describe, expect, it } from "vitest";
import {
  renderSignupVerificationEmail,
  SIGNUP_VERIFICATION_SUBJECT,
} from "../../src/common/mail/templates/signup-verification";

describe("signup verification email template", () => {
  it("HTML과 텍스트 본문에 같은 인증번호와 유효시간을 넣는다", () => {
    const result = renderSignupVerificationEmail("381204", 5);

    expect(result.subject).toBe(SIGNUP_VERIFICATION_SUBJECT);
    expect(result.html).toContain("381204");
    expect(result.text).toContain("381204");
    expect(result.html).toContain("5분");
    expect(result.text).toContain("5분");
    expect(result.html).toContain("다른 사람에게 공유하지 마세요");
    expect(result.text).toContain("본인이 요청하지 않았다면");
  });

  it("잘못된 템플릿 변수를 거부한다", () => {
    expect(() => renderSignupVerificationEmail("12345", 5)).toThrow(
      "INVALID_SIGNUP_VERIFICATION_TEMPLATE_VARIABLES"
    );
    expect(() => renderSignupVerificationEmail("123456", 0)).toThrow(
      "INVALID_SIGNUP_VERIFICATION_TEMPLATE_VARIABLES"
    );
  });
});
