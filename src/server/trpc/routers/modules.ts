import { z } from "zod";
import { router, protectedProcedure, chairmanProcedure } from "../index";
import { modules } from "@drizzle/schema/modules";
import { priorityEnum } from "@drizzle/schema/tasks";
import { notifications } from "@drizzle/schema/notifications";
import { eq, and } from "drizzle-orm";
import { projectMembers } from "@drizzle/schema/projects";
import { nextId } from "@/lib/id-gen";
import { notificationEmitter } from "@/lib/events";
import { recordScore, recordActivity, getModuleScoreType } from "@/lib/scoring";
import { escapeHtml } from "@/lib/escape-html";

const checklistItemSchema = z.object({
  text: z.string().min(1),
  done: z.boolean(),
});

/** Check if user can manage (edit/delete) a module */
function canManageModule(userRole: string, userId: string, module: { createdBy: string | null }) {
  if (userRole === "admin" || userRole === "chairman") return true;
  if (module.createdBy === userId) return true;
  return false;
}

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

  // My modules across all projects
  myModules: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.modules.findMany({
      where: eq(modules.assigneeId, ctx.user.id),
      orderBy: (modules, { desc, asc }) => [desc(modules.priority), asc(modules.deadline)],
      with: {
        project: {
          columns: { id: true, title: true },
        },
        assignee: {
          columns: { id: true, name: true, email: true },
        },
      },
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
          assignee: {
            columns: { id: true, name: true, email: true },
          },
        },
      });
      if (!module) throw new Error("Module not found");
      return module;
    }),

  // Create module (any authenticated user)
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1).max(200),
        description: z.string().max(10000).optional(),
        assigneeId: z.string().optional(),
        priority: z.enum(priorityEnum.enumValues).optional(),
        deadline: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // H-02: Verify user is a project member
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
          assigneeId: input.assigneeId,
          priority: input.priority || "medium",
          deadline: input.deadline ? new Date(input.deadline) : null,
          createdBy: ctx.user.id,
        })
        .returning();

      // Notification on assignment
      if (input.assigneeId && input.assigneeId !== ctx.user.id) {
        await ctx.db.insert(notifications).values({
          userId: input.assigneeId,
          type: "module.assigned",
          title: "New Module Assigned",
          body: `You have been assigned to module: ${escapeHtml(input.title)}`,
          link: `/modules/${newId}`,
        });
        notificationEmitter.emit("new_notification", input.assigneeId);
      }

      return newModule;
    }),

  // Update module (Admin/Chairman/Creator)
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        assigneeId: z.string().nullable().optional(),
        priority: z.enum(priorityEnum.enumValues).optional(),
        deadline: z.string().nullable().optional(),
        output: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.modules.findFirst({
        where: eq(modules.id, input.id),
        columns: { createdBy: true },
      });
      if (!existing) throw new Error("Module not found");
      if (!canManageModule(ctx.user.role as string, ctx.user.id, existing)) {
        throw new Error("You don't have permission to edit this module");
      }

      const [updated] = await ctx.db
        .update(modules)
        .set({
          ...(input.title && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.assigneeId !== undefined && { assigneeId: input.assigneeId }),
          ...(input.priority && { priority: input.priority }),
          ...(input.deadline !== undefined && { deadline: input.deadline ? new Date(input.deadline) : null }),
          ...(input.output !== undefined && { output: input.output }),
          updatedAt: new Date(),
        })
        .where(eq(modules.id, input.id))
        .returning();

      return updated;
    }),

  // Update status (Assignee + Admin/Chairman/Creator)
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["planned", "in_progress", "in_review", "changes_requested", "done"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const existing = await tx.query.modules.findFirst({
          where: eq(modules.id, input.id),
          columns: { assigneeId: true, createdBy: true, deadline: true },
        });
        if (!existing) throw new Error("Module not found");

        // Allow: assignee, admin, chairman, creator
        const isAssignee = existing.assigneeId === ctx.user.id;
        const isManager = canManageModule(ctx.user.role as string, ctx.user.id, existing);
        if (!isAssignee && !isManager) {
          throw new Error("You don't have permission to change this module's status");
        }

        const [updated] = await tx
          .update(modules)
          .set({ status: input.status, updatedAt: new Date() })
          .where(eq(modules.id, input.id))
          .returning();

        // Scoring when module is completed (atomic with status update)
        if (input.status === "done" && updated.assigneeId) {
          const { eventType, points } = getModuleScoreType(updated.deadline);
          await recordScore(tx, {
            userId: updated.assigneeId,
            eventType,
            points,
            refType: "module",
            refId: updated.id,
          });
        }

        await recordActivity(tx, ctx.user.id);

        return updated;
      });
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

      await recordActivity(ctx.db, ctx.user.id);
      return updated;
    }),

  // Delete module (Admin/Chairman/Creator)
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.modules.findFirst({
        where: eq(modules.id, input.id),
        columns: { createdBy: true },
      });
      if (!existing) throw new Error("Module not found");
      if (!canManageModule(ctx.user.role as string, ctx.user.id, existing)) {
        throw new Error("You don't have permission to delete this module");
      }

      await ctx.db.delete(modules).where(eq(modules.id, input.id));
      return { success: true };
    }),

  // Update module output/result (Assignee + Admin/Chairman)
  updateOutput: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        output: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.modules.findFirst({
        where: eq(modules.id, input.id),
        columns: { assigneeId: true, createdBy: true },
      });
      if (!existing) throw new Error("Module not found");

      const isAssignee = existing.assigneeId === ctx.user.id;
      const isManager = canManageModule(ctx.user.role as string, ctx.user.id, existing);
      if (!isAssignee && !isManager) {
        throw new Error("You don't have permission to update this module's output");
      }

      const [updated] = await ctx.db
        .update(modules)
        .set({ output: input.output, updatedAt: new Date() })
        .where(eq(modules.id, input.id))
        .returning();

      return updated;
    }),
});
