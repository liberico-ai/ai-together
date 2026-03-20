import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const comments = pgTable("comments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  targetType: text("target_type").notNull(), // 'module' | 'task'
  targetId: text("target_id").notNull(),
  authorId: text("author_id")
    .references(() => users.id)
    .notNull(),
  content: text("content").notNull(),
  parentId: text("parent_id"), // for threading
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_comments_target").on(table.targetType, table.targetId),
]);

export const commentAttachments = pgTable("comment_attachments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  commentId: text("comment_id")
    .references(() => comments.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull().default("file"), // 'file' | 'link'
  url: text("url").notNull(),
  title: text("title"),
});
