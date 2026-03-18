import { z } from "zod";
import { router, protectedProcedure, chairmanProcedure } from "../index";
import { modules } from "@drizzle/schema/modules";
import { taskStatusEnum } from "@drizzle/schema/tasks";
import { eq, and } from "drizzle-orm";
import { nextId } from "@/lib/id-gen";

export const modulesRouter = router({
  // List modules by project
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const allModules = await ctx.db.query.modules.findMany({
        where: eq(modules.projectId, input.projectId),
        orderBy: (modules, { asc }) => [asc(modules.deadline), asc(modules.createdAt)],
        with: {
          assignee: {
            columns: { id: true, name: true, email: true },
          },
        },
      });
      return allModules;
    }),

  // Get single module
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const module = await ctx.db.query.modules.findFirst({
        where: eq(modules.id, input.id),
        with: {
          project: {
            columns: { title: true, chairmanId: true, status: true },
          },
          assignee: {
            columns: { id: true, name: true, email: true },
          },
        },
      });
      if (!module) throw new Error("Module not found");
      return module;
    }),

  // Create module (Chairman only)
  create: chairmanProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        assigneeId: z.string().optional(),
        deadline: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const newId = await nextId("MOD", ctx.db);

      const [newModule] = await ctx.db
        .insert(modules)
        .values({
          id: newId,
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          assigneeId: input.assigneeId,
          deadline: input.deadline ? new Date(input.deadline) : null,
        })
        .returning();

      return newModule;
    }),

  // Update module (Chairman only or Assignee if just updating status? Let's say chairman only for full edit)
  update: chairmanProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        assigneeId: z.string().optional(),
        deadline: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(modules)
        .set({
          ...(input.title && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.assigneeId !== undefined && { assigneeId: input.assigneeId }),
          ...(input.deadline !== undefined && { deadline: input.deadline ? new Date(input.deadline) : null }),
          updatedAt: new Date(),
        })
        .where(eq(modules.id, input.id))
        .returning();

      return updated;
    }),

  // Update status (Assignee can also update status!)
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(taskStatusEnum.enumValues),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Todo: Role check. Only chairman or assignee should modify.
      const [updated] = await ctx.db
        .update(modules)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(modules.id, input.id))
        .returning();
      return updated;
    }),

  // Delete module (Chairman only)
  delete: chairmanProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(modules).where(eq(modules.id, input.id));
      return { success: true };
    }),
});
