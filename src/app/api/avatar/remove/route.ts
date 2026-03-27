import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { users } from "@drizzle/schema/users";
import { eq } from "drizzle-orm";
import { s3Client, MINIO_BUCKET, ensureBucket } from "@/lib/minio";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

export async function DELETE() {
  // 1. Auth check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Delete from MinIO
    await ensureBucket();
    const s3Key = `avatars/${session.user.id}.webp`;

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: s3Key,
      })
    ).catch(() => {
      // Non-fatal: file may not exist
    });

    // 3. Clear in database
    await db
      .update(users)
      .set({ avatarUrl: null, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[avatar/remove] Error:", error);
    return NextResponse.json(
      { error: "Failed to remove avatar" },
      { status: 500 }
    );
  }
}
