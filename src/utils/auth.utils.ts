import jwt from "jsonwebtoken";
import { requireEnv } from "../config/env";

/**
 * JWT secrets.
 *
 * These MUST be present at startup.
 * Missing values will crash early (by design).
 */
const ACCESS_TOKEN_SECRET = requireEnv("ACCESS_TOKEN_SECRET");
const REFRESH_TOKEN_SECRET = requireEnv("REFRESH_TOKEN_SECRET");

/**
 * JWT configuration.
 *
 * Centralized here so:
 * - expiration policies are consistent
 * - changes are easy to audit
 */
const ACCESS_TOKEN_EXPIRES_IN = "15m"; // short-lived (API access)
const REFRESH_TOKEN_EXPIRES_IN = "7d"; // longer-lived (session renewal)

/**
 * Generate a signed access token.
 *
 * Used for:
 * - authenticating API requests
 *
 * @param userId MongoDB user id
 */
export function generateAccessToken(userId: string): string {
  return jwt.sign(
    { userId },
    ACCESS_TOKEN_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      algorithm: "HS256",
    }
  );
}

/**
 * Generate a signed refresh token.
 *
 * Used for:
 * - issuing new access tokens
 * - long-lived sessions
 *
 * @param userId MongoDB user id
 */
export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId },
    REFRESH_TOKEN_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      algorithm: "HS256",
    }
  );
}

/**
 * Generate a temporary plaintext password.
 *
 * Use cases:
 * - account invitations
 * - password reset flows
 *
 * IMPORTANT:
 * - This should be hashed immediately before storing
 * - Never log or persist plaintext passwords
 */
export function generateTemporaryPassword(length = 12): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*";

  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  return password;
}