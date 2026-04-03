import { z } from "zod";
import { router, protectedProcedure, chairmanProcedure } from "../index";
import { operations, operationStatusEnum } from "@drizzle/schema/operations";
import { eq, desc } from "drizzle-orm";
import { nextId } from "@/lib/id-gen";

export const operationsRouter = router({
  // Get all operations
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.operations.findMany({
      orderBy: (ops) => [desc(ops.createdAt)],
      with: {
        assignee: {
          columns: { id: true, name: true, email: true, image: true },
        },
      },
      limit: 500,
    });
  }),

  // Optional: Create an operation manually from panel
  create: chairmanProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().optional(),
        assigneeId: z.string().optional(),
        priority: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const newId = await nextId("OP", ctx.db);
      const [newOp] = await ctx.db
        .insert(operations)
        .values({
          id: newId,
          title: input.title,
          description: input.description,
          assigneeId: input.assigneeId,
          priority: input.priority || "medium",
          createdBy: ctx.user.id,
        })
        .returning();
      return newOp;
    }),

  // Update status
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(operationStatusEnum.enumValues),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.operations.findFirst({
        where: eq(operations.id, input.id),
      });
      if (!existing) throw new Error("Operation not found");

      const role = ctx.user.role as string;
      if (role !== "admin" && role !== "chairman" && existing.assigneeId !== ctx.user.id) {
        throw new Error("No permission to update this operations ticket");
      }

      const [updated] = await ctx.db
        .update(operations)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(operations.id, input.id))
        .returning();

      return updated;
    }),

  // Delete
  delete: chairmanProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(operations).where(eq(operations.id, input.id));
      return { success: true };
    }),
});
