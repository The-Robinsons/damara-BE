import { Request } from "express";
import HttpStatusCodes from "../constants/HttpStatusCodes";
import { RouteError } from "./route-errors";
import z from "zod";

type SessionUser = { id?: string };

function getSingleValue(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === undefined || rawValue === null
    ? undefined
    : String(rawValue).trim() || undefined;
}

export function getRequestUserId(req: Request) {
  const userId = getOptionalRequestUserId(req);

  if (!userId) {
    throw new RouteError(
      HttpStatusCodes.UNAUTHORIZED,
      "AUTHENTICATION_REQUIRED"
    );
  }

  if (!z.string().uuid().safeParse(userId).success) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "INVALID_USER_ID");
  }

  return userId;
}

function getOptionalRequestUserId(req: Request) {
  const sessionUserId = (req.user as SessionUser | undefined)?.id;
  const userId = sessionUserId || getSingleValue(req.headers["x-user-id"]);
  return userId;
}
