import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "chairman", "user"]);

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: text("email_verified").default("false"),
  image: text("image"),
  role: roleEnum("role").notNull().default("user"),
  apiKey: text("api_key").unique(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userGithubMap = pgTable("user_github_map", {
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  githubUsername: text("github_username").notNull().unique(),
  linkedAt: timestamp("linked_at").defaultNow(),
});
