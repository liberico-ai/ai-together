import { randomUUID } from 'node:crypto';
import { reminderRoute, type BridgeConfig } from './bridge-config';
import type { Database, Queryable } from './db';
import { seriesChanges } from './meetings';
import { addDays, minutesOf, nextSession, openQuestions, sessionChange, sessionTime, vnParts, weekdayOf, type MeetingChange } from './meeting-times';

// The reminder scheduler (GIAO VIỆC 5 F, Q-F1..F4). One pass: for each enabled target, decide what is due now and queue it once (dedupe key + ON CONFLICT);
// the gateway's outbox pass sends it. It runs as libetech_reminder, which can only queue reminder rows to enabled targets. Messages carry fixed template
// names and checked parameters: a project name, member names and counts, a date, a time and an IN code. Never a title, a text or a chat id.
// Anything due that is not queued is counted by reason, never dropped silently.
export const STATUS_MAX_AGE_MINUTES = 120, GOLIVE_WINDOW_MINUTES = 180, GOLIVE_MAX_QUEUE_MINUTES = 60;
/** A dropped message is queued again while it is still due, this many rows in all. */
const MAX_REMINDER_ROWS = 3;
/** Meeting messages are queued and sent between 07:00 and 21:00 only. */
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
/** The rows queued for one message: its key and the keys of its retries. */
const rowsOf = async (tx: Queryable, key: string) => (await tx.query<{ state: string }>(
  "SELECT state FROM outbox_messages WHERE dedupe_key=$1 OR starts_with(dedupe_key,$1::text||':again')", [key])).rows;
/** Delivered, waiting, being sent or given up by a person: nothing more to queue. Only a message whose every row died is queued again. */
const settled = (rows: { state: string }[]) => rows.some(r => r.state !== 'dead');
/** Queues a message once per key (UNIQUE decides between two passes); a message that only died is queued again, at most MAX_REMINDER_ROWS rows in all. */
async function enqueue(tx: Queryable, tenantId: string, t: Target, template: string, params: Record<string, string>, key: string, count: Count, reminder?: { seriesId: string; changeId?: string }) {
  const prior = await rowsOf(tx, key);
  if (settled(prior)) return count('replayed');
  if (prior.length >= MAX_REMINDER_ROWS) return count('gave_up');
  const dedupe = prior.length ? `${key}:again${prior.length}` : key;
  const r = await tx.query(`INSERT INTO outbox_messages(tenant_id,project_id,reminder_target_id,event_id,event_type,trace_id,correlation_id,audience,target_chat_id,target_topic_id,template,payload,dedupe_key)
    VALUES($1,$2,$3,$4,$5,$6,$7,'group',$8,$9,$5,$10,$11) ON CONFLICT(tenant_id,dedupe_key) DO NOTHING RETURNING id`,
    [tenantId, t.project_id, t.id, randomUUID(), template, randomUUID(), randomUUID(), t.chat_id, t.topic_id, JSON.stringify(reminder ? { params, reminder } : { params }), dedupe]);
  count(r.rows.length ? 'queued' : 'replayed');
}

