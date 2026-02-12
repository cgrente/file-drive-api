// src/config/ses.config.ts
import { SESClient } from "@aws-sdk/client-ses";
import { requireEnv } from "./env";

let sesClient: SESClient | null = null;

/**
 * Get the singleton SES client.
 *
 * Env:
 * - AWS_REGION
 * - (dev/local only) AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *
 * Notes:
 * - In production, prefer IAM Roles / instance profiles (no static keys).
 * - dotenv is loaded once in src/index.ts, so process.env is ready here.
 */
export function getSESClient(): SESClient {
  if (sesClient) return sesClient;

  const awsRegion = requireEnv("AWS_REGION");
  const nodeEnv = process.env.NODE_ENV ?? "production";

  const isTest = nodeEnv === "test";
  const isLocalOrDev = nodeEnv === "local" || nodeEnv === "development";

  if (!isTest) {
    console.log(`✅ Initializing SES client for ${nodeEnv}...`);
  }

  if (isLocalOrDev) {
    const accessKeyId = requireEnv("AWS_ACCESS_KEY_ID");
    const secretAccessKey = requireEnv("AWS_SECRET_ACCESS_KEY");

    sesClient = new SESClient({
      region: awsRegion,
      credentials: { accessKeyId, secretAccessKey },
    });

    return sesClient;
  }

  // Production/beta/staging: rely on AWS default credential provider chain
  // (e.g., EC2/ECS task role, IRSA, etc.)
  sesClient = new SESClient({ region: awsRegion });

  return sesClient;
}

/**
 * Optional: allow tests to reset the singleton.
 */
export function _resetSESClientForTests(): void {
  sesClient = null;
}