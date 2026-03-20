import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const reviews = pgTable("reviews", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  targetType: text("target_type").notNull(), // 'module' | 'task'
  targetId: text("target_id").notNull(),
  reviewerId: text("reviewer_id")
    .references(() => users.id)
    .notNull(),
  status: text("status").notNull(), // 'approved' | 'changes_requested'
  note: text("note"),
  metaData: text("meta_data"), // To store JSON string of Rubric Scores
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
