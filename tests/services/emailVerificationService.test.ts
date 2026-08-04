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
import { sequelize } from "../../src/db";

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
      " Student@MJU.AC.KR ",
      "127.0.0.1",
      sender
    );

    const code = sentMessage?.text.match(/인증번호: (\d{6})/)?.[1];
    expect(result.message).toBe("VERIFICATION_EMAIL_SENT");
    expect(sentMessage?.to).toBe("student@mju.ac.kr");
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
      "user@mju.ac.kr",
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
      "user@mju.ac.kr",
      code as string
    );

    expect(result.verified).toBe(true);
    expect(result.emailVerificationToken).toBeTruthy();
    expect(verification?.tokenHash).not.toBe(result.emailVerificationToken);
    expect(verification?.verifiedAt).toBeInstanceOf(Date);
  });

  it("잘못된 인증번호 입력 횟수를 증가시킨다", async () => {
    const verification = createVerification({
      email: "user@mju.ac.kr",
      codeHash: "0".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.spyOn(EmailVerificationRepo, "findLatest").mockResolvedValue(
      verification as never
    );

    await expect(
      EmailVerificationService.verifyCode("user@mju.ac.kr", "123456")
    ).rejects.toMatchObject({ error: "EMAIL_VERIFICATION_FAILED" });
    expect(verification.attemptCount).toBe(1);
  });

  it.each([" domain-check@EXAMPLE.INVALID ", "bad@@mju.ac.kr"])(
    "허용되지 않는 이메일 %s는 저장소 조회와 메일 발송 전에 거부한다",
    async (email) => {
      const findUser = vi.spyOn(UserRepo, "findByEmail");
      const send = vi.fn();

      await expect(
        EmailVerificationService.sendVerification(email, "127.0.0.1", {
          send,
        })
      ).rejects.toMatchObject({
        status: 400,
        error: "INVALID_MJU_EMAIL",
      });

      expect(findUser).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    }
  );

  it("인증 토큰의 이메일과 회원가입 이메일이 다르면 토큰을 소비하지 않는다", async () => {
    const transaction = {} as import("sequelize").Transaction;
    vi.spyOn(sequelize, "transaction").mockImplementation(
      async (callback: any) => callback(transaction)
    );
    vi.spyOn(
      EmailVerificationRepo,
      "findByTokenHashForUpdate"
    ).mockResolvedValue(
      createVerification({
        email: "verified@mju.ac.kr",
        verifiedAt: new Date(),
        tokenExpiresAt: new Date(Date.now() + 60_000),
      }) as never
    );
    const createUser = vi.fn();

    await expect(
      EmailVerificationService.consumeToken(
        "another@mju.ac.kr",
        "verification-token",
        createUser
      )
    ).rejects.toMatchObject({
      status: 401,
      error: "INVALID_EMAIL_VERIFICATION_TOKEN",
    });

    expect(createUser).not.toHaveBeenCalled();
  });
});
