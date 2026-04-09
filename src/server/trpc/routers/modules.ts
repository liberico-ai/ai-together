import { z } from "zod";
import { router, protectedProcedure } from "../index";
import { modules } from "@drizzle/schema/modules";
import { eq, and } from "drizzle-orm";
import { projectMembers } from "@drizzle/schema/projects";
import { nextId } from "@/lib/id-gen";

const checklistItemSchema = z.object({
  text: z.string().min(1),
  done: z.boolean(),
});

export const modulesRouter = router({
  // List modules by project
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.modules.findMany({
        where: eq(modules.projectId, input.projectId),
        orderBy: (modules, { asc }) => [asc(modules.createdAt)],
      });
    }),

  // Get single module
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const module = await ctx.db.query.modules.findFirst({
        where: eq(modules.id, input.id),
        with: {
          project: {
            columns: { id: true, title: true, chairmanId: true, status: true },
          },
        },
      });
      if (!module) throw new Error("Module not found");
      return module;
    }),

  // Create module
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1).max(200),
        description: z.string().max(10000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user is a project member (or admin/chairman)
      const isMember = await ctx.db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, input.projectId),
          eq(projectMembers.userId, ctx.user.id)
        ),
      });
      if (!isMember && ctx.user.role !== "admin" && ctx.user.role !== "chairman") {
        throw new Error("You must be a project member to create modules");
      }

      const newId = await nextId("MOD", ctx.db);

      const [newModule] = await ctx.db
        .insert(modules)
        .values({
          id: newId,
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          createdBy: ctx.user.id,
        })
        .returning();

      return newModule;
    }),

  // Update module (admin/chairman/creator only)
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.modules.findFirst({
        where: eq(modules.id, input.id),
        columns: { createdBy: true },
      });
      if (!existing) throw new Error("Module not found");

      const isAllowed =
        ctx.user.role === "admin" ||
        ctx.user.role === "chairman" ||
        existing.createdBy === ctx.user.id;
      if (!isAllowed) {
        throw new Error("You don't have permission to edit this module");
      }

      const [updated] = await ctx.db
        .update(modules)
        .set({
          ...(input.title && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          updatedAt: new Date(),
        })
        .where(eq(modules.id, input.id))
        .returning();

      return updated;
    }),

  // Update checklist
  updateChecklist: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        checklist: z.array(checklistItemSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(modules)
        .set({
          checklist: input.checklist,
          updatedAt: new Date(),
        })
        .where(eq(modules.id, input.id))
        .returning();

      return updated;
    }),

  // Delete module (admin/chairman/creator only)
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.modules.findFirst({
        where: eq(modules.id, input.id),
        columns: { createdBy: true },
      });
      if (!existing) throw new Error("Module not found");

      const isAllowed =
        ctx.user.role === "admin" ||
        ctx.user.role === "chairman" ||
        existing.createdBy === ctx.user.id;
      if (!isAllowed) {
        throw new Error("You don't have permission to delete this module");
      }

      await ctx.db.delete(modules).where(eq(modules.id, input.id));
      return { success: true };
    }),
});
