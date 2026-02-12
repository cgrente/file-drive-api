import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { Types } from "mongoose";

import { requireEnv } from "../config/env";
import { AppError } from "../errors/app.errors";

/**
 * What we attach to the request after authentication.
 * Keep it small and stable (avoid full mongoose User docs everywhere).
 */
export type AuthContext = {
  userId: Types.ObjectId;
  userIdString: string;
};

type JwtAuthPayload = JwtPayload & {
  userId?: string;
};

/**
 * Extract token from:
 * 1) HttpOnly cookie: accessToken
 * 2) Authorization: Bearer <token>
 */
function extractAccessToken(req: Request): string | undefined {
  const cookieToken = (req as any).cookies?.accessToken as string | undefined;
  if (cookieToken && cookieToken.trim().length > 0) return cookieToken.trim();

  const authHeader = req.headers.authorization;
  if (!authHeader) return undefined;

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return undefined;
  if (!token || token.trim().length === 0) return undefined;

  return token.trim();
}

/**
 * Authentication middleware (JWT).
 *
 * - Uses HttpOnly cookie by default (accessToken)
 * - Falls back to Authorization Bearer token
 * - Attaches a small auth context to req.auth
 */
export default function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractAccessToken(req);

    if (!token) {
      return next(
        new AppError({
          message: "Unauthorized. No token provided.",
          statusCode: 401,
          code: "AUTH_NO_TOKEN",
        })
      );
    }

    const secret = requireEnv("ACCESS_TOKEN_SECRET");

    let decoded: JwtAuthPayload;
    try {
      decoded = jwt.verify(token, secret) as JwtAuthPayload;
    } catch (cause) {
      return next(
        new AppError({
          message: "Unauthorized. Invalid token.",
          statusCode: 401,
          code: "AUTH_INVALID_TOKEN",
          cause,
        })
      );
    }

    const userIdRaw = decoded.userId;
    if (!userIdRaw || !Types.ObjectId.isValid(userIdRaw)) {
      return next(
        new AppError({
          message: "Unauthorized. Invalid token payload.",
          statusCode: 401,
          code: "AUTH_INVALID_PAYLOAD",
          details: { userId: userIdRaw },
        })
      );
    }

    const userId = new Types.ObjectId(userIdRaw);

    req.auth = {
      userId,
      userIdString: userId.toString(),
    };

    return next();
  } catch (cause) {
    return next(
      new AppError({
        message: "Unauthorized.",
        statusCode: 401,
        code: "AUTH_FAILURE",
        cause,
      })
    );
  }
}