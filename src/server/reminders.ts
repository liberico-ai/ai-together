import { randomUUID } from 'node:crypto';
import type { Database, Queryable } from './db';
import { seriesChanges } from './meetings';
import { addDays, minutesOf, nextSession, openQuestions, vnParts } from './meeting-times';

// The reminder scheduler (GIAO VIỆC 5 F, Q-F1..F4). One pass: for each enabled target, decide what is due now and queue it once (dedupe key + ON CONFLICT);
// the gateway's outbox pass sends it. It runs as libetech_reminder, which can only queue reminder rows to enabled targets. Messages carry fixed template
// names and checked parameters: a project name, member names and counts, a date, a time and an IN code. Never a title, a text or a chat id.
// Anything due that is not queued is counted by reason, never dropped silently.
export const STATUS_MAX_AGE_MINUTES = 120, GOLIVE_WINDOW_MINUTES = 180;
/** Meeting messages go out between 07:00 and 21:00 only. */
const DAY_START = 7 * 60, DAY_END = 21 * 60;
const NAME_MAX = 60, PROJECT_MAX = 80, LIST_BYTES = 650;

export type ReminderRun = { queued: number; replayed: number; skipped: Record<string, number> };
type Target = { id: string; project_id: string; kind: 'golive_status' | 'bom_meeting'; chat_id: string; topic_id: string; send_time: string; lead_days: number };
type Count = (what: 'queued' | 'replayed' | string) => void;

/** A name as it may appear in a group message: one line, no mention, command or markup characters, cut to `max` characters. */
export function safeText(value: string, max: number): string {
  // control, invisible format (zero-width, direction marks, soft hyphen) and line-separator characters, then mention, command, markup and placeholder characters
  const clean = value.normalize('NFC').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}@<>/\\{}]/gu, ' ').replace(/"/g, "'").replace(/\s+/g, ' ').trim();
  return Array.from(clean).slice(0, max).join('').trim();
}
/** «A, B, C», cut to the byte budget with «và N người nữa» so the cut is visible. */
export function nameList(entries: string[]): string {
  let out = '';
  for (let i = 0; i < entries.length; i++) {
    const next = out ? out + ', ' + entries[i] : entries[i];
    const rest = entries.length - i - 1;
    if (Buffer.byteLength(next + (rest ? ` và ${rest} người nữa` : '')) > LIST_BYTES) return out ? out + ` và ${entries.length - i} người nữa` : `${entries.length} người`;
    out = next;
  }
  return out;
}

async function asReminder<T>(db: Database, tenantId: string, projectId: string, fn: (tx: Queryable) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    await tx.query('SET LOCAL ROLE libetech_reminder');
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)", [tenantId, projectId]);
    return fn(tx);
  });
}
const exists = async (tx: Queryable, dedupe: string) => (await tx.query('SELECT 1 FROM outbox_messages WHERE dedupe_key=$1', [dedupe])).rows.length > 0;
async function enqueue(tx: Queryable, tenantId: string, t: Target, template: string, params: Record<string, string>, dedupe: string, count: Count) {
  const r = await tx.query(`INSERT INTO outbox_messages(tenant_id,project_id,reminder_target_id,event_id,event_type,trace_id,correlation_id,audience,target_chat_id,target_topic_id,template,payload,dedupe_key)
    VALUES($1,$2,$3,$4,$5,$6,$7,'group',$8,$9,$5,$10,$11) ON CONFLICT(tenant_id,dedupe_key) DO NOTHING RETURNING id`,
    [tenantId, t.project_id, t.id, randomUUID(), template, randomUUID(), randomUUID(), t.chat_id, t.topic_id, JSON.stringify({ params }), dedupe]);
  count(r.rows.length ? 'queued' : 'replayed');
}

/** One message per target per weekday, from its time for three hours, from a status projected today and at most two hours old. */
async function golive(tx: Queryable, tenantId: string, t: Target, project: string, now: Date, count: Count) {
  const local = vnParts(now), start = minutesOf(t.send_time);
  if (local.weekday > 5 || local.minutes < start) return;
  const dedupe = `reminder:golive_status:${t.id}:${local.date}`;
  if (await exists(tx, dedupe)) return count('replayed');
  if (local.minutes >= start + GOLIVE_WINDOW_MINUTES) return count('window_passed');
  const rows = (await tx.query<{ member_name: string; requests_filed: number; open_without_evidence: number; projected_at: Date | string }>(
    'SELECT member_name,requests_filed,open_without_evidence,projected_at FROM analytics.golive_member_status WHERE project_id=$1 ORDER BY member_name,member_id', [t.project_id])).rows;
  const fresh = (at: Date) => now.getTime() - at.getTime() <= STATUS_MAX_AGE_MINUTES * 60000 && vnParts(at).date === local.date;
  if (!rows.length || !rows.every(r => fresh(new Date(r.projected_at)))) return count('stale_status');
  const noRequest = rows.filter(r => r.requests_filed === 0).map(r => safeText(r.member_name, NAME_MAX) || 'một thành viên');
  const noEvidence = rows.filter(r => r.open_without_evidence > 0).map(r => `${safeText(r.member_name, NAME_MAX) || 'một thành viên'} (${r.open_without_evidence} việc)`);
  if (!noRequest.length && !noEvidence.length) return count('nothing_missing');
  await enqueue(tx, tenantId, t, 'reminder.golive_status', { project, date: local.date, noRequest: nameList(noRequest), noEvidence: nameList(noEvidence) }, dedupe, count);
}

