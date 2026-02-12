/**
 * Express rate limiting.
 *
 * - In beta/prod: uses Redis store (cluster-safe).
 * - In local/dev: Redis is optional; if Redis is down, falls back to in-memory store.
 */
import rateLimit, { type Options } from "express-rate-limit";
import { RedisStore, type RedisReply, type SendCommandFn } from "rate-limit-redis";
import redis from "../config/redis.config";
import { getDepsStatus } from "../infra/deps";

function isLocalOrDev(): boolean {
  const nodeEnv = process.env.NODE_ENV ?? "production";
  return nodeEnv === "local" || nodeEnv === "development";
}

/**
 * Build a typed sendCommand adapter for ioredis.
 *
 * rate-limit-redis passes raw args like: ["INCR", "key"] or ["PEXPIRE", "key", "1000"].
 * ioredis supports: redis.call(commandName, ...args)
 *
 * NOTE:
 * ioredis types often return Promise<unknown>, so we cast once here.
 */
function buildSendCommand(): SendCommandFn {
  return async (...command: string[]): Promise<RedisReply> => {
    const [commandName, ...commandArgs] = command;

    // ioredis `.call()` works well for raw commands.
    // It is typed as Promise<unknown> in some versions, but runtime returns Redis reply types.
    const reply = await redis.call(commandName, ...commandArgs);

    return reply as RedisReply;
  };
}

function buildRedisStore(): RedisStore {
  return new RedisStore({
    sendCommand: buildSendCommand(),
  });
}

function buildOptions(): Partial<Options> {
  return {
    windowMs: 15 * 60 * 1000, // 15 minutes

    // Depending on express-rate-limit version, use either `limit` (new) or `max` (old).
    // If TS complains, switch to `max: 1000`.
    limit: 1000,

    standardHeaders: true,
    legacyHeaders: false,

    /**
     * Consistent JSON response for throttling.
     * (rate-limit uses handler instead of throwing)
     */
    handler: (req, res) => {
      res.status(429).json({
        message: "Too many requests, please try again later.",
        code: "RATE_LIMITED",
        requestId: (req as any).requestId,
      });
    },
  };
}

/**
 * Build a rate limiter that:
 * - uses Redis store when available
 * - falls back to memory store in local/dev if Redis isn't ready
 */
function createRateLimiter() {
  const baseOptions = buildOptions();
  const localOrDev = isLocalOrDev();

  const deps = getDepsStatus();
  const redisReady = deps.redis === true;

  // In local/dev: only use Redis store if Redis is actually ready.
  // In beta/prod: prefer Redis store (your /ready will show if Redis isn't reachable).
  const shouldUseRedisStore = redisReady || !localOrDev;

  if (!shouldUseRedisStore) {
    return rateLimit({
      ...baseOptions,
    });
  }

  return rateLimit({
    ...baseOptions,
    store: buildRedisStore(),
  });
}

export const rateLimiter = createRateLimiter();