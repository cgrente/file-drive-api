import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app.errors";

type ErrorPayload = {
  message: string;
  code: string;
  requestId?: string;
  stack?: string;
  details?: unknown;
};

function getRequestId(req: Request): string | undefined {
  // Prefer what your request-id middleware sets
  const requestId = (req as Request & { requestId?: string }).requestId;

  // Fallback: some proxies put it in headers
  const headerId = req.header("x-request-id");

  return requestId ?? headerId ?? undefined;
}

function isAppError(err: unknown): err is AppError {
  if (err instanceof AppError) return true;

  // Shape guard: helps when instanceof fails (different bundles, test doubles, etc.)
  if (!err || typeof err !== "object") return false;

  const maybe = err as Partial<AppError> & { name?: unknown; isOperational?: unknown };
  return (
    maybe.name === "AppError" &&
    typeof maybe.statusCode === "number" &&
    maybe.isOperational === true
  );
}

function toLogObject(err: unknown) {
  if (err instanceof Error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cause = (err as any).cause;
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      cause: cause instanceof Error ? { name: cause.name, message: cause.message, stack: cause.stack } : cause,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      details: (err as any).details,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      code: (err as any).code,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      statusCode: (err as any).statusCode,
    };
  }

  return { error: err };
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const nodeEnv = process.env.NODE_ENV ?? "production";
  const isProd = nodeEnv === "production";

  const requestId = getRequestId(req);
  const appError = isAppError(err);

  const statusCode = appError ? err.statusCode : 500;
  const code = appError ? (err.code ?? "APP_ERROR") : "INTERNAL_ERROR";
  const message = appError ? err.message : "Internal Server Error";

  // ✅ Server-side logging (do not leak to clients in prod)
  const logContext = {
    requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code,
  };

  if (appError) {
    // Expected errors: warn (not error)
    // Keep logs compact in prod; keep details in dev
    if (isProd) {
      console.warn("⚠️ AppError:", { ...logContext, message });
    } else {
      console.warn("⚠️ AppError:", { ...logContext, ...toLogObject(err) });
    }
  } else {
    // Unexpected errors: error
    if (isProd) {
      console.error("❌ Unhandled error:", { ...logContext, message: "Unhandled error" });
    } else {
      console.error("❌ Unhandled error:", { ...logContext, ...toLogObject(err) });
    }
  }

  const payload: ErrorPayload = {
    message,
    code,
    requestId,
  };

  // Only expose debug info in non-prod
  if (!isProd) {
    if (err instanceof Error) payload.stack = err.stack;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload.details = (err as any)?.details;
  }

  res.status(statusCode).json(payload);
}