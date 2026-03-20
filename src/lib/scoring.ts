import { eq, sql, and } from "drizzle-orm";
import { scoreEvents, userActivityLog } from "@drizzle/schema/scoring";
import type { db as DB } from "@/server/db";

type DbClient = typeof DB;

/**
 * Record a score event for a user.
 */
export async function recordScore(
  db: DbClient,
  params: {
    userId: string;
    eventType: string;
    points: number;
    refType?: string;
    refId?: string;
  }
) {
  await db.insert(scoreEvents).values({
    userId: params.userId,
    eventType: params.eventType,
    points: params.points,
    refType: params.refType ?? null,
    refId: params.refId ?? null,
  });

  // Also record daily activity
  await recordActivity(db, params.userId);
}

/**
 * Record/upsert daily activity for a user (for tempo/streak tracking).
 * Called on any meaningful action: login, task update, comment, commit.
 */
export async function recordActivity(db: DbClient, userId: string) {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Try to increment actionCount if today's record exists, otherwise insert
  const existing = await db.query.userActivityLog.findFirst({
    where: and(
      eq(userActivityLog.userId, userId),
      eq(userActivityLog.activityDate, today)
    ),
  });

  if (existing) {
    await db
      .update(userActivityLog)
      .set({ actionCount: sql`${userActivityLog.actionCount} + 1` })
      .where(eq(userActivityLog.id, existing.id));
  } else {
    await db.insert(userActivityLog).values({
      userId,
      activityDate: today,
      loginCount: 1,
      actionCount: 1,
    });
  }
}

/**
 * Score points table:
 * - module_early:  +15 (done before deadline)
 * - module_done:   +10 (done on time / no deadline)
 * - module_late:   +5  (done after deadline)
 * - comment:       +1
 * - commit:        +2
 * - doc_approved:  +3
 */
export const SCORE_POINTS = {
  MODULE_EARLY: 15,
  MODULE_DONE: 10,
  MODULE_LATE: 5,
  COMMENT: 1,
  COMMIT: 2,
  DOC_APPROVED: 3,
} as const;

/**
 * Determine the score event type based on module deadline.
 */
export function getModuleScoreType(deadline: Date | null): {
  eventType: string;
  points: number;
} {
  if (!deadline) {
    return { eventType: "module_done", points: SCORE_POINTS.MODULE_DONE };
  }

  const now = new Date();
  if (now < deadline) {
    return { eventType: "module_early", points: SCORE_POINTS.MODULE_EARLY };
  } else {
    return { eventType: "module_late", points: SCORE_POINTS.MODULE_LATE };
  }
}

// ─── Tempo Bonus Calculation ──────────────────────────────

export const TEMPO_BONUS = {
  STREAK_3: 5,     // 3 consecutive days
  STREAK_7: 15,    // 7 consecutive days
  BUSY_DAY: 3,     // ≥5 actions in a day
  WEEKEND: 2,      // Activity on Saturday or Sunday
} as const;

type ActivityLogEntry = {
  activityDate: string; // YYYY-MM-DD
  actionCount: number;
};

/**
 * Calculate tempo bonus points from activity logs within a date range.
 * @param logs - Array of { activityDate, actionCount }
 * @param periodDays - Rolling window in days (7, 30, etc.)
 */
export function calculateTempoBonus(
  logs: ActivityLogEntry[],
  periodDays: number = 30
): { total: number; streakBonus: number; busyDayBonus: number; weekendBonus: number } {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - periodDays);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  // Filter to period
  const periodLogs = logs.filter(l => l.activityDate >= cutoffStr);
  const activeDates = new Set(periodLogs.map(l => l.activityDate));

  let streakBonus = 0;
  let busyDayBonus = 0;
  let weekendBonus = 0;

  // === Streak bonuses ===
  // Find all streaks in the period
  const sortedDates = [...activeDates].sort();
  let currentStreak = 0;
  let prevDate: Date | null = null;

  for (const dateStr of sortedDates) {
    const d = new Date(dateStr + "T00:00:00");
    if (prevDate) {
      const diffDays = Math.round((d.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
    } else {
      currentStreak = 1;
    }
    prevDate = d;

    // Award streak bonuses at milestones
    if (currentStreak === 3) streakBonus += TEMPO_BONUS.STREAK_3;
    if (currentStreak === 7) streakBonus += TEMPO_BONUS.STREAK_7;
    // Repeat every 7 days for extended streaks
    if (currentStreak > 7 && currentStreak % 7 === 0) streakBonus += TEMPO_BONUS.STREAK_7;
  }

  // === Busy day bonuses ===
  for (const log of periodLogs) {
    if (log.actionCount >= 5) {
      busyDayBonus += TEMPO_BONUS.BUSY_DAY;
    }
  }

  // === Weekend warrior bonuses ===
  for (const dateStr of activeDates) {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getDay(); // 0=Sunday, 6=Saturday
    if (day === 0 || day === 6) {
      weekendBonus += TEMPO_BONUS.WEEKEND;
    }
  }

  return {
    total: streakBonus + busyDayBonus + weekendBonus,
    streakBonus,
    busyDayBonus,
    weekendBonus,
  };
}

/**
 * Get the current consecutive active day streak for a user.
 * @param logs - Activity logs sorted by date descending is fine; we sort internally
 */
export function getCurrentStreak(logs: ActivityLogEntry[]): number {
  if (logs.length === 0) return 0;

  const sortedDates = [...new Set(logs.map(l => l.activityDate))].sort().reverse(); // Most recent first
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // Streak must include today or yesterday to be "current"
  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const current = new Date(sortedDates[i - 1] + "T00:00:00");
    const prev = new Date(sortedDates[i] + "T00:00:00");
    const diffDays = Math.round((current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

