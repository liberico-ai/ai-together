import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getTaskScoreType,
  calculateTempoBonus,
  getCurrentStreak,
  creditTaskCompletion,
  SCORE_POINTS,
  TEMPO_BONUS,
} from '../scoring';

// A fixed "now" so deadline-relative logic is deterministic.
const NOW = new Date('2026-04-16T10:00:00.000Z'); // Thursday

// ─── getTaskScoreType ───────────────────────────────────────
describe('getTaskScoreType', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns task_done (no deadline)', () => {
    expect(getTaskScoreType(null)).toEqual({
      eventType: 'task_done',
      points: SCORE_POINTS.TASK_DONE,
    });
  });

  it('returns task_early when finished before the deadline', () => {
    const future = new Date('2026-04-20T00:00:00.000Z');
    expect(getTaskScoreType(future)).toEqual({
      eventType: 'task_early',
      points: SCORE_POINTS.TASK_EARLY,
    });
  });

  it('returns task_late when the deadline is already past', () => {
    const past = new Date('2026-04-10T00:00:00.000Z');
    expect(getTaskScoreType(past)).toEqual({
      eventType: 'task_late',
      points: SCORE_POINTS.TASK_LATE,
    });
  });
});

// ─── calculateTempoBonus ────────────────────────────────────
describe('calculateTempoBonus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function log(date: string, actionCount = 1) {
    return { activityDate: date, actionCount };
  }

  it('awards STREAK_3 for exactly three consecutive days', () => {
    const logs = [log('2026-04-13'), log('2026-04-14'), log('2026-04-15')];
    const r = calculateTempoBonus(logs, 30);
    expect(r.streakBonus).toBe(TEMPO_BONUS.STREAK_3);
  });

  it('awards STREAK_3 + STREAK_7 for a seven-day run', () => {
    const logs = [
      log('2026-04-09'),
      log('2026-04-10'),
      log('2026-04-11'),
      log('2026-04-12'),
      log('2026-04-13'),
      log('2026-04-14'),
      log('2026-04-15'),
    ];
    const r = calculateTempoBonus(logs, 30);
    // Hits the 3-day milestone and the 7-day milestone.
    expect(r.streakBonus).toBe(TEMPO_BONUS.STREAK_3 + TEMPO_BONUS.STREAK_7);
  });

  it('awards a busy-day bonus per day with >= 5 actions', () => {
    const logs = [log('2026-04-14', 5), log('2026-04-15', 9), log('2026-04-13', 2)];
    const r = calculateTempoBonus(logs, 30);
    expect(r.busyDayBonus).toBe(TEMPO_BONUS.BUSY_DAY * 2);
  });

  it('awards a weekend bonus for Saturday/Sunday activity', () => {
    // 2026-04-11 = Saturday, 2026-04-12 = Sunday, 2026-04-13 = Monday.
    const logs = [log('2026-04-11'), log('2026-04-12'), log('2026-04-13')];
    const r = calculateTempoBonus(logs, 30);
    expect(r.weekendBonus).toBe(TEMPO_BONUS.WEEKEND * 2);
  });

  it('ignores activity outside the rolling window', () => {
    const logs = [log('2026-01-01', 9)]; // > 30 days before NOW
    const r = calculateTempoBonus(logs, 30);
    expect(r.total).toBe(0);
    expect(r.streakBonus).toBe(0);
    expect(r.busyDayBonus).toBe(0);
    expect(r.weekendBonus).toBe(0);
  });

  it('total equals the sum of the three bonus components', () => {
    const logs = [
      log('2026-04-11', 6), // Sat, busy
      log('2026-04-12', 1), // Sun
      log('2026-04-13', 1), // Mon → streak of 3
    ];
    const r = calculateTempoBonus(logs, 30);
    expect(r.total).toBe(r.streakBonus + r.busyDayBonus + r.weekendBonus);
  });
});

// ─── getCurrentStreak ───────────────────────────────────────
describe('getCurrentStreak', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const today = '2026-04-16';
  const yesterday = '2026-04-15';

  it('returns 0 for an empty log', () => {
    expect(getCurrentStreak([])).toBe(0);
  });

  it('returns 0 when the most recent activity is neither today nor yesterday', () => {
    const logs = [{ activityDate: '2026-04-10', actionCount: 1 }];
    expect(getCurrentStreak(logs)).toBe(0);
  });

  it('counts a run ending today', () => {
    const logs = [
      { activityDate: '2026-04-14', actionCount: 1 },
      { activityDate: yesterday, actionCount: 1 },
      { activityDate: today, actionCount: 1 },
    ];
    expect(getCurrentStreak(logs)).toBe(3);
  });

  it('counts a run ending yesterday (still "current")', () => {
    const logs = [
      { activityDate: '2026-04-14', actionCount: 1 },
      { activityDate: yesterday, actionCount: 1 },
    ];
    expect(getCurrentStreak(logs)).toBe(2);
  });

  it('stops at the first gap', () => {
    const logs = [
      { activityDate: '2026-04-12', actionCount: 1 }, // gap before this
      { activityDate: '2026-04-14', actionCount: 1 },
      { activityDate: yesterday, actionCount: 1 },
      { activityDate: today, actionCount: 1 },
    ];
    // today, yesterday, 04-14 are consecutive; 04-12 breaks it → streak 3.
    expect(getCurrentStreak(logs)).toBe(3);
  });

  it('deduplicates repeated dates', () => {
    const logs = [
      { activityDate: today, actionCount: 1 },
      { activityDate: today, actionCount: 5 },
      { activityDate: yesterday, actionCount: 1 },
    ];
    expect(getCurrentStreak(logs)).toBe(2);
  });
});

