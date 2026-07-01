import { z } from "zod";
import { router, protectedProcedure, chairmanProcedure } from "../index";
import {
  salaryConfigs,
  payrollRuns,
  payrollLines,
} from "@drizzle/schema/payroll";
import { kpiScores } from "@drizzle/schema/kpi";
import { users } from "@drizzle/schema/users";
import { and, desc, eq } from "drizzle-orm";
import type { DB } from "@/server/db";

/**
 * TRẢ LƯƠNG (Mục tiêu 2 — phần lương), mô hình v7.2.
 *
 * Lương thực nhận = Lương sàn (70%) + Lương hiệu suất (30%) × Composite Score.
 *   floorSalary = baseSalary · floorPct
 *   perfSalary  = baseSalary · perfPct · composite   (composite từ kpi_scores kỳ tương ứng)
 *   total       = floorSalary + perfSalary + bonus
 *
 * Composite mặc định 1.0 nếu người đó chưa được chấm điểm trong kỳ.
 * Đơn vị tiền: TRIỆU VND/tháng, làm tròn 2 chữ số.
 * Dữ liệu nhạy cảm → chỉ chairman/admin ghi (mọi mutation qua chairmanProcedure).
 */

// làm tròn 2 chữ số thập phân
const round2 = (x: number): number => Math.round(x * 100) / 100;

/** Một dòng preview lương đã tính (chưa ghi DB). */
interface PayrollPreviewLine {
  userId: string;
  name: string;
  base: number;
  floorPct: number;
  perfPct: number;
  composite: number;
  floorSalary: number;
  perfSalary: number;
  total: number;
}

/**
 * Tính preview lương cho toàn bộ user có salaryConfig trong 1 kỳ.
 * - composite lấy từ kpi_scores(periodId, userId); mặc định 1.0 nếu chưa chấm.
 * - bonus = 0 ở bước tính (nhập tay sau bằng setBonus).
 */
async function computePreview(
  db: DB,
  periodId: string
): Promise<PayrollPreviewLine[]> {
  // Config lương + tên user.
  const configs = await db
    .select({
      userId: salaryConfigs.userId,
      name: users.name,
      baseSalary: salaryConfigs.baseSalary,
      floorPct: salaryConfigs.floorPct,
      perfPct: salaryConfigs.perfPct,
    })
    .from(salaryConfigs)
    .innerJoin(users, eq(salaryConfigs.userId, users.id));

  // Điểm composite của kỳ → map theo userId.
  const scores = await db
    .select({
      userId: kpiScores.userId,
      compositeScore: kpiScores.compositeScore,
    })
    .from(kpiScores)
    .where(eq(kpiScores.periodId, periodId));
  const compositeByUser = new Map(
    scores.map((s) => [s.userId, s.compositeScore])
  );

  return configs.map((c) => {
    const composite = compositeByUser.get(c.userId) ?? 1.0;
    const floorSalary = round2(c.baseSalary * c.floorPct);
    const perfSalary = round2(c.baseSalary * c.perfPct * composite);
    const total = round2(floorSalary + perfSalary); // bonus = 0 ở bước preview
    return {
      userId: c.userId,
      name: c.name,
      base: round2(c.baseSalary),
      floorPct: c.floorPct,
      perfPct: c.perfPct,
      composite: round2(composite),
      floorSalary,
      perfSalary,
      total,
    };
  });
}

