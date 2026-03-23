import { pgTable, text, timestamp, integer, unique, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";

export const githubCommits = pgTable("github_commits", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  sha: text("sha").notNull(),
  message: text("message").notNull(),
  authorGithub: text("author_github"),
  authorUserId: text("author_user_id").references(() => users.id),
  branch: text("branch"),
  committedAt: timestamp("committed_at").notNull(),
  // CI/CD status tracking
  ciStatus: text("ci_status"),          // "pending" | "success" | "failure" | "error" | null
  ciUrl: text("ci_url"),                // Link to CI details page
  ciUpdatedAt: timestamp("ci_updated_at"),
}, (table) => [
  unique("github_commits_sha_project_unique").on(table.sha, table.projectId),
  index("idx_github_commits_project_committed").on(table.projectId, table.committedAt),
]);

export const githubIssueMap = pgTable("github_issue_map", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("task_id").notNull(),
  githubRepo: text("github_repo").notNull(),
  issueNumber: integer("issue_number").notNull(),
  issueUrl: text("issue_url"),
  syncedAt: timestamp("synced_at").defaultNow(),
});
