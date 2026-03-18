import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { users } from "./users";

export const scoreEvents = pgTable("score_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  eventType: text("event_type").notNull(), // 'task_done', 'task_early', 'task_late', 'comment', 'doc_approved', 'commit'
  points: integer("points").notNull(),
  refType: text("ref_type"), // 'task' | 'comment' | 'document' | 'commit'
  refId: text("ref_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reviewScores = pgTable("review_scores", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("task_id").notNull(),
  reviewerId: text("reviewer_id")
    .references(() => users.id)
    .notNull(),
  score: integer("score").notNull(), // 0-10
  feedback: text("feedback").notNull(),
  qualityNotes: text("quality_notes"),
  submittedVia: text("submitted_via").notNull().default("web"), // 'web' | 'mcp'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
