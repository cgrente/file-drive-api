// src/errors/app.errors.ts

/**
 * Typed application error (operational error).
 *
 * Use this for expected failures:
 * - validation errors
 * - auth/permission errors
 * - not found
 * - business rule violations
 *
 * Unexpected errors should be handled as 500 by the global error handler.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: unknown;

  /**
   * Helps your global error handler decide if it's safe to show `message` to the client.
   * For AppError, this is always true.
   */
  public readonly isOperational: boolean = true;

  constructor(params: {
    message: string;
    statusCode?: number; // e.g. 400, 401, 403, 404, 409, 422, 429, 500
    code?: string;       // stable machine-readable code: "FILE_NOT_FOUND", etc.
    details?: unknown;   // extra debug context (never trust user input)
    cause?: unknown;     // original error (wrapped)
  }) {
    super(params.message);

    this.name = "AppError";
    this.statusCode = params.statusCode ?? 400;
    this.code = params.code;
    this.details = params.details;

    // Node supports Error.cause; keep it without breaking older runtimes.
    if (params.cause !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).cause = params.cause;
    }

    Error.captureStackTrace?.(this, this.constructor);
  }
}