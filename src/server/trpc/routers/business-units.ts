import { z } from "zod";
import { router, protectedProcedure, chairmanProcedure } from "../index";
import { businessUnits, buChargeModelEnum } from "@drizzle/schema/business-units";
import { tasks } from "@drizzle/schema/tasks";
import { eq } from "drizzle-orm";
import { differenceInCalendarDays } from "date-fns";
import { nextId } from "@/lib/id-gen";

/**
 * Router quản lý Business Unit (BU) — nền cho cả 3 mục tiêu.
 * - CRUD BU (chairman/admin/bom).
 * - Bảng điều hành "BU status": tiến độ theo IVP, health, số blocker.
 */
export const businessUnitsRouter = router({
  // Danh sách BU + lead
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.businessUnits.findMany({
      orderBy: (bu, { asc }) => [asc(bu.code)],
      with: {
        lead: { columns: { id: true, name: true, email: true, image: true } },
      },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bu = await ctx.db.query.businessUnits.findFirst({
        where: eq(businessUnits.id, input.id),
        with: { lead: { columns: { id: true, name: true, image: true } } },
      });
      if (!bu) throw new Error("BU not found");
      return bu;
    }),

  create: chairmanProcedure
    .input(
      z.object({
        code: z.string().min(2).max(20),
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        leadUserId: z.string().optional(),
        jiraProjectKey: z.string().max(50).optional(),
        chargeModel: z.enum(buChargeModelEnum.enumValues).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await nextId("BU", ctx.db);
      const [bu] = await ctx.db
        .insert(businessUnits)
        .values({
          id,
          code: input.code.toUpperCase(),
          name: input.name,
          description: input.description,
          leadUserId: input.leadUserId ?? null,
          jiraProjectKey: input.jiraProjectKey ?? null,
          chargeModel: input.chargeModel ?? "subscription",
        })
        .returning();
      return bu;
    }),

  update: chairmanProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        leadUserId: z.string().nullable().optional(),
        jiraProjectKey: z.string().nullable().optional(),
        chargeModel: z.enum(buChargeModelEnum.enumValues).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(businessUnits)
        .set({
          ...(input.name && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.leadUserId !== undefined && { leadUserId: input.leadUserId }),
          ...(input.jiraProjectKey !== undefined && { jiraProjectKey: input.jiraProjectKey }),
          ...(input.chargeModel && { chargeModel: input.chargeModel }),
          updatedAt: new Date(),
        })
        .where(eq(businessUnits.id, input.id))
        .returning();
      if (!updated) throw new Error("BU not found");
      return updated;
    }),

  /**
   * MỤC TIÊU 1 — Bảng điều hành trạng thái mỗi BU:
   * tiến độ (theo trọng số IVP), health đèn, số blocker, số task quá hạn.
   */
  status: protectedProcedure.query(async ({ ctx }) => {
    const bus = await ctx.db.query.businessUnits.findMany({
      with: { lead: { columns: { id: true, name: true, image: true } } },
    });

    const now = new Date();
    const result = [];

    for (const bu of bus) {
      const rows = await ctx.db.query.tasks.findMany({
        where: eq(tasks.buId, bu.id),
        columns: {
          id: true, status: true, ivp: true, deadline: true,
          blockedSince: true, title: true, assigneeId: true,
        },
      });

      const totalIvp = rows.reduce((s, t) => s + (t.ivp ?? 0), 0);
      const doneIvp = rows
        .filter((t) => t.status === "done")
        .reduce((s, t) => s + (t.ivp ?? 0), 0);
      const openTasks = rows.filter((t) => t.status !== "done");
      const overdue = openTasks.filter(
        (t) => t.deadline && t.deadline < now
      ).length;
      const blockers = rows.filter((t) => t.status === "blocked");
      const staleBlockers = blockers.filter(
        (t) =>
          t.blockedSince && differenceInCalendarDays(now, t.blockedSince) > 3
      ).length;

      const progressPct = totalIvp > 0 ? Math.round((doneIvp / totalIvp) * 100) : 0;
      const overdueRatio = openTasks.length > 0 ? overdue / openTasks.length : 0;

      // Health: 🟢/🟡/🔴
      let health: "green" | "yellow" | "red" = "green";
      if (overdueRatio > 0.2 || staleBlockers > 0) health = "red";
      else if (overdueRatio > 0 || blockers.length > 0) health = "yellow";

      result.push({
        id: bu.id,
        code: bu.code,
        name: bu.name,
        lead: bu.lead,
        chargeModel: bu.chargeModel,
        progressPct,
        totalTasks: rows.length,
        openTasks: openTasks.length,
        overdue,
        blockers: blockers.length,
        staleBlockers,
        health,
      });
    }
    return result;
  }),

  /** MỤC TIÊU 1 — Toàn bộ blocker toàn hệ thống (sắp xếp theo số ngày tắc). */
  blockers: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.tasks.findMany({
      where: eq(tasks.status, "blocked"),
      columns: {
        id: true, title: true, buId: true, assigneeId: true,
        blockedReason: true, blockedBy: true, blockedSince: true, priority: true,
      },
      with: {
        bu: { columns: { code: true } },
        assignee: { columns: { id: true, name: true, image: true } },
      },
    });
    const now = new Date();
    return rows
      .map((t) => ({
        ...t,
        daysBlocked: t.blockedSince
          ? differenceInCalendarDays(now, t.blockedSince)
          : 0,
      }))
      .sort((a, b) => b.daysBlocked - a.daysBlocked);
  }),
});
