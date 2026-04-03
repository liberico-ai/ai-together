import { router } from "@/server/trpc";
import { projectsRouter } from "./projects";
import { modulesRouter } from "./modules";
import { tasksRouter } from "./tasks";
import { documentsRouter } from "./documents";
import { commentsRouter } from "./comments";
import { reviewsRouter } from "./reviews";
import { dashboardRouter } from "./dashboard";
import { notificationsRouter } from "./notifications";
import { usersRouter } from "./users";
import { chatRouter } from "./chat";
import { operationsRouter } from "./operations";

export const appRouter = router({
  projects: projectsRouter,
  modules: modulesRouter,
  tasks: tasksRouter,
  documents: documentsRouter,
  comments: commentsRouter,
  reviews: reviewsRouter,
  dashboard: dashboardRouter,
  notifications: notificationsRouter,
  users: usersRouter,
  chat: chatRouter,
  operations: operationsRouter,
});

export type AppRouter = typeof appRouter;
