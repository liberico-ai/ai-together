import { router, protectedProcedure } from "../index";
import { scoreEvents, userActivityLog } from "@drizzle/schema/scoring";
import { users } from "@drizzle/schema/users";
import { projects } from "@drizzle/schema/projects";
import { modules } from "@drizzle/schema/modules";
import { eq, sql, desc, gte, and } from "drizzle-orm";
import { z } from "zod";
import { calculateTempoBonus, getCurrentStreak } from "@/lib/scoring";

export const dashboardRouter = router({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    // 1. Module Stats
    const allModules = await ctx.db.query.modules.findMany({
      where: eq(modules.assigneeId, ctx.user.id),
      columns: { id: true, status: true, deadline: true }
    });

    const now = new Date();
    let assigned = allModules.length;
    let inProgress = 0;
    let completed = 0;
    let mOverdue = 0;

    allModules.forEach(mod => {
      if (mod.status === "in_progress" || mod.status === "in_review") inProgress++;
      if (mod.status === "done") completed++;
      if (mod.status !== "done" && mod.deadline && new Date(mod.deadline) < now) mOverdue++;
    });

    // 2. Project Stats
    const allProjects = await ctx.db.query.projects.findMany({
      columns: { id: true, status: true, deadline: true }
    });
    
    let pTotal = allProjects.length;
    let pActive = 0;
    let pCompleted = 0;
    let pOverdue = 0;

    allProjects.forEach(proj => {
      if (proj.status === "active" || proj.status === "planning") pActive++;
      if (proj.status === "done") pCompleted++;
      if (proj.status !== "done" && proj.deadline && new Date(proj.deadline) < now) pOverdue++;
    });

    return { 
      modules: { assigned, inProgress, completed, overdue: mOverdue },
      projects: { total: pTotal, active: pActive, completed: pCompleted, overdue: pOverdue }
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
        .groupBy(users.id, users.name, users.username)
        .orderBy(desc(sql`SUM(${scoreEvents.points})`));

      const periodDays = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 365;
      
      const enrichedResults = await Promise.all(
        results.map(async (user) => {
          const activityLogs = await ctx.db.query.userActivityLog.findMany({
            where: eq(userActivityLog.userId, user.userId),
            columns: { activityDate: true, actionCount: true },
          });

          const tempo = calculateTempoBonus(activityLogs, periodDays);
          const streak = getCurrentStreak(activityLogs);
          const totalPoints = user.totalBasePoints + tempo.total;

          return {
            userId: user.userId,
            name: user.name,
            username: user.username,
            reviewPoints: user.reviewPoints,
            autoPoints: user.autoPoints,
            tempoBonus: tempo.total,
            totalPoints,
            streak,
          };
        })
      );

      return enrichedResults
        .filter(u => u.totalPoints > 0)
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .slice(0, 20);
    }),

  getActiveProjects: protectedProcedure.query(async ({ ctx }) => {
    // Determine active projects the user is involved in
    // For simplicity, we fetch all projects with status "active" or "planning"
    // Wait, earlier we saw project status is active, so we query active.
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
        modules: {
          columns: { id: true, status: true },
        }
      },
    });

    return activeProjects.map(project => {
      const totalModules = project.modules.length;
      const doneModules = project.modules.filter(m => m.status === "done").length;
      const progressPct = totalModules === 0 ? 0 : Math.round((doneModules / totalModules) * 100);

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
      columns: { id: true, title: true }
    });
    
    const result = [];
    for (const p of allProjects) {
      const mods = await ctx.db.query.modules.findMany({ 
        where: eq(modules.projectId, p.id), 
        columns: { status: true } 
      });
      const total = mods.length;
      const done = mods.filter(m => m.status === "done").length;
      
      const shortName = p.title.length > 20 ? p.title.slice(0, 17) + "..." : p.title;
      result.push({ 
        name: shortName, 
        done, 
        pending: total - done, 
        total,
        pct: total > 0 ? Math.round((done/total)*100) : 0 
      });
    }
    return result;
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
