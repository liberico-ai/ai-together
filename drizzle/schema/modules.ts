import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";

export const modules = pgTable("modules", {
  id: text("id").primaryKey(), // MOD-001 format
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: text("assignee_id").references(() => users.id),
  status: text("status").notNull().default("planned"), // reuse task_status values
  deadline: timestamp("deadline"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
