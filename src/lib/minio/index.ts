import { S3Client, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";

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
export const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || `http://${endPoint}:${port}/${MINIO_BUCKET}`;

// Auto-create bucket if it doesn't exist (runs once)
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
          console.log(`[MinIO] Bucket "${MINIO_BUCKET}" created successfully.`);
        } else {
          console.error(`[MinIO] Error checking bucket:`, err);
          bucketReady = null; // Reset so it retries next time
          throw err;
        }
      }
    })();
  }
  return bucketReady;
}
