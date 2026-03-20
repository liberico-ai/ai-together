import { z } from "zod";
import { router, protectedProcedure } from "../index";
import { documents } from "@drizzle/schema/documents";
import { modules } from "@drizzle/schema/modules";
import { tasks } from "@drizzle/schema/tasks";
import { eq, and, inArray } from "drizzle-orm";
import { s3Client, MINIO_BUCKET, MINIO_PUBLIC_URL } from "@/lib/minio";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const documentsRouter = router({
  // 1. Generate Presigned URL for direct-to-S3 Upload
  getPresignedUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        targetType: z.enum(["project", "module", "task"]),
        targetId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Secure random file name to avoid collisions
      const ext = input.filename.split('.').pop();
      const s3Key = `${input.targetType}/${input.targetId}/${crypto.randomUUID()}.${ext}`;

      const command = new PutObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: s3Key,
        ContentType: input.contentType,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return { presignedUrl, s3Key };
    }),

  // 2. Confirm Upload (Save record to DB)
  confirmUpload: protectedProcedure
    .input(z.object({
      title: z.string(),
      s3Key: z.string(),
      fileSize: z.number().optional(),
      targetType: z.enum(["project", "module", "task"]),
      targetId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // The public URL to access the file
      const url = `${MINIO_PUBLIC_URL}/${input.s3Key}`;
      
      const [doc] = await ctx.db.insert(documents).values({
        title: input.title,
        type: "file",
        url: url,
        fileSize: input.fileSize,
        targetType: input.targetType,
        targetId: input.targetId,
        uploadedBy: ctx.user.id,
      }).returning();
      
      return doc;
    }),

  // 3. Attach External Link (e.g., Google Drive, Figma)
  attachLink: protectedProcedure
    .input(z.object({
      title: z.string(),
      url: z.string().url(),
      targetType: z.enum(["project", "module", "task"]),
      targetId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [doc] = await ctx.db.insert(documents).values({
        title: input.title,
        type: "link",
        url: input.url,
        targetType: input.targetType,
        targetId: input.targetId,
        uploadedBy: ctx.user.id,
      }).returning();
      return doc;
    }),

  // 4. List Documents for a specific target (with bubbling logic)
  listByTarget: protectedProcedure
    .input(z.object({
      targetType: z.enum(["project", "module", "task"]),
      targetId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const targetIds = [input.targetId];
      const targetTypes = [input.targetType];

      // File Bubbling Logic: Parents see children's documents
      if (input.targetType === "project") {
        const mods = await ctx.db.query.modules.findMany({ where: eq(modules.projectId, input.targetId), columns: { id: true } });
        const modIds = mods.map(m => m.id);
        if (modIds.length > 0) {
          const tsks = await ctx.db.query.tasks.findMany({ where: inArray(tasks.moduleId, modIds), columns: { id: true } });
          targetTypes.push("module", "task");
          targetIds.push(...modIds, ...tsks.map(t => t.id));
        }
      } else if (input.targetType === "module") {
        const tsks = await ctx.db.query.tasks.findMany({ where: eq(tasks.moduleId, input.targetId), columns: { id: true } });
        if (tsks.length > 0) {
          targetTypes.push("task");
          targetIds.push(...tsks.map(t => t.id));
        }
      }

      return await ctx.db.query.documents.findMany({
        where: and(
          inArray(documents.targetType, targetTypes),
          inArray(documents.targetId, targetIds)
        ),
        orderBy: (docs, { desc }) => [desc(docs.createdAt)],
        with: {
          uploader: {
            columns: { id: true, name: true, email: true }
          }
        }
      });
    }),

  // 5. Delete Document
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.query.documents.findFirst({ where: eq(documents.id, input.id) });
      if (!doc) throw new Error("Document not found");

      // Role check: only uploader or chairman/admin can delete
      if (doc.uploadedBy !== ctx.user.id && ctx.user.role !== "chairman" && ctx.user.role !== "admin") {
         throw new Error("Unauthorized to delete this document");
      }

      // If it's a file, delete from S3
      if (doc.type === "file") {
        const s3Key = doc.url.split(`${MINIO_PUBLIC_URL}/`)[1];
        if (s3Key) {
           await s3Client.send(new DeleteObjectCommand({
             Bucket: MINIO_BUCKET,
             Key: s3Key,
           })).catch(console.error); // Do not throw if S3 delete fails (e.g already deleted)
        }
      }

      await ctx.db.delete(documents).where(eq(documents.id, input.id));
      return { success: true };
    }),
});
