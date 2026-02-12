import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/**
 * Ensure every request has a requestId for tracing across:
 * - frontend logs
 * - API logs
 * - reverse proxy / load balancer logs
 *
 * Behavior:
 * - If the client sends X-Request-Id, we reuse it (after sanitizing).
 * - Otherwise we generate a UUID.
 * - We echo it back in the response header.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const headerValue = req.get("x-request-id");

  const incomingId = normalizeRequestId(headerValue);
  const id = incomingId ?? randomUUID();

  req.requestId = id;
  res.setHeader("X-Request-Id", id);

  next();
}

/**
 * Normalize and sanitize a request id coming from headers.
 * - avoids arrays
 * - trims
 * - enforces max length
 * - restricts characters (keeps it log-safe)
 */
function normalizeRequestId(value: string | undefined): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  // Keep it safe: log-friendly and prevents abuse (huge headers)
  const maxLength = 128;
  const sliced = trimmed.slice(0, maxLength);

  // Allow common id patterns: uuid, hex, base64-ish, dashes/underscores/dots
  const safe = sliced.replace(/[^a-zA-Z0-9._-]/g, "");
  return safe.length > 0 ? safe : null;
}