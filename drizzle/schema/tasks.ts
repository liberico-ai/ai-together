import { pgTable, text, timestamp, pgEnum, index, integer } from "drizzle-orm/pg-core";
import { users } from "./users";
import { modules } from "./modules";
import { projects } from "./projects";

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

export const taskCategoryEnum = pgEnum("task_category", [
  "project",
  "operations",
]);

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(), // TASK-001 format
  category: taskCategoryEnum("category").default("project").notNull(),
  domain: text("domain"), // e.g. "BTNET", "LBROS", "Xeca" — used for operations tasks
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" }),
  moduleId: text("module_id")
    .references(() => modules.id, { onDelete: "set null" }),
  jiraIssueKey: text("jira_issue_key"),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: text("assignee_id").references(() => users.id),
  status: taskStatusEnum("status").default("planned").notNull(),
  priority: priorityEnum("priority").default("medium").notNull(),
  estimateDays: integer("estimate_days"),
  deadline: timestamp("deadline"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_tasks_project").on(table.projectId),
  index("idx_tasks_module").on(table.moduleId),
  index("idx_tasks_assignee").on(table.assigneeId),
  index("idx_tasks_category").on(table.category),
]);