export const payrollRouter = router({
  // ─── Cấu hình lương ─────────────────────────────────────
  /** Danh sách cấu hình lương đề xuất + tên/ảnh user (chairman). */
  listSalaryConfigs: chairmanProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: salaryConfigs.id,
        userId: salaryConfigs.userId,
        userName: users.name,
        userImage: users.image,
        baseSalary: salaryConfigs.baseSalary,
        floorPct: salaryConfigs.floorPct,
        perfPct: salaryConfigs.perfPct,
        updatedAt: salaryConfigs.updatedAt,
      })
      .from(salaryConfigs)
      .innerJoin(users, eq(salaryConfigs.userId, users.id))
      .orderBy(desc(salaryConfigs.baseSalary));
  }),

  /** Upsert cấu hình lương theo userId (chairman). */
  upsertSalaryConfig: chairmanProcedure
    .input(
      z.object({
        userId: z.string(),
        baseSalary: z.number().nonnegative(),
        floorPct: z.number().min(0).max(1).optional(),
        perfPct: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const floorPct = input.floorPct ?? 0.7;
      const perfPct = input.perfPct ?? 0.3;
      const now = new Date();
      const [saved] = await ctx.db
        .insert(salaryConfigs)
        .values({
          userId: input.userId,
          baseSalary: input.baseSalary,
          floorPct,
          perfPct,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: salaryConfigs.userId,
          set: {
            baseSalary: input.baseSalary,
            floorPct,
            perfPct,
            updatedAt: now,
          },
        })
        .returning();
      return saved;
    }),

  // ─── Tính & chốt lương ──────────────────────────────────
  /**
   * Preview lương 1 kỳ (KHÔNG ghi DB) — dùng cho bảng xem trước.
   * Mở cho protected: chỉ đọc, không tiết lộ mutation; trang UI đã role-gate.
   */
  computePayroll: protectedProcedure
    .input(z.object({ periodId: z.string() }))
    .query(async ({ ctx, input }) => {
      return computePreview(ctx.db, input.periodId);
    }),

  /**
   * Chốt bảng lương 1 kỳ (chairman): tính như computePayroll rồi ghi
   * payroll_runs + payroll_lines. Nếu đã có run cho kỳ này thì tái sử dụng
   * run (xoá line cũ, ghi lại) để tránh trùng.
   */
  runPayroll: chairmanProcedure
    .input(
      z.object({
        periodId: z.string(),
        note: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const preview = await computePreview(ctx.db, input.periodId);

      return ctx.db.transaction(async (tx) => {
        // Tìm run hiện có cho kỳ (chỉ chốt lại run đang draft; run finalized giữ nguyên -> tạo mới).
        const [existing] = await tx
          .select()
          .from(payrollRuns)
          .where(
            and(
              eq(payrollRuns.periodId, input.periodId),
              eq(payrollRuns.status, "draft")
            )
          )
          .limit(1);

        let run = existing;
        if (run) {
          // Cập nhật note + xoá line cũ để ghi lại.
          await tx
            .update(payrollRuns)
            .set({ note: input.note ?? null })
            .where(eq(payrollRuns.id, run.id));
          await tx.delete(payrollLines).where(eq(payrollLines.runId, run.id));
        } else {
          [run] = await tx
            .insert(payrollRuns)
            .values({
              periodId: input.periodId,
              status: "draft",
              note: input.note ?? null,
            })
            .returning();
        }

        const lines = preview.length
          ? await tx
              .insert(payrollLines)
              .values(
                preview.map((p) => ({
                  runId: run!.id,
                  userId: p.userId,
                  compositeScore: p.composite,
                  floorSalary: p.floorSalary,
                  perfSalary: p.perfSalary,
                  bonus: 0,
                  total: p.total,
                }))
              )
              .returning()
          : [];

        return { run: run!, lines };
      });
    }),

  // ─── Xem các đợt đã chốt ────────────────────────────────
  /** Danh sách các đợt trả lương (chairman). */
  listRuns: chairmanProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(payrollRuns)
      .orderBy(desc(payrollRuns.createdAt));
  }),

  /** Chi tiết 1 đợt + các dòng lương (join user) (chairman). */
  getRun: chairmanProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [run] = await ctx.db
        .select()
        .from(payrollRuns)
        .where(eq(payrollRuns.id, input.runId))
        .limit(1);
      if (!run) return null;

      const lines = await ctx.db
        .select({
          id: payrollLines.id,
          userId: payrollLines.userId,
          userName: users.name,
          userImage: users.image,
          compositeScore: payrollLines.compositeScore,
          floorSalary: payrollLines.floorSalary,
          perfSalary: payrollLines.perfSalary,
          bonus: payrollLines.bonus,
          total: payrollLines.total,
        })
        .from(payrollLines)
        .innerJoin(users, eq(payrollLines.userId, users.id))
        .where(eq(payrollLines.runId, input.runId))
        .orderBy(desc(payrollLines.total));

      return { run, lines };
    }),

  /**
   * Cập nhật bonus cho 1 dòng lương (chairman) + tính lại total.
   *
   * TODO (phase sau): Bonus "DT BU" tự động = 40% phí chia sẻ doanh thu của BU,
   * chia cho các thành viên theo tỉ trọng LƯƠNG CỨNG (floorSalary):
   *   bonusUser = 0.4 · revShareFeeBU · (floorSalaryUser / Σ floorSalary thành viên BU)
   * Hiện tại nhập tay.
   */
  setBonus: chairmanProcedure
    .input(z.object({ lineId: z.string(), bonus: z.number().min(0) }))
    .mutation(async ({ ctx, input }) => {
      const [line] = await ctx.db
        .select()
        .from(payrollLines)
        .where(eq(payrollLines.id, input.lineId))
        .limit(1);
      if (!line) throw new Error("Payroll line not found");

      const bonus = round2(input.bonus);
      const total = round2(line.floorSalary + line.perfSalary + bonus);
      const [updated] = await ctx.db
        .update(payrollLines)
        .set({ bonus, total })
        .where(eq(payrollLines.id, input.lineId))
        .returning();
      return updated;
    }),
});
