import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { users } from "@drizzle/schema/users";
import { eq } from "drizzle-orm";
import { s3Client, MINIO_BUCKET, getPublicUrl, ensureBucket } from "@/lib/minio";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

export const dynamic = "force-dynamic";

// Allow large uploads (no file size limit per requirements)
export const config = {
  api: { bodyParser: false },
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "image/tiff"];
const AVATAR_SIZE = 256; // px — final avatar dimensions

export async function POST(request: NextRequest) {
  // 1. Auth check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 3. Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, GIF, WebP, BMP, TIFF` },
        { status: 400 }
      );
    }

    // 4. Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // 5. Compress with sharp: resize to 256x256, convert to WebP
    const compressedBuffer = await sharp(inputBuffer)
      .resize(AVATAR_SIZE, AVATAR_SIZE, {
        fit: "cover",
        position: "center",
      })
      .webp({ quality: 80 })
      .toBuffer();

    // 6. Upload to MinIO
    await ensureBucket();
    const s3Key = `avatars/${session.user.id}.webp`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: s3Key,
        Body: compressedBuffer,
        ContentType: "image/webp",
      })
    );

    // 7. Update database — add cache-busting timestamp to URL
    const avatarUrl = `${getPublicUrl(s3Key)}?t=${Date.now()}`;

    await db
      .update(users)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ avatarUrl });
  } catch (error) {
    console.error("[avatar/upload] Error:", error);
    return NextResponse.json(
      { error: "Failed to process avatar" },
      { status: 500 }
    );
  }
}
