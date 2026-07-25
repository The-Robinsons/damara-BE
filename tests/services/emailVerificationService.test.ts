import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/common/constants/ENV", () => ({
  default: {
    DbName: "damara_test",
    DbUser: "test",
    DbPassword: "test",
    DbHost: "localhost",
    DbPort: 3306,
    MailProvider: "json",
    MailFrom: "no-reply@damara.local",
    MailFromName: "DAMARA",
    SmtpHost: "",
    SmtpPort: 587,
    SmtpSecure: false,
    SmtpUser: "",
    SmtpPassword: "",
    EmailVerificationCodeTtlSeconds: 300,
    EmailVerificationTokenTtlSeconds: 900,
    EmailVerificationResendSeconds: 60,
    EmailVerificationMaxAttempts: 5,
    EmailVerificationMaxSendsPerHour: 5,
    EmailVerificationMaxIpSendsPerHour: 20,
    EmailVerificationHmacSecret: "test-email-verification-secret",
  },
}));

import { EmailSender, EmailMessage } from "../../src/common/mail/EmailSender";
import { EmailVerificationRepo } from "../../src/repos/EmailVerificationRepo";
import { UserRepo } from "../../src/repos/UserRepo";
import { EmailVerificationService } from "../../src/services/EmailVerificationService";

function createVerification(data: Record<string, unknown>) {
  return {
    attemptCount: 0,
    maxAttempts: 5,
    verifiedAt: null,
    tokenHash: null,
    tokenExpiresAt: null,
    consumedAt: null,
    invalidatedAt: null,
    async update(patch: Record<string, unknown>) {
      Object.assign(this, patch);
      return this;
    },
    ...data,
  };
}

function mockSendPrerequisites() {
  vi.spyOn(UserRepo, "findByEmail").mockResolvedValue(null);
  vi.spyOn(
    EmailVerificationRepo,
    "findLatestCreatedAt"
  ).mockResolvedValue(null);
  vi.spyOn(
    EmailVerificationRepo,
    "countSinceByEmail"
  ).mockResolvedValue(0);
  vi.spyOn(EmailVerificationRepo, "countSinceByIp").mockResolvedValue(0);
  vi.spyOn(
    EmailVerificationRepo,
    "invalidateActive"
  ).mockResolvedValue(undefined);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EmailVerificationService", () => {
  it("인증번호 원문 대신 해시를 저장하고 정책에 맞는 메일을 보낸다", async () => {
    mockSendPrerequisites();
    let savedVerification:
      | (ReturnType<typeof createVerification> & { codeHash?: string })
      | undefined;
    let sentMessage: EmailMessage | undefined;

    vi.spyOn(EmailVerificationRepo, "create").mockImplementation(
      async (data) => {
        savedVerification = createVerification({
          ...data,
          createdAt: new Date(),
        });
        return savedVerification as never;
      }
    );

    const sender: EmailSender = {
      async send(message) {
        sentMessage = message;
      },
    };

    const result = await EmailVerificationService.sendVerification(
      " User@Example.COM ",
      "127.0.0.1",
      sender
    );

    const code = sentMessage?.text.match(/인증번호: (\d{6})/)?.[1];
    expect(result.message).toBe("VERIFICATION_EMAIL_SENT");
    expect(sentMessage?.to).toBe("user@example.com");
    expect(code).toMatch(/^\d{6}$/);
    expect(savedVerification?.codeHash).not.toBe(code);
    expect(savedVerification?.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("발송한 인증번호를 확인하고 일회성 토큰을 발급한다", async () => {
    mockSendPrerequisites();
    let verification: ReturnType<typeof createVerification> | undefined;
    let sentMessage: EmailMessage | undefined;

    vi.spyOn(EmailVerificationRepo, "create").mockImplementation(
      async (data) => {
        verification = createVerification(data);
        return verification as never;
      }
    );
    vi.spyOn(EmailVerificationRepo, "findLatest").mockImplementation(
      async () => verification as never
    );

    await EmailVerificationService.sendVerification(
      "user@example.com",
      "127.0.0.1",
      {
        async send(message) {
          sentMessage = message;
        },
      }
    );

    const code = sentMessage?.text.match(/인증번호: (\d{6})/)?.[1];
    expect(code).toBeDefined();

    const result = await EmailVerificationService.verifyCode(
      "user@example.com",
      code as string
    );

    expect(result.verified).toBe(true);
    expect(result.emailVerificationToken).toBeTruthy();
    expect(verification?.tokenHash).not.toBe(result.emailVerificationToken);
    expect(verification?.verifiedAt).toBeInstanceOf(Date);
  });

  it("잘못된 인증번호 입력 횟수를 증가시킨다", async () => {
    const verification = createVerification({
      email: "user@example.com",
      codeHash: "0".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.spyOn(EmailVerificationRepo, "findLatest").mockResolvedValue(
      verification as never
    );

    await expect(
      EmailVerificationService.verifyCode("user@example.com", "123456")
    ).rejects.toMatchObject({ error: "EMAIL_VERIFICATION_FAILED" });
    expect(verification.attemptCount).toBe(1);
  });
});
