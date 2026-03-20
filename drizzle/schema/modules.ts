import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";
import { priorityEnum } from "./tasks";

export const modules = pgTable("modules", {
  id: text("id").primaryKey(), // MOD-001 format
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: text("assignee_id").references(() => users.id),
  status: text("status").notNull().default("planned"), // planned, in_progress, in_review, changes_requested, done
  priority: priorityEnum("priority").default("medium").notNull(),
  checklist: jsonb("checklist").default([]).$type<{ text: string; done: boolean }[]>(),
  output: text("output"),
  deadline: timestamp("deadline"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_modules_project").on(table.projectId),
  index("idx_modules_assignee").on(table.assigneeId),
]);
