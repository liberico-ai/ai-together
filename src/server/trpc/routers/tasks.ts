import { z } from "zod";
import { router, protectedProcedure } from "../index";
import { tasks, priorityEnum, taskCategoryEnum } from "@drizzle/schema/tasks";
import { modules } from "@drizzle/schema/modules";
import { projectMembers } from "@drizzle/schema/projects";
import { notifications } from "@drizzle/schema/notifications";
import { eq, and, desc } from "drizzle-orm";
import { nextId } from "@/lib/id-gen";
import { notificationEmitter } from "@/lib/events";
import { recordScore, recordActivity, SCORE_POINTS, getTaskScoreType } from "@/lib/scoring";
import { escapeHtml } from "@/lib/escape-html";
import type { DB } from "@/server/db";

/** Check if user can manage (edit/delete) a task */
function canManageTask(
  userRole: string,
  userId: string,
  task: { createdBy: string | null; assigneeId: string | null }
) {
  if (userRole === "admin" || userRole === "chairman") return true;
  if (task.createdBy === userId) return true;
  if (task.assigneeId === userId) return true;
  return false;
}

/** Auto-add a checklist item to a module when a task is linked */
async function addTaskChecklistItem(
  db: DB,
  moduleId: string,
  projectId: string,
  taskTitle: string
) {
  const mod = await db.query.modules.findFirst({
    where: eq(modules.id, moduleId),
    columns: { id: true, checklist: true, projectId: true },
  });
  if (mod && mod.projectId === projectId) {
    const currentChecklist = (mod.checklist as { text: string; done: boolean }[]) || [];
    await db.update(modules).set({
      checklist: [...currentChecklist, { text: `Task created: ${taskTitle}`, done: false }],
      updatedAt: new Date(),
    }).where(eq(modules.id, moduleId));
  }
}