/**
 * Per series: an unanswered unclear change pauses its reminders and asks once. Otherwise the next session is reminded once from `lead_days` before at the target's
 * time until it starts; a changed time is a new message, because the key carries the time.
 */
async function meeting(tx: Queryable, tenantId: string, t: Target, project: string, now: Date, count: Count) {
  const local = vnParts(now);
  const series = (await tx.query<{ id: string; weekday: number; start_time: string }>(
    "SELECT id,weekday,to_char(start_time,'HH24:MI') AS start_time FROM meeting_series WHERE project_id=$1 AND enabled ORDER BY id", [t.project_id])).rows;
  const changes = await seriesChanges(tx, series.map(s => s.id));
  const daytime = local.minutes >= DAY_START && local.minutes < DAY_END;
  for (const s of series) {
    const times = { weekday: s.weekday, startTime: s.start_time }, all = changes.get(s.id) ?? [];
    const open = openQuestions(all);
    if (open.length) {
      count('blocked_unclear');
      if (daytime) for (const q of open)
        await enqueue(tx, tenantId, t, 'reminder.bom_meeting_question', { project, source: q.sourceRef, date: nextSession(times, all, now).date }, `reminder:bom_meeting_question:${t.id}:${q.id}`, count);
      continue;
    }
    if (!daytime) continue;
    const next = nextSession(times, all, now);
    const from = addDays(next.date, -t.lead_days);
    if (local.date < from || (local.date === from && local.minutes < minutesOf(t.send_time))) continue;
    await enqueue(tx, tenantId, t, 'reminder.bom_meeting', { project, date: next.date, time: next.time, source: next.sourceRef ?? 'base' },
      `reminder:bom_meeting:${t.id}:${s.id}:${next.date}:${next.time}`, count);
  }
}

/**
 * `intakeProjects`: the projects the gateway's intake principal pulls (null when the server config is not readable here). A target outside it would sit unsent,
 * so it is skipped and counted instead.
 */
export async function sendReminders(db: Database, opts: { tenantId: string; now: Date; intakeProjects: string[] | null }): Promise<ReminderRun> {
  const run: ReminderRun = { queued: 0, replayed: 0, skipped: {} };
  const add = (into: ReminderRun): Count => what => {
    if (what === 'queued') into.queued++;
    else if (what === 'replayed') into.replayed++;
    else into.skipped[what] = (into.skipped[what] ?? 0) + 1;
  };
  const targets = await asReminder(db, opts.tenantId, '', async tx => (await tx.query<Target>(
    "SELECT id,project_id,kind,chat_id,topic_id,to_char(send_time,'HH24:MI') AS send_time,lead_days FROM reminder_targets WHERE enabled ORDER BY project_id,kind")).rows);
  for (const t of targets) {
    if (opts.intakeProjects && !opts.intakeProjects.includes(t.project_id)) { add(run)('not_in_intake_scope'); continue; }
    // counted apart and merged only after the commit: a transaction that fails counts nothing but its failure
    const part: ReminderRun = { queued: 0, replayed: 0, skipped: {} };
    try {
      await asReminder(db, opts.tenantId, t.project_id, async tx => {
        const allowed = (await tx.query<{ ok: boolean }>('SELECT public.reminder_project_allowed($1,$2) AS ok', [opts.tenantId, t.project_id])).rows[0]?.ok === true;
        if (!allowed) return add(part)('refused_project');
        const name = (await tx.query<{ name: string }>('SELECT name FROM projects WHERE id=$1', [t.project_id])).rows[0]?.name ?? '';
        const project = safeText(name, PROJECT_MAX) || 'dự án';
        await (t.kind === 'golive_status' ? golive : meeting)(tx, opts.tenantId, t, project, opts.now, add(part));
      });
    } catch (error) {
      // one broken target does not stop the others; only the error class is logged, never the message (it may name a chat)
      console.error(JSON.stringify({ level: 'error', event: 'reminder_target_failed', errorType: error instanceof Error ? error.name : 'unknown' }));
      add(run)('failed');
      continue;
    }
    run.queued += part.queued; run.replayed += part.replayed;
    for (const [k, v] of Object.entries(part.skipped)) run.skipped[k] = (run.skipped[k] ?? 0) + v;
  }
  return run;
}

/** How far the queued reminders got, counted by template and state: how an operator checks that reminders went out. Counts only. */
export async function reminderCounts(db: Database, tenantId: string): Promise<{ template: string; state: string; n: number }[]> {
  const projects = await asReminder(db, tenantId, '', async tx => (await tx.query<{ project_id: string }>('SELECT DISTINCT project_id FROM reminder_targets')).rows.map(r => r.project_id));
  return asReminder(db, tenantId, projects.join(','), async tx => (await tx.query<{ template: string; state: string; n: number }>(
    'SELECT template,state,count(*)::int AS n FROM outbox_messages WHERE reminder_target_id IS NOT NULL GROUP BY template,state ORDER BY template,state')).rows);
}
