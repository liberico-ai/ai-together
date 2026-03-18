import { relations } from "drizzle-orm";
import { users, userGithubMap } from "./users";
import { projects, projectMembers } from "./projects";
import { modules } from "./modules";
import { tasks } from "./tasks";
import { documents } from "./documents";
import { comments, commentAttachments } from "./comments";
import { notifications, activityLogs } from "./notifications";
import { scoreEvents, reviewScores } from "./scoring";
import { githubCommits, githubIssueMap } from "./github";
import { reviews } from "./reviews";

export const usersRelations = relations(users, ({ many, one }) => ({
  githubMap: one(userGithubMap, {
    fields: [users.id],
    references: [userGithubMap.userId],
  }),
  projectsAsChairman: many(projects),
  projectMemberships: many(projectMembers),
  assignedModules: many(modules),
  assignedTasks: many(tasks, { relationName: "assignee" }),
  createdTasks: many(tasks, { relationName: "creator" }),
  uploadedDocuments: many(documents),
  authoredComments: many(comments),
  notifications: many(notifications),
  activityLogs: many(activityLogs),
  scoreEvents: many(scoreEvents),
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

export const modulesRelations = relations(modules, ({ one, many }) => ({
  project: one(projects, {
    fields: [modules.projectId],
    references: [projects.id],
  }),
  assignee: one(users, {
    fields: [modules.assigneeId],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  module: one(modules, {
    fields: [tasks.moduleId],
    references: [modules.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: "assignee",
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "creator",
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
