import {
  createHmac,
  randomInt,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import HttpStatusCodes from "../common/constants/HttpStatusCodes";
import ENV from "../common/constants/ENV";
import { emailSender, EmailSender } from "../common/mail/EmailSender";
import { renderSignupVerificationEmail } from "../common/mail/templates/signup-verification";
import { RouteError } from "../common/util/route-errors";
import { sequelize } from "../db";
import { EmailVerificationRepo } from "../repos/EmailVerificationRepo";
import { UserRepo } from "../repos/UserRepo";

const HOUR_MS = 60 * 60 * 1000;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hash(value: string) {
  return createHmac("sha256", ENV.EmailVerificationHmacSecret)
    .update(value)
    .digest("hex");
}

function safeHashEquals(value: string, expectedHash: string) {
  const actual = Buffer.from(hash(value), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function createCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function createToken() {
  return randomBytes(32).toString("base64url");
}

function routeError(status: HttpStatusCodes, code: string) {
  return new RouteError(status, code);
}

export const EmailVerificationService = {
  async sendVerification(
    rawEmail: string,
    requestIp: string,
    sender: EmailSender = emailSender
  ) {
    const email = normalizeEmail(rawEmail);
    const now = new Date();
    const hourAgo = new Date(now.getTime() - HOUR_MS);
    const ipHash = hash(requestIp || "unknown");

    const existingUser = await UserRepo.findByEmail(email);
    if (existingUser) {
      return {
        message: "VERIFICATION_EMAIL_SENT",
        expiresInSeconds: ENV.EmailVerificationCodeTtlSeconds,
        resendAfterSeconds: ENV.EmailVerificationResendSeconds,
      };
    }

    const [lastCreatedAt, emailCount, ipCount] = await Promise.all([
      EmailVerificationRepo.findLatestCreatedAt(email),
      EmailVerificationRepo.countSinceByEmail(email, hourAgo),
      EmailVerificationRepo.countSinceByIp(ipHash, hourAgo),
    ]);

    if (
      (lastCreatedAt &&
        now.getTime() - lastCreatedAt.getTime() <
          ENV.EmailVerificationResendSeconds * 1000) ||
      emailCount >= ENV.EmailVerificationMaxSendsPerHour ||
      ipCount >= ENV.EmailVerificationMaxIpSendsPerHour
    ) {
      throw routeError(
        HttpStatusCodes.TOO_MANY_REQUESTS,
        "EMAIL_VERIFICATION_RATE_LIMITED"
      );
    }

    const code = createCode();
    await EmailVerificationRepo.invalidateActive(email, now);
    const verification = await EmailVerificationRepo.create({
      email,
      codeHash: hash(code),
      maxAttempts: ENV.EmailVerificationMaxAttempts,
      expiresAt: new Date(
        now.getTime() + ENV.EmailVerificationCodeTtlSeconds * 1000
      ),
      requestIpHash: ipHash,
    });

    try {
      const template = renderSignupVerificationEmail(
        code,
        Math.ceil(ENV.EmailVerificationCodeTtlSeconds / 60)
      );
      await sender.send({ to: email, ...template });
    } catch {
      await verification.update({ invalidatedAt: new Date() });
      throw routeError(
        HttpStatusCodes.BAD_GATEWAY,
        "EMAIL_DELIVERY_FAILED"
      );
    }

    return {
      message: "VERIFICATION_EMAIL_SENT",
      expiresInSeconds: ENV.EmailVerificationCodeTtlSeconds,
      resendAfterSeconds: ENV.EmailVerificationResendSeconds,
    };
  },

  async verifyCode(rawEmail: string, code: string) {
    const email = normalizeEmail(rawEmail);
    const verification = await EmailVerificationRepo.findLatest(email);

    if (!verification || verification.verifiedAt) {
      throw routeError(
        HttpStatusCodes.BAD_REQUEST,
        "EMAIL_VERIFICATION_FAILED"
      );
    }

    if (verification.attemptCount >= verification.maxAttempts) {
      throw routeError(
        HttpStatusCodes.LOCKED,
        "VERIFICATION_ATTEMPTS_EXCEEDED"
      );
    }

    if (verification.expiresAt.getTime() <= Date.now()) {
      throw routeError(
        HttpStatusCodes.GONE,
        "VERIFICATION_CODE_EXPIRED"
      );
    }

    if (!safeHashEquals(code, verification.codeHash)) {
      const attemptCount = verification.attemptCount + 1;
      await verification.update({ attemptCount });
      if (attemptCount >= verification.maxAttempts) {
        throw routeError(
          HttpStatusCodes.LOCKED,
          "VERIFICATION_ATTEMPTS_EXCEEDED"
        );
      }
      throw routeError(
        HttpStatusCodes.BAD_REQUEST,
        "EMAIL_VERIFICATION_FAILED"
      );
    }

    const token = createToken();
    await verification.update({
      tokenHash: hash(token),
      verifiedAt: new Date(),
      tokenExpiresAt: new Date(
        Date.now() + ENV.EmailVerificationTokenTtlSeconds * 1000
      ),
    });

    return {
      verified: true,
      emailVerificationToken: token,
      expiresInSeconds: ENV.EmailVerificationTokenTtlSeconds,
    };
  },

  async consumeToken(
    rawEmail: string,
    token: string,
    operation: (transaction: import("sequelize").Transaction) => Promise<unknown>
  ) {
    const email = normalizeEmail(rawEmail);
    return await sequelize.transaction(async (transaction) => {
      const verification =
        await EmailVerificationRepo.findByTokenHashForUpdate(
          hash(token),
          transaction
        );

      if (
        !verification ||
        verification.email !== email ||
        !verification.verifiedAt ||
        verification.consumedAt ||
        verification.invalidatedAt
      ) {
        throw routeError(
          HttpStatusCodes.UNAUTHORIZED,
          "INVALID_EMAIL_VERIFICATION_TOKEN"
        );
      }

      if (
        !verification.tokenExpiresAt ||
        verification.tokenExpiresAt.getTime() <= Date.now()
      ) {
        throw routeError(
          HttpStatusCodes.GONE,
          "EMAIL_VERIFICATION_EXPIRED"
        );
      }

      const result = await operation(transaction);
      await verification.update(
        { consumedAt: new Date() },
        { transaction }
      );
      return result;
    });
  },
};
