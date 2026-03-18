import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { users } from "./users";

export const documents = pgTable("documents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  type: text("type").notNull().default("file"), // 'file' | 'link'
  url: text("url").notNull(),
  fileSize: integer("file_size"),
  targetType: text("target_type").notNull(), // 'project' | 'module' | 'task'
  targetId: text("target_id").notNull(),
  uploadedBy: text("uploaded_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