export const tasksRouter = router({
  // List tasks by project
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.tasks.findMany({
        where: eq(tasks.projectId, input.projectId),
        orderBy: (tasks, { asc }) => [asc(tasks.createdAt)],
        limit: 200,
        with: {
          assignee: {
            columns: { id: true, name: true, email: true, image: true },
          },
          module: {
            columns: { id: true, title: true },
          },
        },
      });
    }),

  // My tasks across all projects
  myTasks: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.tasks.findMany({
      where: eq(tasks.assigneeId, ctx.user.id),
      orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
      with: {
        project: {
          columns: { id: true, title: true },
        },
        module: {
          columns: { id: true, title: true },
        },
        assignee: {
          columns: { id: true, name: true, email: true, image: true },
        },
      },
    });
  }),

  // Get single task
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.db.query.tasks.findFirst({
        where: eq(tasks.id, input.id),
        with: {
          project: {
            columns: { id: true, title: true, chairmanId: true },
          },
          module: {
            columns: { id: true, title: true },
          },
          assignee: {
            columns: { id: true, name: true, email: true, image: true },
          },
        },
      });
      if (!task) throw new Error("Task not found");
      return task;
    }),

  // Create task (any project member)
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        moduleId: z.string().optional(),
        title: z.string().min(1).max(200),
        description: z.string().max(10000).optional(),
        assigneeId: z.string().optional(),
        priority: z.enum(priorityEnum.enumValues).optional(),
        estimateDays: z.number().int().positive().optional(),
        deadline: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify project membership
      const membership = await ctx.db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, input.projectId),
          eq(projectMembers.userId, ctx.user.id)
        ),
      });
      if (!membership) throw new Error("You are not a member of this project");

      // If moduleId provided, verify it exists and belongs to the same project
      if (input.moduleId) {
        const mod = await ctx.db.query.modules.findFirst({
          where: eq(modules.id, input.moduleId),
          columns: { id: true, projectId: true },
        });
        if (!mod) throw new Error("Module not found");
        if (mod.projectId !== input.projectId) {
          throw new Error("Module does not belong to this project");
        }
      }

      const newId = await nextId("TASK", ctx.db);

      const [newTask] = await ctx.db
        .insert(tasks)
        .values({
          id: newId,
          projectId: input.projectId,
          moduleId: input.moduleId ?? null,
          title: input.title,
          description: input.description,
          assigneeId: input.assigneeId,
          priority: input.priority || "medium",
          estimateDays: input.estimateDays ?? null,
          deadline: input.deadline ? new Date(input.deadline) : null,
          createdBy: ctx.user.id,
        })
        .returning();

      // Auto-add checklist item to module
      if (input.moduleId) {
        await addTaskChecklistItem(ctx.db, input.moduleId, input.projectId, input.title);
      }

      // Notify assignee
      if (input.assigneeId && input.assigneeId !== ctx.user.id) {
        await ctx.db.insert(notifications).values({
          userId: input.assigneeId,
          type: "task.assigned",
          title: "New Task Assigned",
          body: `You have been assigned to task: ${escapeHtml(input.title)}`,
          link: `/projects/${input.projectId}`,
        });
        notificationEmitter.emit("new_notification", input.assigneeId);
      }

      return newTask;
    }),

  // Update task (Admin/Chairman/Creator/Assignee)
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        assigneeId: z.string().nullable().optional(),
        priority: z.enum(priorityEnum.enumValues).optional(),
        estimateDays: z.number().int().positive().nullable().optional(),
        moduleId: z.string().nullable().optional(),
        deadline: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.tasks.findFirst({
        where: eq(tasks.id, input.id),
        columns: { createdBy: true, assigneeId: true, projectId: true, moduleId: true },
      });
      if (!existing) throw new Error("Task not found");
      if (!canManageTask(ctx.user.role as string, ctx.user.id, existing)) {
        throw new Error("You don't have permission to edit this task");
      }

      // If moduleId is changing to a new value, verify it belongs to the same project
      if (input.moduleId !== undefined && input.moduleId !== null && input.moduleId !== existing.moduleId) {
        const mod = await ctx.db.query.modules.findFirst({
          where: eq(modules.id, input.moduleId),
          columns: { id: true, projectId: true },
        });
        if (!mod) throw new Error("Module not found");
        if (mod.projectId !== existing.projectId) {
          throw new Error("Module does not belong to this project");
        }
      }

      const [updated] = await ctx.db
        .update(tasks)
        .set({
          ...(input.title && { title: input.title }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
          ...(input.assigneeId !== undefined && {
            assigneeId: input.assigneeId,
          }),
          ...(input.priority && { priority: input.priority }),
          ...(input.estimateDays !== undefined && {
            estimateDays: input.estimateDays,
          }),
          ...(input.moduleId !== undefined && {
            moduleId: input.moduleId,
          }),
          ...(input.deadline !== undefined && {
            deadline: input.deadline ? new Date(input.deadline) : null,
          }),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, input.id))
        .returning();

      // Auto-add checklist item if moduleId changed to a new value
      if (input.moduleId && input.moduleId !== existing.moduleId && existing.projectId) {
        await addTaskChecklistItem(ctx.db, input.moduleId, existing.projectId, updated.title);
      }

      // Notify new assignee if changed
      if (
        input.assigneeId &&
        input.assigneeId !== existing.assigneeId &&
        input.assigneeId !== ctx.user.id
      ) {
        await ctx.db.insert(notifications).values({
          userId: input.assigneeId,
          type: "task.assigned",
          title: "Task Re-assigned to You",
          body: `You have been assigned to task: ${escapeHtml(updated.title)}`,
          link: `/projects/${existing.projectId}`,
        });
        notificationEmitter.emit("new_notification", input.assigneeId);
      }

      return updated;
    }),

  // Update task status (Assignee + Admin/Chairman/Creator)
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum([
          "planned",
          "in_progress",
          "in_review",
          "changes_requested",
          "done",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.tasks.findFirst({
        where: eq(tasks.id, input.id),
        columns: {
          assigneeId: true,
          createdBy: true,
          deadline: true,
          projectId: true,
        },
      });
      if (!existing) throw new Error("Task not found");

      // Allow: assignee, admin, chairman, creator
      const isAssignee = existing.assigneeId === ctx.user.id;
      const isManager = canManageTask(
        ctx.user.role as string,
        ctx.user.id,
        existing
      );
      if (!isAssignee && !isManager) {
        throw new Error(
          "You don't have permission to change this task's status"
        );
      }

      const [updated] = await ctx.db
        .update(tasks)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(tasks.id, input.id))
        .returning();

      // Award score when task is completed
      if (input.status === "done" && updated.assigneeId) {
        const { eventType, points } = getTaskScoreType(updated.deadline);
        await recordScore(ctx.db, {
          userId: updated.assigneeId,
          eventType,
          points,
          refType: "task",
          refId: updated.id,
        });
      }

      await recordActivity(ctx.db, ctx.user.id);
      return updated;
    }),

  // Delete task (Admin/Chairman/Creator/Assignee)
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.tasks.findFirst({
        where: eq(tasks.id, input.id),
        columns: { createdBy: true, assigneeId: true },
      });
      if (!existing) throw new Error("Task not found");
      if (!canManageTask(ctx.user.role as string, ctx.user.id, existing)) {
        throw new Error("You don't have permission to delete this task");
      }

      await ctx.db.delete(tasks).where(eq(tasks.id, input.id));
      return { success: true };
    }),

  // ── Operations Tasks ──────────────────────────────────────

  // List operations tasks (category = "operations")
  listOperations: protectedProcedure
    .query(async ({ ctx }) => {
      return await ctx.db.query.tasks.findMany({
        where: eq(tasks.category, "operations"),
        orderBy: [desc(tasks.createdAt)],
        limit: 200,
        with: {
          assignee: {
            columns: { id: true, name: true, email: true, image: true },
          },
        },
      });
    }),

  // Create operations task
  createOperations: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(10000).optional(),
        domain: z.string().min(1).max(100),
        assigneeId: z.string().optional(),
        priority: z.enum(priorityEnum.enumValues).optional(),
        estimateDays: z.number().int().positive().optional(),
        deadline: z.string().optional(),
        jiraIssueKey: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const newId = await nextId("TASK", ctx.db);

      const [newTask] = await ctx.db
        .insert(tasks)
        .values({
          id: newId,
          category: "operations",
          domain: input.domain,
          projectId: null,
          title: input.title,
          description: input.description,
          assigneeId: input.assigneeId,
          priority: input.priority || "medium",
          estimateDays: input.estimateDays ?? null,
          deadline: input.deadline ? new Date(input.deadline) : null,
          jiraIssueKey: input.jiraIssueKey || null,
          createdBy: ctx.user.id,
        })
        .returning();

      // Notify assignee
      if (input.assigneeId && input.assigneeId !== ctx.user.id) {
        await ctx.db.insert(notifications).values({
          userId: input.assigneeId,
          type: "task.assigned",
          title: "Operations Task Assigned",
          body: `You have been assigned to operations task: ${escapeHtml(input.title)}`,
          link: `/operations`,
        });
        notificationEmitter.emit("new_notification", input.assigneeId);
      }

      return newTask;
    }),
});
