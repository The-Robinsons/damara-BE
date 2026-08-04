import { Request } from "express";
import { describe, expect, it } from "vitest";
import { getRequestUserId } from "../../src/common/util/request-user";

const sessionUserId = "4a1e5397-fe24-49f9-80ba-a05f7406a947";
const headerUserId = "78784a7a-826b-4cc6-b6a6-590d59968b27";

describe("getRequestUserId", () => {
  it("prefers the authenticated session user", () => {
    const req = {
      user: { id: sessionUserId },
      headers: { "x-user-id": headerUserId },
    } as unknown as Request;

    expect(getRequestUserId(req)).toBe(sessionUserId);
  });

  it("supports the legacy X-User-Id header", () => {
    const req = {
      headers: { "x-user-id": headerUserId },
    } as unknown as Request;

    expect(getRequestUserId(req)).toBe(headerUserId);
  });

  it("rejects missing and malformed identities", () => {
    expect(() =>
      getRequestUserId({ headers: {} } as unknown as Request)
    ).toThrowError("AUTHENTICATION_REQUIRED");
    expect(() =>
      getRequestUserId({
        headers: { "x-user-id": "not-a-uuid" },
      } as unknown as Request)
    ).toThrowError("INVALID_USER_ID");
  });
});
