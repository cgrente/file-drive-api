import pinoHttp from "pino-http";
import { randomUUID } from "crypto";

/**
 * HTTP request logging middleware (pino-http).
 *
 * Responsibilities:
 * - Attach a request ID for traceability
 * - Assign meaningful log levels
 * - Avoid log noise for health checks
 */
export const logging = pinoHttp({
  /**
   * Generate or reuse a request ID.
   */
  genReqId: (request) => {
    const headerRequestId = request.headers["x-request-id"];

    if (typeof headerRequestId === "string" && headerRequestId.trim() !== "") {
      return headerRequestId;
    }

    return randomUUID();
  },

  /**
   * Skip noisy endpoints.
   */
  autoLogging: {
    ignore: (request) => {
      const requestUrl = request.url ?? "";
      return (
        requestUrl.startsWith("/api/health") ||
        requestUrl.startsWith("/api/ready")
      );
    },
  },

  /**
   * Choose log level based on HTTP status.
   */
  customLogLevel: (response, error) => {
    const statusCode = response.statusCode ?? 500;

    if (error || statusCode >= 500) {
      return "error";
    }

    if (statusCode >= 400) {
      return "warn";
    }

    return "info";
  },

  /**
   * Success log message.
   */
  customSuccessMessage: (request, response) => {
    const statusCode = response.statusCode ?? 200;
    return `${request.method} ${request.url} -> ${statusCode}`;
  },

  /**
   * Error log message.
   */
  customErrorMessage: (request, response, error) => {
    const statusCode = response.statusCode ?? 500;
    const errorMessage = error?.message ?? "unknown error";

    return `${request.method} ${request.url} -> ${statusCode} (${errorMessage})`;
  },
});