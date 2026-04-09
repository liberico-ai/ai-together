import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";

export const modules = pgTable("modules", {
  id: text("id").primaryKey(), // MOD-001 format
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  checklist: jsonb("checklist").default([]).$type<{ text: string; done: boolean }[]>(),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_modules_project").on(table.projectId),
]);
