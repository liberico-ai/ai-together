import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index";
import { tasks, priorityEnum, workTypeEnum } from "@drizzle/schema/tasks";
import { taskAssignees } from "@drizzle/schema/task-assignees";
import { modules } from "@drizzle/schema/modules";
import { projectMembers } from "@drizzle/schema/projects";
import { notifications } from "@drizzle/schema/notifications";
import { eq, and, or, desc, inArray, ne } from "drizzle-orm";
import { nextId } from "@/lib/id-gen";
import { notificationEmitter } from "@/lib/events";
import { recordActivity, creditTaskCompletion } from "@/lib/scoring";
import { escapeHtml } from "@/lib/escape-html";
import type { DB } from "@/server/db";

const PRIVILEGED = ["admin", "chairman", "bom"];

/** Ai được sửa/xoá task: admin/chairman/bom, người tạo, hoặc người nhận (primary). */
function canManageTask(
  userRole: string,
  userId: string,
  task: { createdBy: string | null; assigneeId: string | null }
) {
  if (PRIVILEGED.includes(userRole)) return true;
  if (task.createdBy === userId) return true;
  if (task.assigneeId === userId) return true;
  return false;
}

/**
 * RULE CỐT LÕI: chỉ NGƯỜI TẠO VIỆC (hoặc admin/chairman/bom) được ĐÓNG việc (status=done).
 * Người nhận chỉ có thể đẩy lên "in_review" để báo xong phần của mình.
 */
function canCloseTask(
  userRole: string,
  userId: string,
  task: { createdBy: string | null }
) {
  if (PRIVILEGED.includes(userRole)) return true;
  return task.createdBy === userId;
}

/** Lấy danh sách người nhận (đa người) kèm trọng số đóng góp. */
async function getAssigneeWeights(db: DB, taskId: string) {
  const rows = await db.query.taskAssignees.findMany({
    where: eq(taskAssignees.taskId, taskId),
    columns: { userId: true, contributionWeight: true },
  });
  return rows.map((r) => ({ userId: r.userId, weight: r.contributionWeight }));
}

/** Thêm 1 checklist item vào module khi link task. */
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

/** Gửi thông báo "được giao việc" cho 1 danh sách người (bỏ qua người tạo). */
async function notifyAssignees(
  db: DB,
  userIds: string[],
  actorId: string,
  taskTitle: string,
  link: string,
  title = "New Task Assigned"
) {
  const targets = [...new Set(userIds)].filter((u) => u && u !== actorId);
  for (const userId of targets) {
    await db.insert(notifications).values({
      userId,
      type: "task.assigned",
      title,
      body: `You have been assigned to task: ${escapeHtml(taskTitle)}`,
      link,
    });
    notificationEmitter.emit("new_notification", userId);
  }
}

