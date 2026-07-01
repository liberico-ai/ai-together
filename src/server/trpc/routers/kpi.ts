import { z } from "zod";
import { router, protectedProcedure, bomProcedure } from "../index";
import {
  kpiPeriods,
  kpiTargets,
  kpiScores,
} from "@drizzle/schema/kpi";
import { tasks } from "@drizzle/schema/tasks";
import { scoreEvents } from "@drizzle/schema/scoring";
import { users } from "@drizzle/schema/users";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { DB } from "@/server/db";

/**
 * KPI Composite Score theo quý (Mục tiêu 2).
 *
 * Composite = 0.35·Tempo + 0.25·Completion + 0.25·Quality + 0.15·AIAdoption
 * - Tempo & Completion tính tự động từ dữ liệu task/score_events.
 * - Quality & AIAdoption nhập/duyệt qua saveScore (chairman).
 */

// clamp mọi trục về [0.5, 1.5] theo công thức quy đổi (Addendum 3.2)
const clamp = (x: number): number => Math.min(1.5, Math.max(0.5, x));

export const kpiRouter = router({
  // ─── Kỳ KPI ─────────────────────────────────────────────
  listPeriods: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(kpiPeriods)
      .orderBy(desc(kpiPeriods.quarter));
  }),

  createPeriod: bomProcedure
    .input(z.object({ quarter: z.string().min(4).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const [period] = await ctx.db
        .insert(kpiPeriods)
        .values({ quarter: input.quarter })
        .returning();
      return period;
    }),

  /**
   * Tempo score = clamp(IVP / tempoTarget).
   * IVP = Σ points của score_events (eventType='ivp_credit') của user ÷ 10.
   */
  computeTempo: protectedProcedure
    .input(z.object({ periodId: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      return computeTempo(ctx.db, input.userId, input.periodId);
    }),

  /**
   * Completion score = clamp(pct / 0.9).
   * pct = (task done, có deadline, hoàn thành đúng hạn) / (task done có deadline).
   */
  computeCompletion: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      return computeCompletion(ctx.db, input.userId);
    }),

  // ─── Điểm của tôi trong 1 kỳ ────────────────────────────
  myScore: protectedProcedure
    .input(z.object({ periodId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(kpiScores)
        .where(
          and(
            eq(kpiScores.userId, ctx.user.id),
            eq(kpiScores.periodId, input.periodId)
          )
        )
        .limit(1);
      return row ?? null;
    }),

  // ─── Danh sách điểm toàn kỳ (join user) ─────────────────
  listScores: protectedProcedure
    .input(z.object({ periodId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: kpiScores.id,
          userId: kpiScores.userId,
          userName: users.name,
          userImage: users.image,
          tempoScore: kpiScores.tempoScore,
          completionScore: kpiScores.completionScore,
          qualityScore: kpiScores.qualityScore,
          aiScore: kpiScores.aiScore,
          compositeScore: kpiScores.compositeScore,
          status: kpiScores.status,
          note: kpiScores.note,
          updatedAt: kpiScores.updatedAt,
        })
        .from(kpiScores)
        .innerJoin(users, eq(kpiScores.userId, users.id))
        .where(eq(kpiScores.periodId, input.periodId))
        .orderBy(sql`${kpiScores.compositeScore} desc`);
      return rows;
    }),

  // ─── Target theo người & kỳ (Mục tiêu 2: quản lý target qua UI) ──
  /**
   * Danh sách target 4 trục của MỌI người dùng trong 1 kỳ (chairman).
   * Left-join users ⟵ kpi_targets: người chưa đặt target vẫn xuất hiện
   * (các trường target = null) để chairman điền lần đầu.
   */
  listTargets: bomProcedure
    .input(z.object({ periodId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          userId: users.id,
          userName: users.name,
          userImage: users.image,
          role: users.role,
          targetId: kpiTargets.id,
          tempoTarget: kpiTargets.tempoTarget,
          completionTarget: kpiTargets.completionTarget,
          qualityTarget: kpiTargets.qualityTarget,
          aiTarget: kpiTargets.aiTarget,
        })
        .from(users)
        .leftJoin(
          kpiTargets,
          and(
            eq(kpiTargets.userId, users.id),
            eq(kpiTargets.periodId, input.periodId)
          )
        )
        .orderBy(asc(users.name));
      return rows;
    }),

  /**
   * Upsert target 4 trục cho 1 người trong 1 kỳ (chairman).
   * Upsert theo unique (userId, periodId).
   */
  upsertTarget: bomProcedure
    .input(
      z.object({
        userId: z.string(),
        periodId: z.string(),
        tempoTarget: z.number().positive(),
        completionTarget: z.number().positive().default(0.9),
        qualityTarget: z.number().positive().default(1),
        aiTarget: z.number().positive().default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [saved] = await ctx.db
        .insert(kpiTargets)
        .values({
          userId: input.userId,
          periodId: input.periodId,
          tempoTarget: input.tempoTarget,
          completionTarget: input.completionTarget,
          qualityTarget: input.qualityTarget,
          aiTarget: input.aiTarget,
        })
        .onConflictDoUpdate({
          target: [kpiTargets.userId, kpiTargets.periodId],
          set: {
            tempoTarget: input.tempoTarget,
            completionTarget: input.completionTarget,
            qualityTarget: input.qualityTarget,
            aiTarget: input.aiTarget,
          },
        })
        .returning();
      return saved;
    }),

  /**
   * Tính & lưu điểm KPI cho 1 người trong 1 kỳ (chairman).
   * - Tempo & Completion: tự tính.
   * - Quality & AIAdoption: nhập tay (đã clamp phía input).
   * - Composite = 0.35·Tempo + 0.25·Completion + 0.25·Quality + 0.15·AIAdoption.
   * Upsert theo unique (userId, periodId).
   */
  saveScore: bomProcedure
    .input(
      z.object({
        userId: z.string(),
        periodId: z.string(),
        qualityScore: z.number(),
        aiScore: z.number(),
        note: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tempoScore = await computeTempo(ctx.db, input.userId, input.periodId);
      const completionScore = await computeCompletion(ctx.db, input.userId);
      const qualityScore = clamp(input.qualityScore);
      const aiScore = clamp(input.aiScore);

      const compositeScore =
        0.35 * tempoScore +
        0.25 * completionScore +
        0.25 * qualityScore +
        0.15 * aiScore;

      const now = new Date();
      const [saved] = await ctx.db
        .insert(kpiScores)
        .values({
          userId: input.userId,
          periodId: input.periodId,
          tempoScore,
          completionScore,
          qualityScore,
          aiScore,
          compositeScore,
          reviewerId: ctx.user.id,
          note: input.note ?? null,
          status: "submitted",
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [kpiScores.userId, kpiScores.periodId],
          set: {
            tempoScore,
            completionScore,
            qualityScore,
            aiScore,
            compositeScore,
            reviewerId: ctx.user.id,
            note: input.note ?? null,
            status: "submitted",
            updatedAt: now,
          },
        })
        .returning();
      return saved;
    }),
});

