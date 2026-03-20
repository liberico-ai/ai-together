import { pgTable, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { modules } from "./modules";

export const taskStatusEnum = pgEnum("task_status", [
  "planned",
  "in_progress",
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

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(), // TASK-001 format
  moduleId: text("module_id")
    .references(() => modules.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: text("assignee_id").references(() => users.id),
  status: taskStatusEnum("status").default("planned").notNull(),
  priority: priorityEnum("priority").default("medium").notNull(),
  deadline: timestamp("deadline"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_tasks_module").on(table.moduleId),
  index("idx_tasks_assignee").on(table.assigneeId),
]);