/** One message per target per weekday, from its time for three hours, from a status projected today and at most two hours old. */
async function golive(tx: Queryable, tenantId: string, t: Target, project: string, now: Date, count: Count) {
  const local = vnParts(now), start = minutesOf(t.send_time);
  if (local.weekday > 5 || local.minutes < start) return;
  const dedupe = `reminder:golive_status:${t.id}:${local.date}`;
  if (settled(await rowsOf(tx, dedupe))) return count('replayed');
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
 * time until it starts; a changed time is a new message, because the key carries the time and the change that set it.
 */
async function meeting(tx: Queryable, tenantId: string, t: Target, project: string, now: Date, count: Count) {
  const local = vnParts(now);
  const series = (await tx.query<{ id: string; weekday: number; start_time: string; base_revision: number }>(
    "SELECT id,weekday,to_char(start_time,'HH24:MI') AS start_time,base_revision FROM meeting_series WHERE project_id=$1 AND enabled ORDER BY id", [t.project_id])).rows;
  const changes = await seriesChanges(tx, series.map(s => s.id));
  const daytime = local.minutes >= DAY_START && local.minutes < DAY_END;
  for (const s of series) {
    const times = { weekday: s.weekday, startTime: s.start_time }, all = changes.get(s.id) ?? [];
    const open = openQuestions(all);
    if (open.length) {
      count('blocked_unclear');
      if (daytime) for (const q of open)
        await enqueue(tx, tenantId, t, 'reminder.bom_meeting_question', { project, source: q.sourceRef, date: nextSession(times, all, now).date }, `reminder:bom_meeting_question:${t.id}:${q.id}`, count, { seriesId: s.id, changeId: q.id });
      continue;
    }
    if (!daytime) continue;
    const next = nextSession(times, all, now);
    const from = addDays(next.date, -t.lead_days);
    if (local.date < from || (local.date === from && local.minutes < minutesOf(t.send_time))) continue;
    // the key carries what set the time (the change, or the base schedule's revision): a time changed away and back is a new message
    await enqueue(tx, tenantId, t, 'reminder.bom_meeting', { project, date: next.date, time: next.time, source: next.sourceRef ?? 'base' },
      `reminder:bom_meeting:${t.id}:${s.id}:${next.date}:${next.time}:${sessionChange(all, next.date)?.id ?? 'base' + s.base_revision}`, count, { seriesId: s.id });
  }
}

export type DeliveryFacts = { now: string; ageMinutes: number; targetOk: boolean; projectAllowed: boolean; params: Record<string, string> | null; reminder: { seriesId?: string; changeId?: string } | null;
  series: { weekday: number; startTime: string; enabled: boolean } | null; changes: MeetingChange[] };

/**
 * Why a queued reminder must not go out now, or null. The gateway's pull asks this for every reminder it leases (public.reminder_delivery_facts): the target,
 * the project, the group, and for a meeting message the time and the session as they are now.
 */
export function deliveryBlock(template: string, f: DeliveryFacts | null, route: string | null): string | null {
  if (!f || !f.targetOk) return 'REMINDER_TARGET_CHANGED';
  if (!f.projectAllowed) return 'REMINDER_PROJECT_REFUSED';
  if (route) return 'REMINDER_ROUTE_REFUSED';
  const local = vnParts(new Date(f.now)), date = f.params?.date ?? '', time = f.params?.time ?? '';
  // a status is only current for a while: names that were missing an hour ago are checked again by the next pass
  if (template === 'reminder.golive_status') return date === local.date && f.ageMinutes <= GOLIVE_MAX_QUEUE_MINUTES ? null : 'REMINDER_EXPIRED';
  if (local.minutes < DAY_START || local.minutes >= DAY_END) return 'REMINDER_OUTSIDE_HOURS';
  const series = f.series;
  if (!series?.enabled) return 'REMINDER_SUPERSEDED';
  if (template === 'reminder.bom_meeting_question') {
    if (!openQuestions(f.changes).some(q => q.id === f.reminder?.changeId)) return 'REMINDER_SUPERSEDED';
    return date >= local.date ? null : 'REMINDER_EXPIRED';
  }
  if (openQuestions(f.changes).length || weekdayOf(date) !== series.weekday || sessionTime(series, f.changes, date).time !== time) return 'REMINDER_SUPERSEDED';
  return date > local.date || (date === local.date && minutesOf(time) > local.minutes) ? null : 'REMINDER_EXPIRED';
}

/**
 * `config`: the server's bridge config (null when it cannot be read here: then nothing is queued). A target whose group does not serve exactly its project,
 * or whose project the gateway does not pull, is skipped and counted.
 */
export async function sendReminders(db: Database, opts: { tenantId: string; now: Date; config: BridgeConfig | null }): Promise<ReminderRun> {
  const run: ReminderRun = { queued: 0, replayed: 0, skipped: {} };
  const add = (into: ReminderRun): Count => what => {
    if (what === 'queued') into.queued++;
    else if (what === 'replayed') into.replayed++;
    else into.skipped[what] = (into.skipped[what] ?? 0) + 1;
  };
  const targets = await asReminder(db, opts.tenantId, '', async tx => (await tx.query<Target>(
    "SELECT id,project_id,kind,chat_id,topic_id,to_char(send_time,'HH24:MI') AS send_time,lead_days FROM reminder_targets WHERE enabled ORDER BY project_id,kind")).rows);
  for (const t of targets) {
    const refused = reminderRoute(opts.config, t.chat_id, t.project_id);
    if (refused) { add(run)(refused); continue; }
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
