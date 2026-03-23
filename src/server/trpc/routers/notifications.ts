import { z } from "zod";
import { router, protectedProcedure } from "../index";
import { notifications } from "@drizzle/schema/notifications";
import { eq, desc, and, sql } from "drizzle-orm";

export const notificationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.notifications.findMany({
      where: eq(notifications.userId, ctx.user.id),
      orderBy: [desc(notifications.createdAt)],
      limit: 50, // Keep it lightweight
    });
  }),
  
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, ctx.user.id),
          eq(notifications.isRead, false)
        )
      );
    return result[0]?.count ?? 0;
  }),

  markAsRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(notifications)
        .set({ isRead: true })
        .where(
           and(
               eq(notifications.id, input.id),
               eq(notifications.userId, ctx.user.id)
           )
        );
      return { success: true };
    }),

  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(notifications)
      .set({ isRead: true })
      .where(
          and(
              eq(notifications.userId, ctx.user.id),
              eq(notifications.isRead, false)
          )
      );
    return { success: true };
  }),
});
