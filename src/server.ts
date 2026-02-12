import type { Server } from "http";
import mongoose from "mongoose";

import app from "./app";
import connectDB from "./config/db.config";
import redis from "./config/redis.config";

import { retry } from "./utils/retry.utils";

// External service singletons (AWS / Stripe)
import { getS3Client } from "./config/s3.config";
import { getSESClient } from "./config/ses.config";
import { getStripeClient } from "./config/stripe.config";
import { setClients } from "./infra/clients";

/**
 * Options to make the bootstrap test-friendly.
 *
 * - listen: when false, we DO NOT bind a port (useful for supertest(app)).
 * - connectDb: allow tests to skip DB connection when they mock DB access.
 * - initThirdParty: allow tests to skip AWS/Stripe SDK initialization.
 */
export type StartServerOptions = {
  listen?: boolean;
  connectDb?: boolean;
  initThirdParty?: boolean;
  port?: number;
};

const DEFAULT_OPTIONS: Required<StartServerOptions> = {
  listen: true,
  connectDb: true,
  initThirdParty: true,
  port: Number(process.env.PORT ?? 5000),
};

/**
 * Initialize third-party clients (AWS, Stripe, etc.)
 *
 * Why this exists:
 * - Centralizes external SDK initialization
 * - Ensures singletons are created exactly once
 * - Fails fast if credentials / env vars are invalid
 *
 * IMPORTANT:
 * - Must be called BEFORE the server starts accepting traffic
 */
function initializeThirdPartyClients(): void {
  setClients({
    s3: getS3Client(),
    ses: getSESClient(),
    stripe: getStripeClient(),
  });
}

/**
 * Connect to MongoDB with optional retry logic.
 *
 * Behavior:
 * - local / dev / test → fail fast (surface config errors immediately)
 * - beta / prod        → retry with exponential backoff
 */
async function connectDbWithRetry(): Promise<void> {
  const nodeEnv = process.env.NODE_ENV ?? "production";
  const shouldRetry = nodeEnv === "production" || nodeEnv === "beta";

  if (!shouldRetry) {
    await connectDB();
    return;
  }

  await retry(
    async () => {
      await connectDB();
    },
    {
      attempts: 8,
      baseDelayMs: 500,
      maxDelayMs: 10_000,
      factor: 2,
      onRetry: ({ attempt, delayMs, error }) => {
        console.error(
          `❌ DB connect failed (attempt ${attempt}). Retrying in ${delayMs}ms...`,
          error
        );
      },
    }
  );
}

/**
 * Close Mongo + Redis (used by graceful shutdown AND tests).
 *
 * - In tests: call stopServer(server) in afterAll()
 * - In prod: called when SIGTERM / SIGINT
 */
export async function closeDependencies(): Promise<void> {
  // Close MongoDB connection
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      if (process.env.NODE_ENV !== "test") console.log("✅ Mongo connection closed.");
    }
  } catch (error) {
    console.error("❌ Failed to close Mongo connection:", error);
  }

  // Close Redis connection
  try {
    // ioredis: quit() sends QUIT for clean shutdown; may throw if not connected
    await redis.quit();
    if (process.env.NODE_ENV !== "test") console.log("✅ Redis connection closed.");
  } catch (error) {
    // In local/test, Redis may be optional or not running.
    if (process.env.NODE_ENV !== "test") {
      console.error("❌ Failed to close Redis connection:", error);
    }
  }
}

/**
 * Graceful shutdown handler.
 *
 * Order matters:
 * 1) Stop accepting new HTTP requests
 * 2) Close MongoDB connection
 * 3) Close Redis connection
 * 4) Exit process cleanly
 */
async function shutdownGracefully(server: Server, signal: string): Promise<void> {
  console.log(`👋 ${signal} received. Closing gracefully...`);

  // 1) Stop accepting new connections
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  console.log("✅ HTTP server closed.");

  // 2/3) Close dependencies
  await closeDependencies();

  process.exit(0);
}

/**
 * Stop helper for tests.
 * - Closes the HTTP server (if provided)
 * - Closes Mongo + Redis
 */
export async function stopServer(server?: Server): Promise<void> {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await closeDependencies();
}

/**
 * Application bootstrap (test-proof).
 *
 * Key test behaviors:
 * - NODE_ENV=test defaults:
 *   - initThirdParty: false (avoids requiring AWS/Stripe env)
 *   - listen: false (so you can use supertest(app) without binding a port)
 *
 * You can override via startServer({ listen: true }) if you want an actual port.
 */
export async function startServer(options: StartServerOptions = {}): Promise<Server | null> {
  const nodeEnv = process.env.NODE_ENV ?? "production";
  const isTest = nodeEnv === "test";

  const merged: Required<StartServerOptions> = {
    ...DEFAULT_OPTIONS,
    // sensible test defaults (can be overridden explicitly)
    listen: isTest ? false : DEFAULT_OPTIONS.listen,
    initThirdParty: isTest ? false : DEFAULT_OPTIONS.initThirdParty,
    connectDb: DEFAULT_OPTIONS.connectDb,
    ...options,
    port: options.port ?? (isTest ? 0 : DEFAULT_OPTIONS.port),
  };

  if (isTest) {
    // Useful marker in test logs
    console.log("🧪 Running in TEST mode (server bootstrap)");
  }

  // ✅ In tests, skip AWS/Stripe unless you explicitly enable it.
  if (merged.initThirdParty) {
    initializeThirdPartyClients();
  }

  // ✅ Most test suites still want DB; but you can skip if you mock DB access.
  if (merged.connectDb) {
    await connectDbWithRetry();
    if (!isTest) console.log("✅ Database connected");
  }

  // ✅ In tests, default is: do NOT listen.
  if (!merged.listen) {
    return null;
  }

  const server = app.listen(merged.port, () => {
    if (!isTest) console.log(`🚀 Server running on port ${merged.port}`);
  });

  // Register graceful shutdown hooks only when actually listening
  process.on("SIGTERM", () => void shutdownGracefully(server, "SIGTERM"));
  process.on("SIGINT", () => void shutdownGracefully(server, "SIGINT"));

  return server;
}