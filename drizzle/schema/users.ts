import { pgTable, text, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "chairman", "bom", "user"]);

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  username: text("username").unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false),
  image: text("image"),
  role: roleEnum("role").notNull().default("user"),
  apiKey: text("api_key").unique(),
  avatarUrl: text("avatar_url"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userGithubMap = pgTable("user_github_map", {
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  githubUsername: text("github_username").notNull().unique(),
  githubVerified: boolean("github_verified").default(false).notNull(),
  linkedAt: timestamp("linked_at").defaultNow(),
});

export const userJiraMap = pgTable("user_jira_map", {
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  jiraAccountId: text("jira_account_id").notNull().unique(),
  linkedAt: timestamp("linked_at").defaultNow(),
});
