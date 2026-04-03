import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";

export const operationStatusEnum = pgEnum("operation_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

export const operations = pgTable("operations", {
  id: text("id").primaryKey(), // OP-001 format
  jiraIssueKey: text("jira_issue_key"), // e.g. LBR-123
  title: text("title").notNull(),
  description: text("description"),
  status: operationStatusEnum("status").default("open").notNull(),
  priority: text("priority").default("medium").notNull(),
  assigneeId: text("assignee_id").references(() => users.id),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
