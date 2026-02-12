/**
 * Tiny Redis-backed cache helper.
 *
 * Goals:
 * - Keep cache usage dead-simple (get/set JSON with TTL).
 * - Provide safe key building (stable, namespaced).
 * - Support invalidation by exact key or wildcard pattern.
 *
 * Notes:
 * - This module assumes redis.config.ts exports a singleton ioredis client.
 * - In local/dev, Redis might be optional; callers should be ready for null results.
 */
import redis from "../config/redis.config";

type KeyPart = string | number | null | undefined;

/**
 * Build a stable cache key:
 * - joins parts with ":"
 * - trims string parts
 * - lowercases for consistency
 *
 * IMPORTANT:
 * - We do NOT use `filter(Boolean)` because it would drop `0`,
 *   which is a valid value for ids/versions.
 */
function buildCacheKey(parts: KeyPart[]): string {
  const normalizedParts = parts
    .filter((part): part is string | number => part !== null && part !== undefined)
    .map((part) => String(part).trim())
    .filter((part) => part.length > 0)
    .map((part) => part.toLowerCase());

  return normalizedParts.join(":");
}

/**
 * Parse JSON safely:
 * - returns null if invalid JSON
 * - avoids throwing in hot paths
 */
function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const cache = {
  /**
   * Get a JSON value by key.
   *
   * @returns Parsed value or null if not found or invalid JSON.
   */
  async get<T>(key: string): Promise<T | null> {
    const rawValue = await redis.get(key);
    if (!rawValue) return null;
    return safeJsonParse<T>(rawValue);
  },

  /**
   * Set a JSON value with TTL (seconds).
   *
   * - TTL must be > 0
   * - value is JSON.stringify'd
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error("ttlSeconds must be a positive number");
    }

    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  },

  /**
   * Set only if the key doesn't already exist (NX).
   * Useful for simple locks / de-dupe / single-flight.
   *
   * @returns true if the key was set, false if it already existed.
   */
  async setIfAbsent(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error("ttlSeconds must be a positive number");
    }

    const result = await redis.set(key, JSON.stringify(value), "EX", ttlSeconds, "NX");
    return result === "OK";
  },

  /**
   * Delete by exact key or by wildcard pattern (e.g. "files-folders:123:*").
   *
   * Pattern delete uses SCAN (non-blocking) via scanStream.
   * This prevents large keyspaces from blocking Redis like KEYS would.
   */
  async del(patternOrKey: string): Promise<void> {
    if (!patternOrKey) return;

    const isPattern = patternOrKey.includes("*");
    if (!isPattern) {
      await redis.del(patternOrKey);
      return;
    }

    const scan = redis.scanStream({ match: patternOrKey, count: 200 });

    const keysToDelete: string[] = [];

    for await (const chunk of scan) {
      // ioredis yields string[] chunks
      keysToDelete.push(...(chunk as string[]));
    }

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }
  },

  /**
   * Convenience: delete multiple exact keys.
   */
  async delMany(keys: string[]): Promise<void> {
    const filteredKeys = keys.filter((key) => key && key.trim().length > 0);
    if (filteredKeys.length === 0) return;
    await redis.del(...filteredKeys);
  },

  /**
   * Key builder helper.
   *
   * Example:
   *   cache.key(["files-folders", businessId, folderId ?? "root"])
   */
  key(parts: KeyPart[]): string {
    return buildCacheKey(parts);
  },
};