// ─── creditTaskCompletion (share logic, mocked DB) ──────────
/**
 * We assert the pure share-splitting behaviour by capturing every
 * recordScore insert. creditTaskCompletion calls db.insert().values()
 * (score event) then db.query.userActivityLog.findFirst (activity) then
 * insert again — we stub all of those and record the score-event values.
 */
function makeMockDb() {
  const scoreInserts: Array<Record<string, unknown>> = [];

  const db = {
    insert: (_table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        // The scoring rows carry eventType; activity rows carry activityDate.
        if ('eventType' in vals) scoreInserts.push(vals);
        return {
          onConflictDoNothing: () => Promise.resolve(),
          // creditTaskCompletion's activity insert has no .onConflictDoNothing,
          // so support a bare thenable too.
          then: (res: () => void) => Promise.resolve().then(res),
        };
      },
    }),
    update: (_table: unknown) => ({
      set: (_v: unknown) => ({ where: (_w: unknown) => Promise.resolve() }),
    }),
    query: {
      userActivityLog: {
        // Pretend today's activity row already exists → recordActivity updates it.
        findFirst: () => Promise.resolve({ id: 'ACT-1' }),
      },
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: db as any, scoreInserts };
}

describe('creditTaskCompletion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when there are no assignees', async () => {
    const { db, scoreInserts } = makeMockDb();
    await creditTaskCompletion(db, {
      taskId: 'TASK-1',
      ivp: 3,
      deadline: null,
      assignees: [],
    });
    expect(scoreInserts).toHaveLength(0);
  });

  it('gives a single assignee the full points and full IVP credit', async () => {
    const { db, scoreInserts } = makeMockDb();
    await creditTaskCompletion(db, {
      taskId: 'TASK-1',
      ivp: 2,
      deadline: null, // → task_done, 10 pts
      assignees: [{ userId: 'U1', weight: 1 }],
    });

    const gam = scoreInserts.find((s) => s.eventType === 'task_done');
    const ivp = scoreInserts.find((s) => s.eventType === 'ivp_credit');
    expect(gam?.userId).toBe('U1');
    expect(gam?.points).toBe(SCORE_POINTS.TASK_DONE); // full 10
    // IVP credit = round(ivp * share * 10) = round(2 * 1 * 10) = 20
    expect(ivp?.points).toBe(20);
  });

  it('splits points and IVP by contribution weight', async () => {
    const { db, scoreInserts } = makeMockDb();
    // future deadline → task_early (15 pts); weights 3:1 → shares 0.75 / 0.25
    await creditTaskCompletion(db, {
      taskId: 'TASK-2',
      ivp: 4,
      deadline: new Date('2026-04-20T00:00:00.000Z'),
      assignees: [
        { userId: 'U1', weight: 3 },
        { userId: 'U2', weight: 1 },
      ],
    });

    const gamU1 = scoreInserts.find((s) => s.eventType === 'task_early' && s.userId === 'U1');
    const gamU2 = scoreInserts.find((s) => s.eventType === 'task_early' && s.userId === 'U2');
    const ivpU1 = scoreInserts.find((s) => s.eventType === 'ivp_credit' && s.userId === 'U1');
    const ivpU2 = scoreInserts.find((s) => s.eventType === 'ivp_credit' && s.userId === 'U2');

    // Gamification points: round(15 * 0.75) = 11 ; round(15 * 0.25) = 4
    expect(gamU1?.points).toBe(11);
    expect(gamU2?.points).toBe(4);
    // IVP credit: round(4 * 0.75 * 10) = 30 ; round(4 * 0.25 * 10) = 10
    expect(ivpU1?.points).toBe(30);
    expect(ivpU2?.points).toBe(10);
  });

  it('never awards fewer than 1 gamification point to a tiny share', async () => {
    const { db, scoreInserts } = makeMockDb();
    // task_late (5 pts); a 1-in-100 share would round to 0 without the Math.max(1,...) floor.
    await creditTaskCompletion(db, {
      taskId: 'TASK-3',
      ivp: 1,
      deadline: new Date('2026-04-10T00:00:00.000Z'),
      assignees: [
        { userId: 'BIG', weight: 99 },
        { userId: 'TINY', weight: 1 },
      ],
    });

    const gamTiny = scoreInserts.find((s) => s.eventType === 'task_late' && s.userId === 'TINY');
    expect(gamTiny?.points).toBe(1);
  });

  it('records both a gamification event and an ivp_credit event per assignee', async () => {
    const { db, scoreInserts } = makeMockDb();
    await creditTaskCompletion(db, {
      taskId: 'TASK-4',
      ivp: 1,
      deadline: null,
      assignees: [
        { userId: 'U1', weight: 1 },
        { userId: 'U2', weight: 1 },
      ],
    });
    // 2 assignees × (1 gamification + 1 ivp_credit) = 4 score inserts.
    expect(scoreInserts).toHaveLength(4);
    expect(scoreInserts.filter((s) => s.eventType === 'ivp_credit')).toHaveLength(2);
  });
});
