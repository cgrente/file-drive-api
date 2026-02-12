import Stripe from "stripe";
import { requireEnv } from "./env";

let stripeClient: Stripe | null = null;

type StripeInitOptions = {
  /**
   * If you want to pin the Stripe API version, set it here.
   * If TypeScript complains, remove it and let Stripe default.
   */
  apiVersion?: Stripe.StripeConfig["apiVersion"];
};

function isProdLikeEnv(): boolean {
  const nodeEnv = process.env.NODE_ENV ?? "production";
  return nodeEnv === "production" || nodeEnv === "beta";
}

/**
 * Get the singleton Stripe client.
 *
 * Env:
 * - Prod/Beta: STRIPE_SECRET_KEY
 * - Dev/Test:  STRIPE_SECRET_KEY_TEST
 *
 * Notes:
 * - dotenv is loaded once in src/index.ts before imports.
 * - Initialize in server bootstrap, then reuse via getClients().
 */
export function getStripeClient(options: StripeInitOptions = {}): Stripe {
  if (stripeClient) return stripeClient;

  const nodeEnv = process.env.NODE_ENV ?? "production";
  const prodLike = isProdLikeEnv();
  const isTest = nodeEnv === "test";

  const secretKey = prodLike
    ? requireEnv("STRIPE_SECRET_KEY")
    : requireEnv("STRIPE_SECRET_KEY_TEST");

  if (!isTest) {
    console.log(`✅ Initializing Stripe client for NODE_ENV=${nodeEnv} (prodLike=${prodLike})`);
  }

  stripeClient = new Stripe(secretKey, {
    // apiVersion: options.apiVersion, // enable only if you want to pin
  });

  return stripeClient;
}

/**
 * Optional: allow tests to reset the singleton.
 */
export function _resetStripeClientForTests(): void {
  stripeClient = null;
}