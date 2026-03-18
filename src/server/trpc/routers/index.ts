import { router } from "@/server/trpc";
import { projectsRouter } from "./projects";
import { modulesRouter } from "./modules";
import { tasksRouter } from "./tasks";

export const appRouter = router({
  projects: projectsRouter,
  modules: modulesRouter,
  tasks: tasksRouter,
  // documents: documentsRouter,
  // comments: commentsRouter,
  // notifications: notificationsRouter,
  // leaderboard: leaderboardRouter,
  // users: usersRouter,
  // analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