export const tasksRouter = router({
  // ── Queries ───────────────────────────────────────────────

  listByProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.tasks.findMany({
        where: eq(tasks.projectId, input.projectId),
        orderBy: (t, { asc }) => [asc(t.createdAt)],
        limit: 200,
        with: {
          assignee: { columns: { id: true, name: true, email: true, image: true } },
          assignees: { with: { user: { columns: { id: true, name: true, image: true } } } },
          module: { columns: { id: true, title: true } },
          bu: { columns: { id: true, code: true } },
        },
      });
    }),

  // Task theo BU (Mục tiêu 1 & 3)
  listByBu: protectedProcedure
    .input(z.object({ buId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.tasks.findMany({
        where: eq(tasks.buId, input.buId),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
        limit: 200,
        with: {
          assignee: { columns: { id: true, name: true, image: true } },
          assignees: { with: { user: { columns: { id: true, name: true, image: true } } } },
        },
      });
    }),

  // Việc con của 1 task
  subtasks: protectedProcedure
    .input(z.object({ parentTaskId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.tasks.findMany({
        where: eq(tasks.parentTaskId, input.parentTaskId),
        orderBy: (t, { asc }) => [asc(t.createdAt)],
        with: {
          assignee: { columns: { id: true, name: true, image: true } },
        },
      });
    }),

  // Việc của tôi — gồm cả primary assignee VÀ đa người nhận
  myTasks: protectedProcedure.query(async ({ ctx }) => {
    const links = await ctx.db.query.taskAssignees.findMany({
      where: eq(taskAssignees.userId, ctx.user.id),
      columns: { taskId: true },
    });
    const taskIds = links.map((l) => l.taskId);

    return ctx.db.query.tasks.findMany({
      where: taskIds.length
        ? or(eq(tasks.assigneeId, ctx.user.id), inArray(tasks.id, taskIds))
        : eq(tasks.assigneeId, ctx.user.id),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      with: {
        project: { columns: { id: true, title: true } },
        module: { columns: { id: true, title: true } },
        bu: { columns: { id: true, code: true } },
        assignee: { columns: { id: true, name: true, image: true } },
      },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.db.query.tasks.findFirst({
        where: eq(tasks.id, input.id),
        with: {
          project: { columns: { id: true, title: true, chairmanId: true } },
          module: { columns: { id: true, title: true } },
          bu: { columns: { id: true, code: true, name: true } },
          assignee: { columns: { id: true, name: true, email: true, image: true } },
          assignees: { with: { user: { columns: { id: true, name: true, image: true } } } },
          subtasks: { columns: { id: true, title: true, status: true, ivp: true } },
          creator: { columns: { id: true, name: true } },
        },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      return task;
    }),

  // ── Create (đa người nhận + BU + IVP + việc con) ──────────

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),      // optional để hỗ trợ task theo BU thuần
        buId: z.string().optional(),
        moduleId: z.string().optional(),
        parentTaskId: z.string().optional(),   // tạo việc con
        title: z.string().min(1).max(200),
        description: z.string().max(10000).optional(),
        assigneeIds: z.array(z.string()).max(20).optional(), // GIAO NHIỀU NGƯỜI
        workType: z.enum(workTypeEnum.enumValues).optional(),
        ivp: z.number().min(0).max(13).optional(),
        priority: z.enum(priorityEnum.enumValues).optional(),
        estimateDays: z.number().int().positive().optional(),
        deadline: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Nếu là task dự án → kiểm tra membership (giữ nguyên hành vi cũ)
      if (input.projectId) {
        const membership = await ctx.db.query.projectMembers.findFirst({
          where: and(
            eq(projectMembers.projectId, input.projectId),
            eq(projectMembers.userId, ctx.user.id)
          ),
        });
        if (!membership && !PRIVILEGED.includes(ctx.user.role as string)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this project" });
        }
      }

      if (input.moduleId && input.projectId) {
        const mod = await ctx.db.query.modules.findFirst({
          where: eq(modules.id, input.moduleId),
          columns: { id: true, projectId: true },
        });
        if (!mod) throw new TRPCError({ code: "NOT_FOUND", message: "Module not found" });
        if (mod.projectId !== input.projectId)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Module does not belong to this project" });
      }

      // Nếu là việc con → kế thừa BU/project của cha nếu không truyền
      let buId = input.buId ?? null;
      let projectId = input.projectId ?? null;
      if (input.parentTaskId) {
        const parent = await ctx.db.query.tasks.findFirst({
          where: eq(tasks.id, input.parentTaskId),
          columns: { id: true, buId: true, projectId: true },
        });
        if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "Parent task not found" });
        buId = buId ?? parent.buId;
        projectId = projectId ?? parent.projectId;
      }

      const newId = await nextId("TASK", ctx.db);
      const assigneeIds = [...new Set(input.assigneeIds ?? [])];
      const primaryAssignee = assigneeIds[0] ?? null;

      const [newTask] = await ctx.db
        .insert(tasks)
        .values({
          id: newId,
          projectId,
          buId,
          moduleId: input.moduleId ?? null,
          parentTaskId: input.parentTaskId ?? null,
          workType: input.workType ?? "build",
          ivp: input.ivp ?? 1,
          title: input.title,
          description: input.description,
          assigneeId: primaryAssignee, // giữ tương thích
          priority: input.priority || "medium",
          estimateDays: input.estimateDays ?? null,
          deadline: input.deadline ? new Date(input.deadline) : null,
          createdBy: ctx.user.id, // ← người tạo, chịu trách nhiệm đóng việc
        })
        .returning();

      // Ghi bảng đa người nhận
      if (assigneeIds.length) {
        await ctx.db.insert(taskAssignees).values(
          assigneeIds.map((userId) => ({
            taskId: newId,
            userId,
            addedBy: ctx.user.id,
          }))
        );
      }

      if (input.moduleId && projectId) {
        await addTaskChecklistItem(ctx.db, input.moduleId, projectId, input.title);
      }

      const link = projectId ? `/projects/${projectId}` : `/my-tasks`;
      await notifyAssignees(ctx.db, assigneeIds, ctx.user.id, input.title, link);
      await recordActivity(ctx.db, ctx.user.id);

      return newTask;
    }),

  // Thêm nhanh 1 việc con
  addSubtask: protectedProcedure
    .input(
      z.object({
        parentTaskId: z.string(),
        title: z.string().min(1).max(200),
        assigneeIds: z.array(z.string()).max(20).optional(),
        ivp: z.number().min(0).max(13).optional(),
        deadline: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const parent = await ctx.db.query.tasks.findFirst({
        where: eq(tasks.id, input.parentTaskId),
        columns: { id: true, buId: true, projectId: true, createdBy: true, assigneeId: true },
      });
      if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "Parent task not found" });
      if (!canManageTask(ctx.user.role as string, ctx.user.id, parent))
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to add subtasks here" });

      const newId = await nextId("TASK", ctx.db);
      const assigneeIds = [...new Set(input.assigneeIds ?? [])];

      const [sub] = await ctx.db
        .insert(tasks)
        .values({
          id: newId,
          parentTaskId: parent.id,
          projectId: parent.projectId,
          buId: parent.buId,
          title: input.title,
          ivp: input.ivp ?? 1,
          assigneeId: assigneeIds[0] ?? null,
          deadline: input.deadline ? new Date(input.deadline) : null,
          createdBy: ctx.user.id,
        })
        .returning();

      if (assigneeIds.length) {
        await ctx.db.insert(taskAssignees).values(
          assigneeIds.map((userId) => ({ taskId: newId, userId, addedBy: ctx.user.id }))
        );
      }
      await notifyAssignees(ctx.db, assigneeIds, ctx.user.id, input.title, `/my-tasks`);
      return sub;
    }),

  // ── Đa người nhận: thêm / gỡ ──────────────────────────────

  assign: protectedProcedure
    .input(z.object({ taskId: z.string(), userId: z.string(), weight: z.number().positive().optional() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.query.tasks.findFirst({
        where: eq(tasks.id, input.taskId),
        columns: { id: true, title: true, createdBy: true, assigneeId: true, projectId: true },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      if (!canManageTask(ctx.user.role as string, ctx.user.id, task))
        throw new TRPCError({ code: "FORBIDDEN", message: "No permission to assign this task" });

      await ctx.db
        .insert(taskAssignees)
        .values({
          taskId: input.taskId,
          userId: input.userId,
          contributionWeight: input.weight ?? 1,
          addedBy: ctx.user.id,
        })
        .onConflictDoNothing();

      // Nếu chưa có primary assignee thì set người này làm primary
      if (!task.assigneeId) {
        await ctx.db.update(tasks).set({ assigneeId: input.userId }).where(eq(tasks.id, input.taskId));
      }

      const link = task.projectId ? `/projects/${task.projectId}` : `/my-tasks`;
      await notifyAssignees(ctx.db, [input.userId], ctx.user.id, task.title, link);
      return { success: true };
    }),

  unassign: protectedProcedure
    .input(z.object({ taskId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.query.tasks.findFirst({
        where: eq(tasks.id, input.taskId),
        columns: { createdBy: true, assigneeId: true },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      if (!canManageTask(ctx.user.role as string, ctx.user.id, task))
        throw new TRPCError({ code: "FORBIDDEN", message: "No permission" });

      await ctx.db
        .delete(taskAssignees)
        .where(and(eq(taskAssignees.taskId, input.taskId), eq(taskAssignees.userId, input.userId)));
      return { success: true };
    }),

  // ── Vướng mắc (Mục tiêu 1) ────────────────────────────────

  setBlocker: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().min(1).max(500),
        blockedBy: z.string().max(200).optional(), // đang chờ ai/BU/đối tác
      })
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.query.tasks.findFirst({
        where: eq(tasks.id, input.id),
        columns: { createdBy: true, assigneeId: true },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      if (!canManageTask(ctx.user.role as string, ctx.user.id, task))
        throw new TRPCError({ code: "FORBIDDEN", message: "No permission" });

      const [updated] = await ctx.db
        .update(tasks)
        .set({
          status: "blocked",
          blockedReason: input.reason,
          blockedBy: input.blockedBy ?? null,
          blockedSince: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, input.id))
        .returning();
      await recordActivity(ctx.db, ctx.user.id);
      return updated;
    }),

  resolveBlocker: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(tasks)
        .set({
          status: "in_progress",
          blockedReason: null,
          blockedBy: null,
          blockedSince: null,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, input.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      return updated;
    }),

  // ── Update chung ──────────────────────────────────────────

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        buId: z.string().nullable().optional(),
        workType: z.enum(workTypeEnum.enumValues).optional(),
        ivp: z.number().min(0).max(13).optional(),
        priority: z.enum(priorityEnum.enumValues).optional(),
        estimateDays: z.number().int().positive().nullable().optional(),
        progressPct: z.number().int().min(0).max(100).optional(),
        moduleId: z.string().nullable().optional(),
        deadline: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.tasks.findFirst({
        where: eq(tasks.id, input.id),
        columns: { createdBy: true, assigneeId: true, projectId: true, moduleId: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      if (!canManageTask(ctx.user.role as string, ctx.user.id, existing))
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to edit this task" });

      const [updated] = await ctx.db
        .update(tasks)
        .set({
          ...(input.title && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.buId !== undefined && { buId: input.buId }),
          ...(input.workType && { workType: input.workType }),
          ...(input.ivp !== undefined && { ivp: input.ivp }),
          ...(input.priority && { priority: input.priority }),
          ...(input.estimateDays !== undefined && { estimateDays: input.estimateDays }),
          ...(input.progressPct !== undefined && { progressPct: input.progressPct }),
          ...(input.moduleId !== undefined && { moduleId: input.moduleId }),
          ...(input.deadline !== undefined && {
            deadline: input.deadline ? new Date(input.deadline) : null,
          }),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, input.id))
        .returning();

      return updated;
    }),

  // ── Đổi trạng thái + RULE creator đóng việc + credit IVP ──

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum([
          "planned",
          "in_progress",
          "blocked",
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
          id: true, assigneeId: true, createdBy: true, deadline: true,
          projectId: true, ivp: true, status: true, parentTaskId: true,
        },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });

      const role = ctx.user.role as string;
      const isAssignee = existing.assigneeId === ctx.user.id;
      const isManager = canManageTask(role, ctx.user.id, existing);

      // Quyền chung để chỉnh trạng thái (assignee/creator/privileged)
      if (!isAssignee && !isManager) {
        // người nhận phụ (đa người) cũng được đẩy trạng thái
        const link = await ctx.db.query.taskAssignees.findFirst({
          where: and(eq(taskAssignees.taskId, input.id), eq(taskAssignees.userId, ctx.user.id)),
          columns: { id: true },
        });
        if (!link) throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to change this task's status" });
      }

      // ★ RULE: chỉ NGƯỜI TẠO (hoặc admin/chairman/bom) được ĐÓNG việc.
      if (input.status === "done" && !canCloseTask(role, ctx.user.id, existing)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Chỉ người tạo việc mới được kết thúc (done). Bạn hãy chuyển 'in_review' để báo hoàn thành phần của mình.",
        });
      }

      // ★ Không cho đóng việc cha khi còn việc con chưa done
      if (input.status === "done") {
        const openSubs = await ctx.db.query.tasks.findMany({
          where: and(eq(tasks.parentTaskId, input.id), ne(tasks.status, "done")),
          columns: { id: true },
        });
        if (openSubs.length > 0) {
          throw new TRPCError({ code: "FORBIDDEN", message: `Còn ${openSubs.length} việc con chưa hoàn thành — không thể đóng việc cha.` });
        }
      }

      const isClosing = input.status === "done" && existing.status !== "done";

      const [updated] = await ctx.db
        .update(tasks)
        .set({
          status: input.status,
          ...(isClosing && { completedAt: new Date() }),
          // rời trạng thái blocked → dọn thông tin vướng mắc
          ...(input.status !== "blocked" && {
            blockedReason: null, blockedBy: null, blockedSince: null,
          }),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, input.id))
        .returning();

      // ★ Credit IVP + điểm cho TẤT CẢ người nhận khi đóng việc (Mục tiêu 2)
      if (isClosing) {
        let assignees = await getAssigneeWeights(ctx.db, input.id);
        if (assignees.length === 0 && updated.assigneeId) {
          assignees = [{ userId: updated.assigneeId, weight: 1 }];
        }
        await creditTaskCompletion(ctx.db, {
          taskId: updated.id,
          ivp: updated.ivp ?? 1,
          deadline: updated.deadline,
          assignees,
        });
      }

      await recordActivity(ctx.db, ctx.user.id);
      return updated;
    }),

  // Xoá task (kèm việc con nhờ onDelete cascade)
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.tasks.findFirst({
        where: eq(tasks.id, input.id),
        columns: { createdBy: true, assigneeId: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      if (!canManageTask(ctx.user.role as string, ctx.user.id, existing))
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to delete this task" });

      await ctx.db.delete(tasks).where(eq(tasks.id, input.id));
      return { success: true };
    }),

  // ── Operations Tasks (giữ nguyên) ─────────────────────────

  listOperations: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.tasks.findMany({
      where: eq(tasks.category, "operations"),
      orderBy: [desc(tasks.createdAt)],
      limit: 200,
      with: {
        assignee: { columns: { id: true, name: true, email: true, image: true } },
        bu: { columns: { id: true, code: true } },
      },
    });
  }),

  createOperations: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(10000).optional(),
        domain: z.string().min(1).max(100),
        buId: z.string().optional(),
        assigneeIds: z.array(z.string()).max(20).optional(),
        priority: z.enum(priorityEnum.enumValues).optional(),
        estimateDays: z.number().int().positive().optional(),
        ivp: z.number().min(0).max(13).optional(),
        deadline: z.string().optional(),
        jiraIssueKey: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const newId = await nextId("TASK", ctx.db);
      const assigneeIds = [...new Set(input.assigneeIds ?? [])];

      const [newTask] = await ctx.db
        .insert(tasks)
        .values({
          id: newId,
          category: "operations",
          workType: "ops",
          domain: input.domain,
          buId: input.buId ?? null,
          projectId: null,
          title: input.title,
          description: input.description,
          assigneeId: assigneeIds[0] ?? null,
          priority: input.priority || "medium",
          estimateDays: input.estimateDays ?? null,
          ivp: input.ivp ?? 1,
          deadline: input.deadline ? new Date(input.deadline) : null,
          jiraIssueKey: input.jiraIssueKey || null,
          createdBy: ctx.user.id,
        })
        .returning();

      if (assigneeIds.length) {
        await ctx.db.insert(taskAssignees).values(
          assigneeIds.map((userId) => ({ taskId: newId, userId, addedBy: ctx.user.id }))
        );
      }
      await notifyAssignees(ctx.db, assigneeIds, ctx.user.id, input.title, `/operations`,
        "Operations Task Assigned");
      return newTask;
    }),
});
