import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  pgEnum,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";

// ── Enums ──────────────────────────────────────────────────

export const conversationTypeEnum = pgEnum("conversation_type", [
  "direct",
  "group",
  "project",
]);

export const participantRoleEnum = pgEnum("participant_role", [
  "admin",
  "member",
]);

export const messageTypeEnum = pgEnum("message_type", [
  "text",
  "image",
  "file",
  "system",
]);

// ── conversations ──────────────────────────────────────────

export const conversations = pgTable(
  "conversations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    type: conversationTypeEnum("type").notNull(),
    title: text("title"),
    avatarUrl: text("avatar_url"),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by")
      .references(() => users.id)
      .notNull(),
    lastMessageAt: timestamp("last_message_at"),
    lastMessagePreview: text("last_message_preview"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_conversations_last_message").on(table.lastMessageAt),
    index("idx_conversations_project").on(table.projectId),
  ]
);

// ── conversation_participants ──────────────────────────────

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: participantRoleEnum("role").default("member").notNull(),
    lastReadAt: timestamp("last_read_at"),
    isMuted: boolean("is_muted").default(false).notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    unique("uq_participant").on(table.conversationId, table.userId),
    index("idx_participants_user").on(table.userId),
  ]
);

// ── messages ───────────────────────────────────────────────

export const messages = pgTable(
  "messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id").references(() => users.id, {
      onDelete: "set null",
    }),
    content: text("content"),
    messageType: messageTypeEnum("message_type").default("text").notNull(),
    mediaUrl: text("media_url"),
    mediaType: text("media_type"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    replyToId: text("reply_to_id"),
    isEdited: boolean("is_edited").default(false).notNull(),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_messages_conversation_created").on(
      table.conversationId,
      table.createdAt
    ),
    index("idx_messages_sender").on(table.senderId),
  ]
);

// ── message_reactions ──────────────────────────────────────

export const messageReactions = pgTable(
  "message_reactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("uq_reaction").on(table.messageId, table.userId, table.emoji),
  ]
);
