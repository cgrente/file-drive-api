/**
 * Centralized CORS configuration.
 *
 * Supports:
 * - credentials (cookies / auth headers)
 * - multiple allowed origins
 * - strict production defaults
 *
 * Env:
 * - WEBAPP_URL           → single origin
 * - WEBAPP_URLS          → comma-separated list of origins (preferred)
 *
 * Example:
 * WEBAPP_URLS=https://app.example.com,https://admin.example.com
 */
import cors from "cors";

const nodeEnv = process.env.NODE_ENV ?? "production";

/**
 * Build allowed origins list.
 */
const allowedOrigins = (() => {
  if (process.env.WEBAPP_URLS) {
    return process.env.WEBAPP_URLS
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }

  if (process.env.WEBAPP_URL) {
    return [process.env.WEBAPP_URL.trim()];
  }

  // Local fallback
  return ["http://localhost:4200"];
})();

if (nodeEnv !== "production") {
  console.log("🌐 CORS allowed origins:", allowedOrigins);
}

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow server-to-server / curl / health checks
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },

  credentials: true,

  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Request-Id",
  ],
});