import { S3Client } from '@aws-sdk/client-s3';
import { requireEnv } from './env';

let s3Client: S3Client | null = null;

/**
 * Get the singleton S3 client.
 *
 * NOTE:
 * - dotenv is loaded once in the application entrypoint (src/index.ts).
 * - This module assumes process.env is already populated.
 */
export function getS3Client(): S3Client {
  if (s3Client) {
    return s3Client;
  }

  const awsRegion = requireEnv('AWS_REGION');
  const nodeEnv = process.env.NODE_ENV ?? 'production';
  const isLocal = nodeEnv === 'development' || nodeEnv === 'local';

  if (isLocal) {
    const accessKeyId = requireEnv('AWS_ACCESS_KEY_ID');
    const secretAccessKey = requireEnv('AWS_SECRET_ACCESS_KEY');

    s3Client = new S3Client({
      region: awsRegion,
      credentials: { accessKeyId, secretAccessKey },
    });
  } else {
    s3Client = new S3Client({ region: awsRegion });
  }

  // Match SES / Stripe logging behavior
  if (nodeEnv !== 'test') {
    console.log('✅ Initializing S3 client...');
  }

  return s3Client;
}

/**
 * Optional: allow tests to reset the singleton.
 */
export function _resetS3ClientForTests(): void {
  s3Client = null;
}