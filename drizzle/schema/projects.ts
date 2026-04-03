import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  primaryKey,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "active",
  "on_hold",
  "done",
  "archived",
]);

export const projects = pgTable("projects", {
  id: text("id").primaryKey(), // PROJ-001 format
  title: text("title").notNull(),
  description: text("description"),
  repoUrl: text("repo_url"),
  githubOwner: text("github_owner"),
  githubRepo: text("github_repo"),
  jiraProjectKey: text("jira_project_key"),
  webhookSecret: text("webhook_secret"),
  chairmanId: text("chairman_id").references(() => users.id),
  status: projectStatusEnum("status").default("planning").notNull(),
  scoringRubric: text("scoring_rubric"), // JSON string
  startDate: timestamp("start_date"),
  deadline: timestamp("deadline"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })]
);
