import { router, protectedProcedure } from "../index";
import { scoreEvents, userActivityLog } from "@drizzle/schema/scoring";
import { users } from "@drizzle/schema/users";
import { projects } from "@drizzle/schema/projects";
import { tasks } from "@drizzle/schema/tasks";
import { eq, ne, sql, desc, gte, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { calculateTempoBonus, getCurrentStreak } from "@/lib/scoring";

export const dashboardRouter = router({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    // 1. Task Stats — tasks assigned to the current user
    const allTasks = await ctx.db.query.tasks.findMany({
      where: eq(tasks.assigneeId, ctx.user.id),
      columns: { id: true, status: true, deadline: true },
    });

    const now = new Date();
    const assigned = allTasks.length;
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;

    for (const task of allTasks) {
      if (task.status === "in_progress" || task.status === "in_review") inProgress++;
      if (task.status === "done") completed++;
      if (task.status !== "done" && task.deadline && new Date(task.deadline) < now) overdue++;
    }

    // 2. Project Stats
    const allProjects = await ctx.db.query.projects.findMany({
      columns: { id: true, status: true, deadline: true },
    });

    const pTotal = allProjects.length;
    let pActive = 0;
    let pCompleted = 0;
    let pOverdue = 0;

    for (const proj of allProjects) {
      if (proj.status === "active" || proj.status === "planning") pActive++;
      if (proj.status === "done") pCompleted++;
      if (proj.status !== "done" && proj.deadline && new Date(proj.deadline) < now) pOverdue++;
    }

    return {
      tasks: { assigned, inProgress, completed, overdue },
      projects: { total: pTotal, active: pActive, completed: pCompleted, overdue: pOverdue },
    };
  }),

  getLeaderboard: protectedProcedure
    .input(z.object({
      period: z.enum(["today", "week", "month", "all"]).default("month"),
    }).optional())
    .query(async ({ ctx, input }) => {
      const period = input?.period ?? "month";

      const now = new Date();
      let cutoffDate: Date | null = null;

      if (period === "today") {
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === "week") {
        cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - 7);
      } else if (period === "month") {
        cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - 30);
      }

      const results = await ctx.db
        .select({
          userId: users.id,
          name: users.name,
          username: users.username,
          avatarUrl: users.avatarUrl,
          image: users.image,
          reviewPoints: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${scoreEvents.eventType} = 'module_done' OR ${scoreEvents.eventType} = 'module_early' OR ${scoreEvents.eventType} = 'module_late' OR ${scoreEvents.eventType} = 'task_done' OR ${scoreEvents.eventType} = 'task_early' OR ${scoreEvents.eventType} = 'task_late' THEN ${scoreEvents.points} ELSE 0 END), 0) AS INTEGER)`,
          autoPoints: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${scoreEvents.eventType} = 'comment' OR ${scoreEvents.eventType} = 'commit' OR ${scoreEvents.eventType} = 'doc_approved' THEN ${scoreEvents.points} ELSE 0 END), 0) AS INTEGER)`,
          totalBasePoints: sql<number>`CAST(COALESCE(SUM(${scoreEvents.points}), 0) AS INTEGER)`,
        })
        .from(users)
        .leftJoin(
          scoreEvents,
          cutoffDate
            ? and(eq(users.id, scoreEvents.userId), gte(scoreEvents.createdAt, cutoffDate))
            : eq(users.id, scoreEvents.userId)
        )
        .where(ne(users.role, "admin"))
        .groupBy(users.id, users.name, users.username, users.avatarUrl, users.image)
        .orderBy(desc(sql`SUM(${scoreEvents.points})`));

      const periodDays = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 365;

      // Batch fetch all activity logs at once (fix N+1)
      const userIds = results.map((u) => u.userId);
      const allActivityLogs = userIds.length > 0
        ? await ctx.db.query.userActivityLog.findMany({
            where: inArray(userActivityLog.userId, userIds),
            columns: { userId: true, activityDate: true, actionCount: true },
          })
        : [];

      // Group by userId for O(1) lookup
      const logsByUser = new Map<string, typeof allActivityLogs>();
      for (const log of allActivityLogs) {
        const existing = logsByUser.get(log.userId) ?? [];
        existing.push(log);
        logsByUser.set(log.userId, existing);
      }

      const enrichedResults = results.map((user) => {
        const activityLogs = logsByUser.get(user.userId) ?? [];
        const tempo = calculateTempoBonus(activityLogs, periodDays);
        const streak = getCurrentStreak(activityLogs);
        const totalPoints = user.totalBasePoints + tempo.total;

        return {
          userId: user.userId,
          name: user.name,
          username: user.username,
          avatarUrl: user.avatarUrl,
          image: user.image,
          reviewPoints: user.reviewPoints,
          autoPoints: user.autoPoints,
          tempoBonus: tempo.total,
          totalPoints,
          streak,
        };
      });

      return enrichedResults
        .filter(u => u.totalPoints > 0)
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .slice(0, 20);
    }),

  getActiveProjects: protectedProcedure.query(async ({ ctx }) => {
    const activeProjects = await ctx.db.query.projects.findMany({
      where: eq(projects.status, "active"),
      orderBy: (projects, { desc }) => [desc(projects.updatedAt)],
      with: {
        chairman: {
          columns: { id: true, name: true, email: true, role: true },
        },
        members: {
          with: {
            user: {
              columns: { id: true, name: true, email: true, role: true },
            },
          },
        },
        tasks: {
          columns: { id: true, status: true },
        },
      },
    });

    return activeProjects.map(project => {
      const totalTasks = project.tasks.length;
      const doneTasks = project.tasks.filter(t => t.status === "done").length;
      const progressPct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

      return {
        id: project.id,
        title: project.title,
        status: project.status,
        deadline: project.deadline,
        progressPct,
        members: project.members.map(m => m.user),
        chairman: project.chairman,
      };
    });
  }),

  getMyRankStats: protectedProcedure
    .input(z.object({
      period: z.enum(["today", "week", "month", "all"]).default("month"),
    }).optional())
    .query(async ({ ctx, input }) => {
      const period = input?.period ?? "month";
      const periodDays = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 365;

      const myActivityLogs = await ctx.db.query.userActivityLog.findMany({
        where: eq(userActivityLog.userId, ctx.user.id),
        columns: { activityDate: true, actionCount: true },
      });

      const tempo = calculateTempoBonus(myActivityLogs, periodDays);
      const streak = getCurrentStreak(myActivityLogs);

      const now = new Date();
      let cutoffDate: Date | null = null;
      if (period === "today") {
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === "week") {
        cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - 7);
      } else if (period === "month") {
        cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - 30);
      }

      const myScores = await ctx.db
        .select({
          total: sql<number>`CAST(COALESCE(SUM(${scoreEvents.points}), 0) AS INTEGER)`,
        })
        .from(scoreEvents)
        .where(
          cutoffDate
            ? and(eq(scoreEvents.userId, ctx.user.id), gte(scoreEvents.createdAt, cutoffDate))
            : eq(scoreEvents.userId, ctx.user.id)
        );

      const basePoints = myScores[0]?.total ?? 0;
      const totalPoints = basePoints + tempo.total;

      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dailyActivity = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const log = myActivityLogs.find(l => l.activityDate === dateStr);
        dailyActivity.push({
          date: dateStr,
          day: d.toLocaleDateString("en", { weekday: "short" }),
          actions: log?.actionCount ?? 0,
        });
      }

      return {
        totalPoints,
        tempoBonus: tempo.total,
        streakBonus: tempo.streakBonus,
        busyDayBonus: tempo.busyDayBonus,
        weekendBonus: tempo.weekendBonus,
        streak,
        bestStreak: Math.max(streak, ...findAllStreaks(myActivityLogs)),
        dailyActivity,
      };
    }),

  getProjectProgress: protectedProcedure.query(async ({ ctx }) => {
    const allProjects = await ctx.db.query.projects.findMany({
      where: eq(projects.status, "active"),
      columns: { id: true, title: true },
      with: {
        tasks: {
          columns: { status: true },
        },
      },
    });

    return allProjects.map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status === "done").length;
      const shortName =
        p.title.length > 20 ? p.title.slice(0, 17) + "..." : p.title;
      return {
        name: shortName,
        done,
        pending: total - done,
        total,
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    });
  }),

  getWorkloadOverview: protectedProcedure.query(async ({ ctx }) => {
    const allTasks = await ctx.db.query.tasks.findMany({
      columns: {
        id: true,
        status: true,
        priority: true,
        deadline: true,
        estimateDays: true,
        assigneeId: true,
        projectId: true,
      },
      with: {
        assignee: { columns: { id: true, name: true, email: true, image: true } },
        project: { columns: { id: true, title: true } },
      },
    });

    // Group by assignee
    const byMember = new Map<string, {
      user: { id: string; name: string | null; email: string; image: string | null };
      total: number;
      inProgress: number;
      done: number;
      overdue: number;
      totalEstimateDays: number;
    }>();

    const now = new Date();
    for (const task of allTasks) {
      if (!task.assigneeId || !task.assignee) continue;
      const key = task.assigneeId;
      if (!byMember.has(key)) {
        byMember.set(key, {
          user: task.assignee,
          total: 0,
          inProgress: 0,
          done: 0,
          overdue: 0,
          totalEstimateDays: 0,
        });
      }
      const m = byMember.get(key)!;
      m.total++;
      if (task.status === "in_progress" || task.status === "in_review") m.inProgress++;
      if (task.status === "done") m.done++;
      if (task.status !== "done" && task.deadline && new Date(task.deadline) < now) m.overdue++;
      if (task.estimateDays) m.totalEstimateDays += task.estimateDays;
    }

    // Summary stats
    const totalTasks = allTasks.length;
    const totalDone = allTasks.filter(t => t.status === "done").length;
    const totalInProgress = allTasks.filter(t => t.status === "in_progress" || t.status === "in_review").length;
    const totalOverdue = allTasks.filter(t => t.status !== "done" && t.deadline && new Date(t.deadline) < now).length;

    // Upcoming deadlines (next 7 days, not done)
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcoming = allTasks
      .filter(t => t.status !== "done" && t.deadline && new Date(t.deadline) >= now && new Date(t.deadline) <= nextWeek)
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
      .slice(0, 10);

    return {
      summary: { totalTasks, totalDone, totalInProgress, totalOverdue },
      members: Array.from(byMember.values())
        .map(m => ({
          user: m.user,
          total: m.total,
          inProgress: m.inProgress,
          done: m.done,
          overdue: m.overdue,
          totalEstimateDays: m.totalEstimateDays,
          completionRate: m.total > 0 ? Math.round((m.done / m.total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total),
      upcoming,
    };
  }),
});

// Helper: find all streak lengths from activity logs
function findAllStreaks(logs: { activityDate: string }[]): number[] {
  if (logs.length === 0) return [0];
  const dates = [...new Set(logs.map(l => l.activityDate))].sort();
  const streaks: number[] = [];
  let current = 1;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + "T00:00:00");
    const curr = new Date(dates[i] + "T00:00:00");
    const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      current++;
    } else {
      streaks.push(current);
      current = 1;
    }
  }
  streaks.push(current);
  return streaks;
}
