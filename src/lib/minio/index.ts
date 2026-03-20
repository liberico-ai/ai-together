import { S3Client, HeadBucketCommand, CreateBucketCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";

const endPoint = process.env.MINIO_ENDPOINT || "127.0.0.1";
const port = process.env.MINIO_PORT || "9000";
const accessKey = process.env.MINIO_ACCESS_KEY || "minioadmin";
const secretKey = process.env.MINIO_SECRET_KEY || "minioadmin123";

// We use http for local dev
export const s3Client = new S3Client({
  region: "us-east-1", // MinIO doesn't care but AWS SDK requires it
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
  },
  endpoint: `http://${endPoint}:${port}`,
  forcePathStyle: true, // Required for MinIO
});

export const MINIO_BUCKET = process.env.MINIO_BUCKET || "libe-aios";

// Base URL for public file access (without bucket name)
const rawPublicUrl = process.env.MINIO_PUBLIC_URL || `http://${endPoint}:${port}`;

/**
 * Build the full public URL for a given S3 key.
 * Always includes the bucket name in the path so MinIO can resolve it correctly.
 */
export function getPublicUrl(s3Key: string): string {
  const base = rawPublicUrl.replace(/\/+$/, ""); // trim trailing slashes
  return `${base}/${MINIO_BUCKET}/${s3Key}`;
}

// Keep legacy export for backward compat (but prefer getPublicUrl)
export const MINIO_PUBLIC_URL = rawPublicUrl;

// Auto-create bucket + set public-read policy (runs once)
let bucketReady: Promise<void> | null = null;

export function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      try {
        await s3Client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }));
        console.log(`[MinIO] Bucket "${MINIO_BUCKET}" exists.`);
      } catch (err: any) {
        if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
          console.log(`[MinIO] Bucket "${MINIO_BUCKET}" not found, creating...`);
          await s3Client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }));
          console.log(`[MinIO] Bucket "${MINIO_BUCKET}" created.`);
        } else {
          console.error(`[MinIO] Error checking bucket:`, err);
          bucketReady = null;
          throw err;
        }
      }

      // Always ensure public-read policy is set
      try {
        const policy = JSON.stringify({
          Version: "2012-10-17",
          Statement: [{
            Sid: "PublicRead",
            Effect: "Allow",
            Principal: "*",
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${MINIO_BUCKET}/*`],
          }],
        });
        await s3Client.send(new PutBucketPolicyCommand({ Bucket: MINIO_BUCKET, Policy: policy }));
        console.log(`[MinIO] Public-read policy set on "${MINIO_BUCKET}".`);
      } catch (policyErr) {
        console.warn(`[MinIO] Could not set bucket policy:`, policyErr);
        // Non-fatal: upload still works, downloads may require auth
      }
    })();
  }
  return bucketReady;
}

