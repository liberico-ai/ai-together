import { pgTable, text, timestamp, real, unique, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { tasks } from "./tasks";

/**
 * task_assignees — cho phép GIAO 1 VIỆC CHO NHIỀU NGƯỜI.
 *
 * Nguồn sự thật (source of truth) về "ai đang làm việc này".
 * `tasks.assigneeId` cũ giữ lại làm "người phụ trách chính" (optional),
 * còn danh sách đầy đủ nằm ở bảng này.
 *
 * `contributionWeight` dùng để CHIA CREDIT IVP khi đo năng suất:
 *   IVP nhận được của mỗi người = task.ivp × (weight cá nhân / Σ weight)
 * Mặc định weight = 1 (chia đều). Có thể chỉnh nếu đóng góp không đều.
 */
export const taskAssignees = pgTable(
  "task_assignees",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contributionWeight: real("contribution_weight").default(1).notNull(),
    addedBy: text("added_by").references(() => users.id),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => [
    unique("uq_task_assignee").on(table.taskId, table.userId),
    index("idx_task_assignees_user").on(table.userId),
    index("idx_task_assignees_task").on(table.taskId),
  ]
);
