import { pgTable, text, real, timestamp, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { kpiPeriods } from "./kpi";

/**
 * TRẢ LƯƠNG (Mục tiêu 2 — phần lương), mô hình v7.2.
 *
 * Lương thực nhận = Lương sàn (70%) + Lương hiệu suất (30%) × Composite Score.
 *   floorSalary = baseSalary · floorPct
 *   perfSalary  = baseSalary · perfPct · compositeScore   (composite lấy từ kpi_scores)
 *   total       = floorSalary + perfSalary + bonus
 *
 * Composite lấy từ kpi_scores theo đúng kỳ KPI (periodId → kpi_periods.id),
 * mặc định 1.0 nếu người đó chưa được chấm điểm trong kỳ.
 *
 * Đơn vị tiền: TRIỆU VND / tháng.
 */

// ─── Cấu hình lương đề xuất theo người ────────────────────
export const salaryConfigs = pgTable(
  "salary_configs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    // Tổng lương đề xuất (triệu VND/tháng) — chia thành sàn + hiệu suất.
    baseSalary: real("base_salary").notNull(),
    floorPct: real("floor_pct").default(0.7).notNull(), // 70%
    perfPct: real("perf_pct").default(0.3).notNull(), // 30%
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique("uq_salary_config_user").on(table.userId)]
);

// ─── Đợt trả lương (khớp 1 kỳ KPI để lấy composite) ───────
export const payrollRuns = pgTable("payroll_runs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  periodId: text("period_id")
    .references(() => kpiPeriods.id)
    .notNull(),
  status: text("status").notNull().default("draft"), // 'draft' | 'finalized'
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Dòng lương từng người trong 1 đợt ────────────────────
export const payrollLines = pgTable(
  "payroll_lines",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id")
      .references(() => payrollRuns.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    compositeScore: real("composite_score").notNull(),
    floorSalary: real("floor_salary").notNull(),
    perfSalary: real("perf_salary").notNull(),
    bonus: real("bonus").default(0).notNull(),
    total: real("total").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique("uq_payroll_line_run_user").on(table.runId, table.userId)]
);

// ─── Relations (khai báo tại chỗ, không đụng relations.ts chung) ──
export const salaryConfigsRelations = relations(salaryConfigs, ({ one }) => ({
  user: one(users, {
    fields: [salaryConfigs.userId],
    references: [users.id],
    relationName: "salaryConfigUser",
  }),
}));

export const payrollRunsRelations = relations(payrollRuns, ({ one, many }) => ({
  period: one(kpiPeriods, {
    fields: [payrollRuns.periodId],
    references: [kpiPeriods.id],
  }),
  lines: many(payrollLines),
}));

export const payrollLinesRelations = relations(payrollLines, ({ one }) => ({
  run: one(payrollRuns, {
    fields: [payrollLines.runId],
    references: [payrollRuns.id],
  }),
  user: one(users, {
    fields: [payrollLines.userId],
    references: [users.id],
    relationName: "payrollLineUser",
  }),
}));
