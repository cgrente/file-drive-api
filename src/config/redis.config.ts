// src/config/redis.config.ts
import Redis from "ioredis";
import { setRedisReady } from "../infra/deps";

const nodeEnv = process.env.NODE_ENV ?? "production";
const isLocal = nodeEnv === "local" || nodeEnv === "development";

const redisUrl = process.env.REDIS_URL;

const redis = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: isLocal ? null : 3,
      enableAutoPipelining: true,
    })
  : new Redis({
      host: process.env.REDIS_HOST ?? "127.0.0.1",
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: isLocal ? null : 3,
      enableAutoPipelining: true,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });

redis.on("connect", () => setRedisReady(true));
redis.on("ready", () => setRedisReady(true));
redis.on("end", () => {
  setRedisReady(false);
  console.warn("⚠️ Redis connection closed");
});

let lastLogAt = 0;
redis.on("error", (error) => {
  setRedisReady(false);
  const now = Date.now();
  if (now - lastLogAt > 5000) {
    lastLogAt = now;
    console.error("❌ Redis error", error instanceof Error ? error.message : String(error));
  }
});

export default redis;