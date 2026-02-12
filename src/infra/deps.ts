/**
 * Runtime dependency readiness tracking.
 *
 * This module acts as a **single source of truth** for the operational
 * status of external dependencies required by the API.
 *
 * It is intentionally:
 * - in-memory (process-scoped)
 * - synchronous
 * - mutable only through explicit setters
 *
 * Typical usage:
 * - MongoDB connection lifecycle updates `mongo`
 * - Redis connection lifecycle updates `redis`
 * - `/ready` endpoint reads from this module
 */

/**
 * Shape of the dependency readiness state.
 *
 * - mongo: database connectivity
 * - redis: cache / rate-limit / queue backend
 *
 * Extend this type if you later add:
 * - s3
 * - stripe
 * - kafka
 * - etc.
 */
export type DepsStatus = {
  mongo: boolean;
  redis: boolean;
};

/**
 * Internal mutable state.
 *
 * Defaults to `false` because:
 * - dependencies are NOT ready at process start
 * - they become ready only after successful initialization
 *
 * This object must NEVER be exported directly.
 */
const status: DepsStatus = {
  mongo: false,
  redis: false,
};

/**
 * Mark MongoDB as ready or not ready.
 *
 * Called from:
 * - server bootstrap (after successful connect)
 * - optional reconnect / shutdown logic
 */
export function setMongoReady(value: boolean): void {
  status.mongo = value;
}

/**
 * Mark Redis as ready or not ready.
 *
 * Called from:
 * - redis connection "ready" / "connect" events
 * - redis "error" / "end" events
 *
 * Redis may be optional in local/dev,
 * but its state is still tracked consistently.
 */
export function setRedisReady(value: boolean): void {
  status.redis = value;
}

/**
 * Read-only accessor for dependency readiness.
 *
 * Returns a shallow copy to:
 * - prevent accidental mutation
 * - keep the state encapsulated
 *
 * Used by:
 * - /ready endpoint
 * - tests
 * - observability hooks (if added later)
 */
export function getDepsStatus(): DepsStatus {
  return { ...status };
}

/**
 * (Optional – tests only)
 *
 * Reset all dependency states to "not ready".
 * Useful for integration tests that spin up / tear down services.
 *
 * Uncomment only if needed.
 */
// export function _resetDepsForTests(): void {
//   status.mongo = false;
//   status.redis = false;
// }