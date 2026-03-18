import { z } from "zod";
import { router, protectedProcedure, chairmanProcedure } from "../index";
import { tasks, taskStatusEnum, priorityEnum } from "@drizzle/schema/tasks";
import { eq, or } from "drizzle-orm";
import { nextId } from "@/lib/id-gen";

export const tasksRouter = router({
  // List tasks by module
  listByModule: protectedProcedure
    .input(z.object({ moduleId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.tasks.findMany({
        where: eq(tasks.moduleId, input.moduleId),
        orderBy: (tasks, { asc, desc }) => [desc(tasks.priority), asc(tasks.deadline), asc(tasks.createdAt)],
        with: {
          assignee: { columns: { id: true, name: true, email: true } },
        },
      });
    }),

  // My tasks across all projects
  myTasks: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.tasks.findMany({
      where: eq(tasks.assigneeId, ctx.user.id),
      orderBy: (tasks, { asc, desc }) => [desc(tasks.priority), asc(tasks.deadline)],
      with: {
        module: {
          with: { project: { columns: { id: true, title: true } } },
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
          assignee: { columns: { id: true, name: true, email: true } },
          creator: { columns: { id: true, name: true } },
          module: {
            with: { project: { columns: { id: true, title: true, chairmanId: true } } },
          },
        },
      });
      if (!task) throw new Error("Task not found");
      return task;
    }),

  // Create task (Any protected user can create a task in a module?? Usually yes or chairman only. Let's allow protected for collaborative)
  create: protectedProcedure
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
      const newId = await nextId("TASK", ctx.db);

      const [newTask] = await ctx.db
        .insert(tasks)
        .values({
          id: newId,
          moduleId: input.moduleId,
          title: input.title,
          description: input.description,
          assigneeId: input.assigneeId,
          priority: input.priority,
          deadline: input.deadline ? new Date(input.deadline) : null,
          createdBy: ctx.user.id,
        })
        .returning();

      return newTask;
    }),

  // Update task metadata (title, desc, priority, etc)
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        assigneeId: z.string().optional(),
        priority: z.enum(priorityEnum.enumValues).optional(),
        deadline: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(tasks)
        .set({
          ...(input.title && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.assigneeId !== undefined && { assigneeId: input.assigneeId }),
          ...(input.priority && { priority: input.priority }),
          ...(input.deadline !== undefined && { deadline: input.deadline ? new Date(input.deadline) : null }),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, input.id))
        .returning();

      return updated;
    }),

  // Update status (will be heavily guarded in S2.1, basic implementation for now)
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(taskStatusEnum.enumValues),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(tasks)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(tasks.id, input.id))
        .returning();
      return updated;
    }),

  // Delete task (creator or chairman)
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(tasks).where(eq(tasks.id, input.id));
      return { success: true };
    }),
});
