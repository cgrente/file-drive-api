import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getClients } from "../infra/clients";

/**
 * Production-grade S3 service for a presigned-URL architecture.
 *
 * Core rules:
 * - API never streams file bytes (client uploads/downloads directly to S3).
 * - API generates presigned URLs + performs server-side maintenance (delete/copy/move).
 * - MongoDB is the source of truth for file/folder metadata.
 */
class S3Service {
  /**
   * Cap presigned URL lifetime to reduce risk.
   * You can raise this if you have a strong reason.
   *
   * Note: AWS has service-specific max limits; 1 hour is a safe default.
   */
  private static readonly MAX_PRESIGN_SECONDS = 60 * 60; // 3600

  private get bucketName(): string {
    const configuredBucketName = process.env.S3_BUCKET_NAME;
    if (!configuredBucketName) {
      throw new Error("S3_BUCKET_NAME is not configured");
    }
    return configuredBucketName;
  }

  private get s3Client(): S3Client {
    return getClients().s3;
  }

  /**
   * Normalizes and caps presigned expiry.
   */
  private normalizeExpirySeconds(expiresInSeconds?: number): number {
    const requested = expiresInSeconds ?? S3Service.MAX_PRESIGN_SECONDS;

    if (!Number.isFinite(requested) || requested <= 0) {
      throw new Error("expiresInSeconds must be a positive number");
    }

    return Math.min(requested, S3Service.MAX_PRESIGN_SECONDS);
  }

  /**
   * Presigned URL for downloading an object (GET).
   */
  async presignDownload(objectKey: string, expiresInSeconds?: number): Promise<string> {
    if (!objectKey) throw new Error("Missing S3 object key");

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: this.normalizeExpirySeconds(expiresInSeconds),
    });
  }

  /**
   * Presigned URL for uploading an object (PUT).
   * If you provide contentType, the client MUST upload with that Content-Type.
   */
  async presignUpload(params: {
    key: string;
    contentType?: string;
    expiresInSeconds?: number;
  }): Promise<string> {
    const { key: objectKey, contentType, expiresInSeconds } = params;

    if (!objectKey) throw new Error("Missing S3 object key");

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
      ...(contentType ? { ContentType: contentType } : {}),
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: this.normalizeExpirySeconds(expiresInSeconds),
    });
  }

  /**
   * Delete a single object.
   */
  async deleteObject(objectKey: string): Promise<void> {
    if (!objectKey) return;

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      })
    );
  }

  /**
   * Delete multiple objects (batch).
   */
  async deleteObjects(objectKeys: string[]): Promise<void> {
    const filteredKeys = objectKeys.filter((key) => Boolean(key));
    if (filteredKeys.length === 0) return;

    await this.s3Client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: filteredKeys.map((key) => ({ Key: key })),
          Quiet: true,
        },
      })
    );
  }

  /**
   * Delete everything under a prefix (ex: "businessId/folders/<folderId>/").
   * Uses pagination safely.
   */
  async deletePrefix(prefix: string): Promise<void> {
    if (!prefix) return;

    let continuationToken: string | undefined;

    do {
      const listResponse = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );

      const objectKeys = (listResponse.Contents ?? [])
        .map((object) => object.Key)
        .filter((key): key is string => Boolean(key));

      if (objectKeys.length > 0) {
        await this.deleteObjects(objectKeys);
      }

      continuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  /**
   * Copy an object (server-side).
   * IMPORTANT: CopySource must be URL-encoded or copy can fail on special characters.
   */
  async copyObject(params: { sourceKey: string; destinationKey: string }): Promise<void> {
    const { sourceKey, destinationKey } = params;

    if (!sourceKey || !destinationKey) {
      throw new Error("Missing sourceKey or destinationKey");
    }

    // CopySource format is "bucket/key" and should be URL-encoded.
    // We encode only the key portion, not the slash between bucket and key.
    const encodedSource = `${this.bucketName}/${encodeURIComponent(sourceKey)}`;

    await this.s3Client.send(
      new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: encodedSource,
        Key: destinationKey,
      })
    );
  }

  /**
   * Move = copy then delete.
   */
  async moveObject(params: { sourceKey: string; destinationKey: string }): Promise<void> {
    await this.copyObject(params);
    await this.deleteObject(params.sourceKey);
  }
}

export default new S3Service();