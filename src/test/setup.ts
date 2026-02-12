// test/setup.ts
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

import { beforeAll, afterAll } from "vitest";

/**
 * Global test setup (Vitest).
 *
 * Responsibilities:
 * - Load environment variables for the test process BEFORE importing app/server.
 * - Bootstrap shared infrastructure once (DB, Redis, etc.) if desired.
 * - Ensure clean teardown to avoid hanging CI processes.
 *
 * Notes:
 * - Do NOT define tests (it/expect) in this file.
 * - Keep this file side-effect oriented (setup/teardown only).
 */

// 1) Load env early (before importing modules that read process.env)
const envPath = path.resolve(process.cwd(), ".env.test");
const fallbackEnvPath = path.resolve(process.cwd(), ".env.local");

// Prefer .env.test; fallback to .env.local (useful if you don't commit .env.test)
dotenv.config({ path: fs.existsSync(envPath) ? envPath : fallbackEnvPath });

// Ensure NODE_ENV is test (some libs behave differently)
process.env.NODE_ENV = "test";

// 2) Import AFTER dotenv so config/env-dependent modules see correct values
import { startServer, stopServer } from "../server";

beforeAll(async () => {
  // Test-proof defaults in your server.ts:
  // - listen: false in NODE_ENV=test
  // - initThirdParty: false in NODE_ENV=test
  // - connectDb: true (unless you override)
  await startServer({
    // If you want pure unit tests without Mongo:
    // connectDb: false,
  });
});

afterAll(async () => {
  await stopServer();
});