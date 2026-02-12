/**
 * Sleep helper.
 * Used between retry attempts to pause execution.
 */
function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Apply jitter to a delay to avoid thundering herd problems.
 *
 * Why jitter?
 * - When many instances retry at the same time (DB down, Redis restart),
 *   they would otherwise all retry simultaneously.
 * - Jitter randomizes delays to spread retries over time.
 *
 * Strategy:
 * - +/- 20% randomness around the base delay.
 */
function applyJitter(baseDelayMs: number): number {
  const jitterRange = baseDelayMs * 0.2; // 20%
  const randomizedDelay =
    baseDelayMs - jitterRange + Math.random() * (jitterRange * 2);

  return Math.max(0, Math.floor(randomizedDelay));
}

/**
 * Retry configuration options.
 */
export type RetryOptions = {
  /**
   * Maximum number of attempts (including the first try).
   * Example: 5 → 1 initial attempt + 4 retries.
   */
  attempts: number;

  /**
   * Initial delay before the first retry (in milliseconds).
   * Example: 500
   */
  baseDelayMs: number;

  /**
   * Upper bound for the delay (prevents unbounded backoff).
   * Example: 5000
   */
  maxDelayMs: number;

  /**
   * Exponential backoff factor.
   * Example:
   * - baseDelayMs = 500
   * - factor = 2
   * → delays: 500 → 1000 → 2000 → 4000 (capped by maxDelayMs)
   */
  factor: number;

  /**
   * Optional hook called before each retry.
   * Useful for logging or metrics.
   */
  onRetry?: (info: {
    attempt: number;
    delayMs: number;
    error: unknown;
  }) => void;
};

/**
 * Retry an async operation with exponential backoff + jitter.
 *
 * Behavior:
 * - Calls `fn()` immediately.
 * - If it fails, retries up to `attempts`.
 * - Uses exponential backoff capped at `maxDelayMs`.
 * - Adds jitter to prevent synchronized retries.
 *
 * IMPORTANT:
 * - This function does NOT swallow errors.
 * - The last error is always re-thrown after final attempt.
 *
 * Typical use cases:
 * - Database connection on startup
 * - Redis connection
 * - External API calls
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      // Attempt the operation
      return await operation();
    } catch (error) {
      lastError = error;

      // Stop retrying if we've exhausted all attempts
      if (attempt === options.attempts) {
        break;
      }

      // Exponential backoff calculation
      const exponentialDelay = Math.min(
        options.maxDelayMs,
        options.baseDelayMs * Math.pow(options.factor, attempt - 1)
      );

      // Apply jitter to avoid retry storms
      const delayMs = applyJitter(exponentialDelay);

      // Optional callback for logging / metrics
      options.onRetry?.({
        attempt,
        delayMs,
        error,
      });

      // Wait before next retry
      await sleep(delayMs);
    }
  }

  // Re-throw the last encountered error
  throw lastError;
}