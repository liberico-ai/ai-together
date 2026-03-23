import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const documents = pgTable("documents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  type: text("type").notNull().default("file"), // 'file' | 'link'
  url: text("url").notNull(),
  s3Key: text("s3_key"), // Direct S3 key for secure deletion/presigned URLs
  fileSize: integer("file_size"),
  targetType: text("target_type").notNull(), // 'project' | 'module' | 'task'
  targetId: text("target_id").notNull(),
  uploadedBy: text("uploaded_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_documents_target").on(table.targetType, table.targetId),
]);
