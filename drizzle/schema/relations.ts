import { relations } from "drizzle-orm";
import { users, userGithubMap } from "./users";
import { projects, projectMembers } from "./projects";
import { businessUnits } from "./business-units";
import { modules } from "./modules";
import { tasks } from "./tasks";
import { taskAssignees } from "./task-assignees";
import { documents } from "./documents";
import { comments, commentAttachments } from "./comments";
import { notifications, activityLogs } from "./notifications";
import { scoreEvents, reviewScores, userActivityLog } from "./scoring";
import { githubCommits } from "./github";
import { reviews } from "./reviews";
import {
  conversations,
  conversationParticipants,
  messages,
  messageReactions,
} from "./chat";
import { operations } from "./operations";

export const usersRelations = relations(users, ({ many, one }) => ({
  githubMap: one(userGithubMap, {
    fields: [users.id],
    references: [userGithubMap.userId],
  }),
  projectsAsChairman: many(projects),
  projectMemberships: many(projectMembers),
  createdModules: many(modules, { relationName: "creator" }),
  assignedTasks: many(tasks),
  createdTasks: many(tasks, { relationName: "taskCreator" }),
  taskAssignments: many(taskAssignees), // việc được giao (đa người nhận)
  ledBusinessUnits: many(businessUnits), // BU do người này làm lead (BOM)
  uploadedDocuments: many(documents),
  authoredComments: many(comments),
  notifications: many(notifications),
  activityLogs: many(activityLogs),
  scoreEvents: many(scoreEvents),
  dailyActivity: many(userActivityLog),
  givenReviews: many(reviews),
  givenReviewScores: many(reviewScores),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  chairman: one(users, {
    fields: [projects.chairmanId],
    references: [users.id],
  }),
  members: many(projectMembers),
  modules: many(modules),
  tasks: many(tasks),
  commits: many(githubCommits),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));

export const modulesRelations = relations(modules, ({ one }) => ({
  project: one(projects, {
    fields: [modules.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [modules.createdBy],
    references: [users.id],
    relationName: "creator",
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  bu: one(businessUnits, {
    fields: [tasks.buId],
    references: [businessUnits.id],
  }),
  module: one(modules, {
    fields: [tasks.moduleId],
    references: [modules.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "taskCreator",
  }),
  // Việc con (subtask)
  parent: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: "subtasks",
  }),
  subtasks: many(tasks, { relationName: "subtasks" }),
  // Nhiều người nhận việc
  assignees: many(taskAssignees),
}));

// ── Business Unit Relations ────────────────────────────────
export const businessUnitsRelations = relations(businessUnits, ({ one, many }) => ({
  lead: one(users, {
    fields: [businessUnits.leadUserId],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

// ── Task Assignees Relations (đa người nhận) ───────────────
export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAssignees.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskAssignees.userId],
    references: [users.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
  attachments: many(commentAttachments),
}));

export const commentAttachmentsRelations = relations(commentAttachments, ({ one }) => ({
  comment: one(comments, {
    fields: [commentAttachments.commentId],
    references: [comments.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  reviewer: one(users, {
    fields: [reviews.reviewerId],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  uploader: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
}));

// ── Chat Relations ─────────────────────────────────────────

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  project: one(projects, {
    fields: [conversations.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [conversations.createdBy],
    references: [users.id],
  }),
  participants: many(conversationParticipants),
  messages: many(messages),
}));

export const conversationParticipantsRelations = relations(
  conversationParticipants,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationParticipants.conversationId],
      references: [conversations.id],
    }),
    user: one(users, {
      fields: [conversationParticipants.userId],
      references: [users.id],
    }),
  })
);

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  replyTo: one(messages, {
    fields: [messages.replyToId],
    references: [messages.id],
    relationName: "replies",
  }),
  replies: many(messages, { relationName: "replies" }),
  reactions: many(messageReactions),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(messages, {
    fields: [messageReactions.messageId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [messageReactions.userId],
    references: [users.id],
  }),
}));

export const operationsRelations = relations(operations, ({ one }) => ({
  assignee: one(users, {
    fields: [operations.assigneeId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [operations.createdBy],
    references: [users.id],
    relationName: "operationsCreator",
  }),
}));
