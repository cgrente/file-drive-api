import dotenv from "dotenv";

/**
 * Load environment variables **once**, at the very beginning of the process.
 *
 * Strategy:
 * - production  → use `.env`
 * - local/dev   → use `.env.local`
 *
 * IMPORTANT:
 * - This file must be the FIRST thing executed in the app.
 * - All config files (db, redis, aws, stripe, etc.) rely on process.env
 *   being populated at import time.
 */
dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env" : ".env.local",
});

import { startServer } from "./server";

/**
 * Application entrypoint.
 *
 * Responsibilities:
 * - Bootstrap the application
 * - Start the HTTP server
 * - Fail fast if something critical is misconfigured
 *
 * Any error here is considered fatal and should stop the process.
 */
(async () => {
  try {
    // Start the server (init clients, connect DB, listen on port, etc.)
    await startServer();
  } catch (error) {
    // Startup errors should NEVER be swallowed
    console.error("❌ Startup failed:", error);

    // Exit with non-zero code so:
    // - Docker restarts the container
    // - Kubernetes marks the pod as failed
    // - CI/CD fails loudly
    process.exit(1);
  }
})();