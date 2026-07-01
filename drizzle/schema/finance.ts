import {
  pgTable,
  text,
  timestamp,
  bigint,
  real,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { businessUnits } from "./business-units";

/**
 * MỤC TIÊU 3 — Tài chính: công cụ hoá Mô hình tài chính v7.2 (Sheet 2, 3, 5).
 * 3 bảng: cost_items (chi phí), bu_revenues (doanh thu theo BU/tháng/cơ chế),
 * ivp_ledger (cầu nối giữa "công việc" — IVP — và "tiền" — phí xây dựng).
 * Tất cả số tiền lưu ở đơn vị VND (bigint). Router quy đổi ra triệu VND khi trả về.
 */

// ── Chi phí (Sheet 2): lương / hạ tầng / license / văn phòng ──
export const costItems = pgTable("cost_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  category: text("category").notNull(), // 'salary' | 'infra' | 'license' | 'office'
  vendor: text("vendor"),
  amountVnd: bigint("amount_vnd", { mode: "number" }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Doanh thu theo BU / tháng / cơ chế charge (Sheet 3 & 5) ──
export const buRevenues = pgTable(
  "bu_revenues",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    buId: text("bu_id")
      .notNull()
      .references(() => businessUnits.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // "2026-07"
    mechanism: text("mechanism").notNull(), // 'revenue_share' | 'subscription' | 'build_24m'
    amountVnd: bigint("amount_vnd", { mode: "number" }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_bu_revenues_bu").on(table.buId),
    unique("uq_bu_revenue_month_mechanism").on(
      table.buId,
      table.month,
      table.mechanism
    ),
  ]
);

// ── IVP ledger: tổng IVP theo BU → phí xây dựng (Sheet 3) ──
export const ivpLedger = pgTable(
  "ivp_ledger",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    buId: text("bu_id")
      .notNull()
      .references(() => businessUnits.id, { onDelete: "cascade" }),
    totalIvp: real("total_ivp").default(0).notNull(),
    ivpPrice: bigint("ivp_price", { mode: "number" }).default(2000000).notNull(), // 2tr/IVP
    chargeMultiplier: real("charge_multiplier").default(1).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique("uq_ivp_ledger_bu").on(table.buId)]
);

// ── Relations ──
export const buRevenuesRelations = relations(buRevenues, ({ one }) => ({
  bu: one(businessUnits, {
    fields: [buRevenues.buId],
    references: [businessUnits.id],
  }),
}));

export const ivpLedgerRelations = relations(ivpLedger, ({ one }) => ({
  bu: one(businessUnits, {
    fields: [ivpLedger.buId],
    references: [businessUnits.id],
  }),
}));
