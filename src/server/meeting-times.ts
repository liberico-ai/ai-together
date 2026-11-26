// Pure date rules of the BoM meeting schedule and of the reminder windows (GIAO VIỆC 5 F). Every date and time here is Vietnam local time.
// Việt Nam keeps UTC+7 all year (no daylight saving), so the offset is a constant.
const VN_OFFSET_MS = 7 * 3600 * 1000;
export type LocalNow = { date: string; weekday: number; minutes: number };
export function vnParts(at: Date): LocalNow {
  const t = new Date(at.getTime() + VN_OFFSET_MS);
  const date = t.toISOString().slice(0, 10);
  return { date, weekday: weekdayOf(date), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() };
}
/** 1 = Monday … 7 = Sunday, of a YYYY-MM-DD date. */
export const weekdayOf = (date: string) => ((new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1;
export const addDays = (date: string, days: number) => new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
export const validDate = (date: string) => { const t = Date.parse(date + 'T00:00:00Z'); return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === date; };
export const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export type SeriesTimes = { weekday: number; startTime: string };
export type MeetingChange = { id: string; seq: number; kind: 'one_off' | 'recurring' | 'unclear'; sessionDate: string | null; effectiveFrom: string | null; newTime: string | null; sourceRef: string; resolvesChangeId: string | null };
/** `sourceRef` is the IN code of the change that set the time; null means the base schedule. */
export type SessionTime = { time: string; sourceRef: string | null };
const latest = (list: MeetingChange[]) => [...list].sort((a, b) => a.seq - b.seq).at(-1);

/** The time of the session on `date`: a one-off change of that session wins; else the latest recurring change that has started; else the base time. Unclear changes apply nothing. */
export function sessionTime(series: SeriesTimes, changes: MeetingChange[], date: string): SessionTime {
  const chosen = latest(changes.filter(c => c.kind === 'one_off' && c.sessionDate === date))
    ?? latest(changes.filter(c => c.kind === 'recurring' && c.effectiveFrom !== null && c.effectiveFrom <= date));
  return chosen?.newTime ? { time: chosen.newTime, sourceRef: chosen.sourceRef } : { time: series.startTime, sourceRef: null };
}

/** The next session that has not started at `now`. */
export function nextSession(series: SeriesTimes, changes: MeetingChange[], now: Date): SessionTime & { date: string } {
  const local = vnParts(now);
  for (let d = 0; ; d++) {
    const date = addDays(local.date, d);
    if (weekdayOf(date) !== series.weekday) continue;
    const t = sessionTime(series, changes, date);
    if (date > local.date || minutesOf(t.time) > local.minutes) return { date, ...t };
  }
}

/** The unclear changes nobody has answered. */
export const openQuestions = (changes: MeetingChange[]) =>
  changes.filter(c => c.kind === 'unclear' && !changes.some(a => a.resolvesChangeId === c.id)).sort((a, b) => a.seq - b.seq);