// ─── Helpers (dùng chung cho query lẻ & saveScore) ────────

/**
 * Tempo score = clamp(IVP / tempoTarget).
 * IVP = Σ points(ivp_credit) ÷ 10. Lấy tempoTarget từ kpi_targets.
 * Nếu chưa có target → mặc định 1 IVP để tránh chia 0.
 */
async function computeTempo(
  db: DB,
  userId: string,
  periodId: string
): Promise<number> {
  const [agg] = await db
    .select({
      totalPoints: sql<number>`coalesce(sum(${scoreEvents.points}), 0)`,
    })
    .from(scoreEvents)
    .where(
      and(
        eq(scoreEvents.userId, userId),
        eq(scoreEvents.eventType, "ivp_credit")
      )
    );

  const ivp = Number(agg?.totalPoints ?? 0) / 10;

  const [target] = await db
    .select({ tempoTarget: kpiTargets.tempoTarget })
    .from(kpiTargets)
    .where(
      and(
        eq(kpiTargets.userId, userId),
        eq(kpiTargets.periodId, periodId)
      )
    )
    .limit(1);
  const tempoTarget =
    target?.tempoTarget && target.tempoTarget > 0 ? target.tempoTarget : 1;

  return clamp(ivp / tempoTarget);
}

/**
 * Completion score = clamp(pct / 0.9).
 * pct = task done đúng hạn / task done có deadline.
 * Không có task done nào có deadline → 1.0 (neutral) trước clamp.
 */
async function computeCompletion(
  db: DB,
  userId: string
): Promise<number> {
  const rows = await db
    .select({
      deadline: tasks.deadline,
      completedAt: tasks.completedAt,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.assigneeId, userId),
        eq(tasks.status, "done")
      )
    );

  const withDeadline = rows.filter((r) => r.deadline !== null);
  if (withDeadline.length === 0) return clamp(1 / 0.9);

  const onTime = withDeadline.filter(
    (r) => r.completedAt !== null && r.completedAt <= (r.deadline as Date)
  ).length;
  const pct = onTime / withDeadline.length;

  return clamp(pct / 0.9);
}
