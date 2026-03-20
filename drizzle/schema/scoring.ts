import { pgTable, text, timestamp, integer, date, unique, index } from "drizzle-orm/pg-core";
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
}, (table) => [
  unique("uq_score_user_event_ref").on(table.userId, table.eventType, table.refId),
  index("idx_score_events_user_created").on(table.userId, table.createdAt),
]);

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

// Track daily user activity for tempo/streak calculation
export const userActivityLog = pgTable("user_activity_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  activityDate: date("activity_date").notNull(),
  loginCount: integer("login_count").default(1).notNull(),
  actionCount: integer("action_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("uq_user_activity_date").on(table.userId, table.activityDate),
]);
