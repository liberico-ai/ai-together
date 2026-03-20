import { z } from "zod";
import { router, protectedProcedure, chairmanProcedure } from "../index";
import { tasks, priorityEnum } from "@drizzle/schema/tasks";
import { modules } from "@drizzle/schema/modules";
import { notifications } from "@drizzle/schema/notifications";
import { eq } from "drizzle-orm";
import { nextId } from "@/lib/id-gen";
import { notificationEmitter } from "@/lib/events";
import { recordScore, recordActivity, SCORE_POINTS } from "@/lib/scoring";
import { escapeHtml } from "@/lib/escape-html";

/** Check if user can manage (edit/delete) a task */
function canManageTask(
  userRole: string,
  userId: string,
  task: { createdBy: string | null }
) {
  if (userRole === "admin" || userRole === "chairman") return true;
  if (task.createdBy === userId) return true;
  return false;
}

/** Determine score type based on deadline */
function getTaskScoreType(deadline: Date | null): {
  eventType: string;
  points: number;
} {
  if (!deadline) {
    return { eventType: "task_done", points: SCORE_POINTS.MODULE_DONE };
  }
  const now = new Date();
  if (now < deadline) {
    return { eventType: "task_early", points: SCORE_POINTS.MODULE_EARLY };
  } else {
    return { eventType: "task_late", points: SCORE_POINTS.MODULE_LATE };
  }
}

export const tasksRouter = router({
  // List tasks by module
  listByModule: protectedProcedure
    .input(z.object({ moduleId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.tasks.findMany({
        where: eq(tasks.moduleId, input.moduleId),
        orderBy: (tasks, { asc }) => [asc(tasks.createdAt)],
        with: {
          assignee: {
            columns: { id: true, name: true, email: true, image: true },
          },
        },
      });
    }),

  // My tasks across all modules
  myTasks: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.tasks.findMany({
      where: eq(tasks.assigneeId, ctx.user.id),
      orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
      with: {
        module: {
          columns: { id: true, title: true, projectId: true },
          with: {
            project: {
              columns: { id: true, title: true },
            },
          },
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
          module: {
            columns: { id: true, title: true, projectId: true },
            with: {
              project: {
                columns: { id: true, title: true, chairmanId: true },
              },
            },
          },
          assignee: {
            columns: { id: true, name: true, email: true, image: true },
          },
        },
      });
      if (!task) throw new Error("Task not found");
      return task;
    }),

  // Create task (Chairman/Admin only)
  create: chairmanProcedure
    .input(
      z.object({
        moduleId: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        assigneeId: z.string().optional(),
        priority: z.enum(priorityEnum.enumValues).optional(),
        deadline: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify module exists
      const mod = await ctx.db.query.modules.findFirst({
        where: eq(modules.id, input.moduleId),
        columns: { id: true, title: true },
      });
      if (!mod) throw new Error("Module not found");

      const newId = await nextId("TASK", ctx.db);

      const [newTask] = await ctx.db
        .insert(tasks)
        .values({
          id: newId,
          moduleId: input.moduleId,
          title: input.title,
          description: input.description,
          assigneeId: input.assigneeId,
          priority: input.priority || "medium",
          deadline: input.deadline ? new Date(input.deadline) : null,
          createdBy: ctx.user.id,
        })
        .returning();

      // Notify assignee
      if (input.assigneeId && input.assigneeId !== ctx.user.id) {
        await ctx.db.insert(notifications).values({
          userId: input.assigneeId,
          type: "task.assigned",
          title: "New Task Assigned",
          body: `You have been assigned to task: ${escapeHtml(input.title)}`,
          link: `/modules/${input.moduleId}`,
        });
        notificationEmitter.emit("new_notification", input.assigneeId);
      }

      return newTask;
    }),

  // Update task (Admin/Chairman/Creator)
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        assigneeId: z.string().nullable().optional(),
        priority: z.enum(priorityEnum.enumValues).optional(),
        deadline: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.tasks.findFirst({
        where: eq(tasks.id, input.id),
        columns: { createdBy: true, assigneeId: true, moduleId: true },
      });
      if (!existing) throw new Error("Task not found");
      if (!canManageTask(ctx.user.role as string, ctx.user.id, existing)) {
        throw new Error("You don't have permission to edit this task");
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
          ...(input.deadline !== undefined && {
            deadline: input.deadline ? new Date(input.deadline) : null,
          }),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, input.id))
        .returning();

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
          link: `/modules/${existing.moduleId}`,
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
          moduleId: true,
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

  // Delete task (Admin/Chairman/Creator)
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.tasks.findFirst({
        where: eq(tasks.id, input.id),
        columns: { createdBy: true },
      });
      if (!existing) throw new Error("Task not found");
      if (!canManageTask(ctx.user.role as string, ctx.user.id, existing)) {
        throw new Error("You don't have permission to delete this task");
      }

      await ctx.db.delete(tasks).where(eq(tasks.id, input.id));
      return { success: true };
    }),
});
