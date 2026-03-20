import { z } from "zod";
import { router, protectedProcedure, chairmanProcedure } from "../index";
import { reviews } from "@drizzle/schema/reviews";
import { modules } from "@drizzle/schema/modules";
import { notifications } from "@drizzle/schema/notifications";
import { eq, and, desc } from "drizzle-orm";
import { notificationEmitter } from "@/lib/events";
import { recordScore, getModuleScoreType, recordActivity } from "@/lib/scoring";
import { escapeHtml } from "@/lib/escape-html";

export const reviewsRouter = router({
  // List reviews for a target (module)
  listByTarget: protectedProcedure
    .input(
      z.object({
        targetType: z.enum(["module", "task"]),
        targetId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.reviews.findMany({
        where: and(
          eq(reviews.targetType, input.targetType),
          eq(reviews.targetId, input.targetId)
        ),
        orderBy: [desc(reviews.createdAt)],
        with: {
          reviewer: {
            columns: { id: true, name: true, image: true },
          },
        },
      });
    }),

  // Get latest review for a target
  getLatest: protectedProcedure
    .input(
      z.object({
        targetType: z.enum(["module", "task"]),
        targetId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.reviews.findFirst({
        where: and(
          eq(reviews.targetType, input.targetType),
          eq(reviews.targetId, input.targetId)
        ),
        orderBy: [desc(reviews.createdAt)],
        with: {
          reviewer: {
            columns: { id: true, name: true, image: true },
          },
        },
      });
    }),

  // Submit review (Chairman/Admin only)
  submitReview: chairmanProcedure
    .input(
      z.object({
        targetType: z.enum(["module", "task"]),
        targetId: z.string(),
        status: z.enum(["approved", "changes_requested"]),
        note: z.string().optional(),
        metaData: z.string().optional(), // JSON string of rubric scores
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Insert review record
      const [review] = await ctx.db
        .insert(reviews)
        .values({
          targetType: input.targetType,
          targetId: input.targetId,
          reviewerId: ctx.user.id,
          status: input.status,
          note: input.note,
          metaData: input.metaData,
        })
        .returning();

      // Update module/task status based on review result
      if (input.targetType === "module") {
        const mod = await ctx.db.query.modules.findFirst({
          where: eq(modules.id, input.targetId),
          columns: {
            id: true,
            title: true,
            assigneeId: true,
            deadline: true,
          },
        });

        if (mod) {
          if (input.status === "approved") {
            // Set module to "done" and award score
            await ctx.db
              .update(modules)
              .set({ status: "done", updatedAt: new Date() })
              .where(eq(modules.id, input.targetId));

            if (mod.assigneeId) {
              const { eventType, points } = getModuleScoreType(mod.deadline);
              await recordScore(ctx.db, {
                userId: mod.assigneeId,
                eventType,
                points,
                refType: "module",
                refId: mod.id,
              });

              // Notify assignee of approval
              await ctx.db.insert(notifications).values({
                userId: mod.assigneeId,
                type: "review.approved",
                title: "Module Approved ✅",
                body: `Your module "${escapeHtml(mod.title)}" has been approved by ${escapeHtml(ctx.user.name)}`,
                link: `/modules/${mod.id}`,
              });
              notificationEmitter.emit("new_notification", mod.assigneeId);
            }
          } else {
            // Changes requested
            await ctx.db
              .update(modules)
              .set({ status: "changes_requested", updatedAt: new Date() })
              .where(eq(modules.id, input.targetId));

            if (mod.assigneeId) {
              await ctx.db.insert(notifications).values({
                userId: mod.assigneeId,
                type: "review.changes_requested",
                title: "Changes Requested 🔄",
                body: `Changes requested for module "${escapeHtml(mod.title)}" by ${escapeHtml(ctx.user.name)}${input.note ? `: ${escapeHtml(input.note)}` : ""}`,
                link: `/modules/${mod.id}`,
              });
              notificationEmitter.emit("new_notification", mod.assigneeId);
            }
          }
        }
      }

      await recordActivity(ctx.db, ctx.user.id);
      return review;
    }),
});
