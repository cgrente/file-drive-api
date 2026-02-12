import type { S3Client } from "@aws-sdk/client-s3";
import type { SESClient } from "@aws-sdk/client-ses";
import type Stripe from "stripe";

/**
 * Central registry for third-party SDK clients.
 *
 * This module exists to:
 * - ensure **singletons** for heavy SDKs (S3, SES, Stripe)
 * - guarantee **initialization order** (fail fast on startup)
 * - avoid hidden imports that create clients implicitly
 *
 * IMPORTANT:
 * - Clients MUST be initialized once during bootstrap (server.ts)
 * - Application code MUST only read clients via `getClients()`
 */

/**
 * Shape of all external clients used by the application.
 *
 * Add new clients here if needed:
 * - redis (if you ever expose it this way)
 * - kafka
 * - elasticsearch
 * - etc.
 */
export type Clients = {
  s3: S3Client;
  ses: SESClient;
  stripe: Stripe;
};

/**
 * Internal singleton holder.
 *
 * It is intentionally:
 * - module-scoped
 * - mutable only via `setClients`
 * - inaccessible directly from other modules
 *
 * This guarantees:
 * - exactly one instance per process
 * - explicit lifecycle control
 */
let clients: Clients | null = null;

/**
 * Initialize all external clients.
 *
 * Called **once** during application bootstrap
 * (typically in `server.ts`, before the server starts listening).
 *
 * Fails fast if called incorrectly or overridden unintentionally.
 */
export function setClients(next: Clients): void {
  clients = next;
}

/**
 * Read-only accessor for initialized clients.
 *
 * Throws immediately if accessed before initialization.
 *
 * This is intentional:
 * - prevents subtle bugs caused by lazy initialization
 * - surfaces configuration errors early
 * - avoids partial startup in broken environments
 */
export function getClients(): Clients {
  if (!clients) {
    throw new Error(
      "Clients not initialized. Did you forget to call setClients() during bootstrap?"
    );
  }
  return clients;
}

/**
 * TESTING ONLY.
 *
 * Resets the client registry.
 * Useful for:
 * - unit tests
 * - integration tests
 * - isolated test environments
 *
 * MUST NOT be used in production code paths.
 */
export function _resetClientsForTests(): void {
  clients = null;
}