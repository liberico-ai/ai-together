import { z } from "zod";
import { router, protectedProcedure } from "../index";
import { comments } from "@drizzle/schema/comments";
import { notifications } from "@drizzle/schema/notifications";
import { modules } from "@drizzle/schema/modules";
import { users } from "@drizzle/schema/users";
import { eq, and, inArray } from "drizzle-orm";
import { notificationEmitter } from "@/lib/events";
import { recordScore, SCORE_POINTS } from "@/lib/scoring";
import { escapeHtml } from "@/lib/escape-html";

/** Extract @mentions from comment content. Matches **@username** pattern */
function extractMentions(content: string): string[] {
  const mentionRegex = /\*\*@(\w+(?:\s\w+)*)\*\*/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]); // e.g. "admin" from **@admin**
  }
  return mentions;
}

export const commentsRouter = router({
  listByTarget: protectedProcedure
    .input(z.object({
      targetType: z.enum(["module", "task"]),
      targetId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.comments.findMany({
        where: and(
          eq(comments.targetType, input.targetType),
          eq(comments.targetId, input.targetId)
        ),
        orderBy: (comments, { asc }) => [asc(comments.createdAt)],
        limit: 100,
        with: {
          author: { columns: { id: true, name: true, image: true } }
        }
      });
    }),

  create: protectedProcedure
    .input(z.object({
      targetType: z.enum(["module", "task"]),
      targetId: z.string(),
      content: z.string().min(1).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const [newComment] = await ctx.db.insert(comments).values({
        targetType: input.targetType,
        targetId: input.targetId,
        content: input.content,
        authorId: ctx.user.id,
      }).returning();

      // 1. Notify module assignee (if not self)
      let notifyUserId: string | null = null;
      let notificationLink: string | null = null;
      let targetTitle: string = "";

      if (input.targetType === "module") {
        const mod = await ctx.db.query.modules.findFirst({ where: eq(modules.id, input.targetId) });
        if (mod && mod.createdBy && mod.createdBy !== ctx.user.id) {
          notifyUserId = mod.createdBy;
          targetTitle = mod.title;
          notificationLink = `/modules/${mod.id}`;
        }
      }

      if (notifyUserId) {
        await ctx.db.insert(notifications).values({
          userId: notifyUserId,
          type: "comment.new",
          title: "New Comment",
          body: `${escapeHtml(ctx.user.name)} commented on "${escapeHtml(targetTitle)}"`,
          link: notificationLink,
        });
        notificationEmitter.emit("new_notification", notifyUserId);
      }

      // 2. Parse @mentions and notify mentioned users
      const mentionNames = extractMentions(input.content);
      if (mentionNames.length > 0) {
        // NEW-03 FIX: Batch lookup all mentioned users in ONE query using inArray
        const mentionedUsers = await ctx.db.query.users.findMany({
          where: inArray(users.username, mentionNames),
          columns: { id: true, name: true },
        });

        const link = input.targetType === "module" ? `/modules/${input.targetId}` : null;
        for (const mu of mentionedUsers) {
          // Don't double-notify the assignee or self
          if (mu.id === ctx.user.id || mu.id === notifyUserId) continue;
          await ctx.db.insert(notifications).values({
            userId: mu.id,
            type: "comment.mention",
            title: "You were mentioned 💬",
            body: `${escapeHtml(ctx.user.name)} mentioned you in a comment`,
            link,
          });
          notificationEmitter.emit("new_notification", mu.id);
        }
      }

      // 3. Auto-Score — +1 for commenting
      await recordScore(ctx.db, {
        userId: ctx.user.id,
        eventType: "comment",
        points: SCORE_POINTS.COMMENT,
        refType: "comment",
        refId: newComment.id,
      });

      return newComment;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
       const comment = await ctx.db.query.comments.findFirst({ where: eq(comments.id, input.id) });
       if (!comment) throw new Error("Comment not found");
       
       if (comment.authorId !== ctx.user.id && ctx.user.role !== "chairman" && ctx.user.role !== "admin") {
          throw new Error("Unauthorized to delete this comment");
       }
       await ctx.db.delete(comments).where(eq(comments.id, input.id));
       return { success: true };
    })
});
