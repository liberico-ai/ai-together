import { pgTable, text, timestamp, pgEnum, index, integer, real } from "drizzle-orm/pg-core";
import { users } from "./users";
import { modules } from "./modules";
import { projects } from "./projects";
import { businessUnits } from "./business-units";

export const taskStatusEnum = pgEnum("task_status", [
  "planned",
  "in_progress",
  "blocked", // ← MỚI: việc đang bị vướng mắc (Mục tiêu 1)
  "in_review",
  "changes_requested",
  "done",
]);

export const priorityEnum = pgEnum("priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const taskCategoryEnum = pgEnum("task_category", [
  "project",
  "operations",
]);

// Loại công việc — dùng để định lượng & tính phí theo BU (Mục tiêu 3)
export const workTypeEnum = pgEnum("work_type", [
  "build",          // xây dựng tính năng (tính IVP → phí xây dựng)
  "change_request", // CR nhỏ
  "integration",    // tích hợp ngoài
  "report",         // custom report
  "maintenance",    // bảo trì
  "ops",            // vận hành
]);

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(), // TASK-001 format
  category: taskCategoryEnum("category").default("project").notNull(),
  domain: text("domain"), // legacy text — giữ để tương thích, thay dần bằng buId
  buId: text("bu_id").references(() => businessUnits.id, { onDelete: "set null" }), // ← MỚI
  workType: workTypeEnum("work_type").default("build").notNull(), // ← MỚI
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" }),
  moduleId: text("module_id")
    .references(() => modules.id, { onDelete: "set null" }),
  // ── Việc con (subtask) ─────────────────────────────────
  parentTaskId: text("parent_task_id"), // self-ref (FK khai báo ở relations để tránh vòng lặp)
  jiraIssueKey: text("jira_issue_key"),
  title: text("title").notNull(),
  description: text("description"),
  // assigneeId = "người phụ trách chính" (optional). Danh sách đầy đủ ở task_assignees.
  assigneeId: text("assignee_id").references(() => users.id),
  status: taskStatusEnum("status").default("planned").notNull(),
  priority: priorityEnum("priority").default("medium").notNull(),
  // ── Định lượng công việc (Mục tiêu 2 & 3) ───────────────
  ivp: real("ivp").default(1).notNull(), // Internal Value Point: 0.5/1/2/3/5
  estimateDays: integer("estimate_days"),
  progressPct: integer("progress_pct").default(0), // 0-100, tuỳ chọn cho task lớn
  deadline: timestamp("deadline"),
  completedAt: timestamp("completed_at"), // mốc hoàn thành thực tế (đo % đúng hạn)
  // ── Vướng mắc (Mục tiêu 1) ──────────────────────────────
  blockedReason: text("blocked_reason"),
  blockedBy: text("blocked_by"),        // đang chờ ai/BU/đối tác ngoài (text tự do)
  blockedSince: timestamp("blocked_since"),
  createdBy: text("created_by").references(() => users.id), // người tạo = người chịu trách nhiệm đóng việc
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_tasks_project").on(table.projectId),
  index("idx_tasks_module").on(table.moduleId),
  index("idx_tasks_assignee").on(table.assigneeId),
  index("idx_tasks_category").on(table.category),
  index("idx_tasks_bu").on(table.buId),
  index("idx_tasks_parent").on(table.parentTaskId),
  index("idx_tasks_status").on(table.status),
]);
