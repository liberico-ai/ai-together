import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  boolean,
  date,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

/**
 * KPI Composite Score theo quý (Mục tiêu 2).
 *
 * Composite = 0.35·Tempo + 0.25·Completion + 0.25·Quality + 0.15·AIAdoption
 * - Tempo: Σ IVP task done trong quý ÷ tempoTarget (từ score_events eventType='ivp_credit').
 * - Completion: % task done đúng hạn (completedAt ≤ deadline) ÷ completionTarget.
 * - Quality: đánh giá/nhập tay (feed từ GitHub qua quality_events).
 * - AIAdoption: mức dùng Copilot (feed từ ai_usage_logs).
 */

// ─── Kỳ KPI (quý) ─────────────────────────────────────────
export const kpiPeriods = pgTable("kpi_periods", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  quarter: text("quarter").notNull().unique(), // "2026-Q2"
  status: text("status").notNull().default("open"), // 'open' | 'scoring' | 'locked'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Target theo người & kỳ ───────────────────────────────
export const kpiTargets = pgTable(
  "kpi_targets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    periodId: text("period_id")
      .references(() => kpiPeriods.id)
      .notNull(),
    tempoTarget: real("tempo_target").notNull(), // IVP/quý
    completionTarget: real("completion_target").default(0.9).notNull(),
    qualityTarget: real("quality_target").default(1).notNull(),
    aiTarget: real("ai_target").default(1).notNull(),
  },
  (table) => [
    unique("uq_kpi_target_user_period").on(table.userId, table.periodId),
  ]
);

// ─── Điểm KPI đã tính theo người & kỳ ─────────────────────
export const kpiScores = pgTable(
  "kpi_scores",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    periodId: text("period_id")
      .references(() => kpiPeriods.id)
      .notNull(),
    tempoScore: real("tempo_score").notNull(),
    completionScore: real("completion_score").notNull(),
    qualityScore: real("quality_score").notNull(),
    aiScore: real("ai_score").notNull(),
    compositeScore: real("composite_score").notNull(),
    reviewerId: text("reviewer_id").references(() => users.id), // nullable
    note: text("note"),
    status: text("status").notNull().default("draft"), // 'draft' | 'submitted' | 'approved'
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("uq_kpi_score_user_period").on(table.userId, table.periodId),
  ]
);

// ─── Sự kiện chất lượng (feed từ GitHub/reviews) ──────────
export const qualityEvents = pgTable(
  "quality_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    periodId: text("period_id").references(() => kpiPeriods.id), // nullable
    type: text("type").notNull(), // 'bug_prod' | 'ci_fail' | 'review_reject' | 'incident' | 'req_reject'
    refId: text("ref_id"),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_quality_events_user").on(table.userId)]
);

// ─── Log sử dụng AI/Copilot per-user/ngày ─────────────────
export const aiUsageLogs = pgTable(
  "ai_usage_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    day: date("day").notNull(),
    activeFlag: boolean("active_flag").default(true).notNull(),
    acceptedSuggestions: integer("accepted_suggestions").default(0).notNull(),
    aiCreditsUsed: real("ai_credits_used").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique("uq_ai_usage_user_day").on(table.userId, table.day)]
);

// ─── Relations (khai báo tại chỗ để không đụng relations.ts chung) ──
export const kpiScoresRelations = relations(kpiScores, ({ one }) => ({
  user: one(users, {
    fields: [kpiScores.userId],
    references: [users.id],
    relationName: "kpiScoreUser",
  }),
  period: one(kpiPeriods, {
    fields: [kpiScores.periodId],
    references: [kpiPeriods.id],
  }),
  reviewer: one(users, {
    fields: [kpiScores.reviewerId],
    references: [users.id],
    relationName: "kpiScoreReviewer",
  }),
}));

export const kpiTargetsRelations = relations(kpiTargets, ({ one }) => ({
  user: one(users, {
    fields: [kpiTargets.userId],
    references: [users.id],
    relationName: "kpiTargetUser",
  }),
  period: one(kpiPeriods, {
    fields: [kpiTargets.periodId],
    references: [kpiPeriods.id],
  }),
}));
