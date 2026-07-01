import { pgTable, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { users } from "./users";

// Cơ chế charge của từng BU (dùng cho Mục tiêu 3 — tài chính)
export const buChargeModelEnum = pgEnum("bu_charge_model", [
  "revenue_share", // LBRC: % doanh thu sản phẩm mới
  "subscription",  // XECA: phí cố định hàng tháng
  "build_24m",     // IBSHI: trả góp phí xây dựng 24 tháng
]);

/**
 * business_units — đơn vị kinh doanh nội bộ (LBRC, IBSHI, XECA).
 * Nâng `tasks.domain` (text tự do) thành entity chuẩn hoá, là trục trung tâm
 * của cả 3 mục tiêu: theo dõi công việc, năng suất, tài chính.
 */
export const businessUnits = pgTable(
  "business_units",
  {
    id: text("id").primaryKey(), // BU-001 format
    code: text("code").notNull().unique(), // "LBRC" | "IBSHI" | "XECA"
    name: text("name").notNull(),
    description: text("description"),
    // BOM lead phụ trách BU này (Quân / Phương / Toàn)
    leadUserId: text("lead_user_id").references(() => users.id),
    // Liên kết Jira: khi webhook về, map project key → BU
    jiraProjectKey: text("jira_project_key"),
    // Cơ chế tài chính
    chargeModel: buChargeModelEnum("charge_model").default("subscription").notNull(),
    isActive: text("is_active").default("true").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_bu_lead").on(table.leadUserId)]
);
