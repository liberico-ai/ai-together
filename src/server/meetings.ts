import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Database, Queryable } from './db';
import { AppError, invariant } from './errors';
import { refOf } from './intake';
import { requestScope } from './work-requests';
import { nextSession, openQuestions, validDate, vnParts, weekdayOf, type MeetingChange, type SessionTime } from './meeting-times';
import type { Principal } from './types';

// A BoM meeting time change (GIAO VIỆC 5 F). A BoM seat of the project or a BoM Tech records it on the web, with the IN code of a stored message of that
// project as its source. Nobody and nothing reads the message text to change a time (AR-03). A one-off change moves one session, a recurring one the series
// from the next session; an unclear one moves nothing and pauses the reminders of the series until a change answers it.
export const changeSchema = z.object({
  seriesId: z.string().uuid(), requestKey: z.string().uuid(), kind: z.enum(['one_off', 'recurring', 'unclear']),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(validDate).nullable(),
  newTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  sourceRef: z.string().trim().regex(/^IN-[0-9A-F]{8}$/), resolvesChangeId: z.string().uuid().nullable(), expectedVersion: z.number().int().positive(),
}).strict();
const HISTORY = 20;

export type ChangeView = MeetingChange & { recorderName: string; at: string };
export type SeriesView = {
  id: string; projectId: string; projectName: string; title: string; weekday: number; baseTime: string; enabled: boolean; version: number;
  next: (SessionTime & { date: string }) | null; openQuestions: ChangeView[]; changes: ChangeView[];
};
type SeriesRow = { id: string; project_id: string; title: string; weekday: number; start_time: string; enabled: boolean; version: number };
const SERIES = "id,project_id,title,weekday,to_char(start_time,'HH24:MI') AS start_time,enabled,version";
const NOT_FOUND = () => new AppError('NOT_FOUND', 'Không tìm thấy lịch họp trong phạm vi được cấp. Chỉ ghế BoM của dự án hoặc BoM Tech ghi được lịch họp.', 404);
const canonical = (o: Record<string, unknown>) => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));

/** Changes of the series in the order they were recorded; the source is shown as its IN code, never the message. */
export async function seriesChanges(tx: Queryable, seriesIds: string[]): Promise<Map<string, ChangeView[]>> {
  const rows = (await tx.query<{ id: string; series_id: string; seq: string | number; kind: MeetingChange['kind']; session_date: string | null; effective_from: string | null; new_time: string | null;
    source_candidate_id: string | null; source_pool_item_id: string | null; resolves_change_id: string | null; recorder_name: string; created_at: Date | string }>(
    `SELECT id,series_id,seq,kind,to_char(session_date,'YYYY-MM-DD') AS session_date,to_char(effective_from,'YYYY-MM-DD') AS effective_from,to_char(new_time,'HH24:MI') AS new_time,
       source_candidate_id,source_pool_item_id,resolves_change_id,recorder_name,created_at FROM meeting_changes WHERE series_id=ANY($1::uuid[]) ORDER BY seq`, [seriesIds])).rows;
  const out = new Map<string, ChangeView[]>(seriesIds.map(id => [id, []]));
  for (const r of rows) out.get(r.series_id)?.push({ id: r.id, seq: Number(r.seq), kind: r.kind, sessionDate: r.session_date, effectiveFrom: r.effective_from, newTime: r.new_time,
    sourceRef: refOf((r.source_candidate_id ?? r.source_pool_item_id)!), resolvesChangeId: r.resolves_change_id, recorderName: r.recorder_name, at: new Date(r.created_at).toISOString() });
  return out;
}

export class MeetingService {
  constructor(private db: Database, private clock: () => Date = () => new Date()) {}

  /** The series the caller may record changes for: those of a project they hold a BoM seat in, or every one for a BoM Tech. */
  async list(p: Principal): Promise<{ series: SeriesView[] }> {
    invariant(p && p.role !== 'bot', 'READ_ONLY', 'Vai này chỉ được đọc dữ liệu trong phạm vi dự án.', 403);
    return requestScope(this.db, p, async tx => ({ series: await this.views(tx, p, (await tx.query<SeriesRow>(`SELECT ${SERIES} FROM meeting_series ORDER BY title,id`)).rows) }));
  }

  /** Adds the series' projects to this transaction's scope (a BoM Tech holds no membership there): only the name of the project and this schedule open up. */
  private async widen(tx: Queryable, p: Principal, projects: string[]) {
    const scope = [...new Set([...p.projectIds, ...projects])];
    await tx.query("SELECT set_config('app.project_ids',$1,true)", [scope.join(',')]);
  }

  private async views(tx: Queryable, p: Principal, rows: SeriesRow[]): Promise<SeriesView[]> {
    if (!rows.length) return [];
    await this.widen(tx, p, rows.map(r => r.project_id));
    const names = new Map((await tx.query<{ id: string; name: string }>('SELECT id,name FROM projects WHERE id=ANY($1::uuid[])', [rows.map(r => r.project_id)])).rows.map(x => [x.id, x.name]));
    const changes = await seriesChanges(tx, rows.map(r => r.id));
    const now = this.clock();
    return rows.map(r => {
      const all = changes.get(r.id) ?? [];
      return { id: r.id, projectId: r.project_id, projectName: names.get(r.project_id) ?? '', title: r.title, weekday: r.weekday, baseTime: r.start_time, enabled: r.enabled, version: r.version,
        next: r.enabled ? nextSession({ weekday: r.weekday, startTime: r.start_time }, all, now) : null,
        openQuestions: openQuestions(all) as ChangeView[], changes: all.slice(-HISTORY).reverse() };
    });
  }

  async record(p: Principal, raw: unknown): Promise<{ changeId: string; replayed: boolean; series: SeriesView }> {
    invariant(p && p.role !== 'bot', 'READ_ONLY', 'Vai này chỉ được đọc dữ liệu trong phạm vi dự án.', 403);
    const input = changeSchema.parse(raw);
    const { requestKey, ...content } = input;
    const hash = createHash('sha256').update(canonical(content)).digest('hex');
    return requestScope(this.db, p, async tx => {
      const found = (await tx.query<SeriesRow>(`SELECT ${SERIES} FROM meeting_series WHERE id=$1`, [input.seriesId])).rows[0];
      if (!found) throw NOT_FOUND();
      await this.widen(tx, p, [found.project_id]);
      // the lock serialises changes of one series: the version and the open questions read below stay true until commit
      const series = (await tx.query<SeriesRow>(`SELECT ${SERIES} FROM meeting_series WHERE id=$1 FOR UPDATE`, [found.id])).rows[0];
      if (!series) throw NOT_FOUND();
      const view = async () => (await this.views(tx, p, [(await tx.query<SeriesRow>(`SELECT ${SERIES} FROM meeting_series WHERE id=$1`, [series.id])).rows[0]]))[0];
      const old = (await tx.query<{ id: string; request_hash: string }>('SELECT id,request_hash FROM meeting_changes WHERE tenant_id=$1 AND recorded_by=$2 AND request_key=$3', [p.tenantId, p.id, requestKey])).rows[0];
      if (old) {
        invariant(old.request_hash === hash, 'IDEMPOTENCY_CONFLICT', 'Mã thao tác đã được dùng với nội dung khác. Tải lại trang rồi ghi lại.', 409);
        return { changeId: old.id, replayed: true, series: await view() };
      }
      invariant(series.version === input.expectedVersion, 'REVISION_CONFLICT', 'Lịch họp vừa đổi. Tải lại rồi ghi lại.', 409);
      const all = (await seriesChanges(tx, [series.id])).get(series.id)!;
      const times = { weekday: series.weekday, startTime: series.start_time };
      const today = vnParts(this.clock()).date;
      let sessionDate: string | null = null, effectiveFrom: string | null = null;
      if (input.kind === 'one_off') {
        invariant(input.sessionDate && weekdayOf(input.sessionDate) === series.weekday && input.sessionDate >= today, 'SESSION_DATE_INVALID',
          'Chọn ngày của một buổi sắp tới của lịch này (đúng thứ trong tuần, từ hôm nay).', 422);
        sessionDate = input.sessionDate;
      } else invariant(input.sessionDate === null, 'SESSION_DATE_INVALID', 'Chỉ đổi giờ một buổi mới ghi ngày của buổi.', 422);
      invariant(input.kind === 'unclear' || input.newTime !== null, 'NEW_TIME_REQUIRED', 'Ghi giờ mới của buổi họp.', 422);
      if (input.kind === 'recurring') effectiveFrom = nextSession(times, all, this.clock()).date;
      if (input.resolvesChangeId !== null) {
        invariant(input.kind !== 'unclear' && openQuestions(all).some(q => q.id === input.resolvesChangeId), 'RESOLVE_INVALID',
          'Chỉ trả lời được một thay đổi chưa rõ còn mở, bằng đổi một buổi hoặc đổi lịch định kỳ. Tải lại rồi chọn lại.', 409);
      }
      const sources = (await tx.query<{ candidate_id: string | null; pool_item_id: string | null }>('SELECT candidate_id,pool_item_id FROM public.meeting_source($1,$2)', [series.project_id, input.sourceRef])).rows;
      invariant(sources.length > 0, 'SOURCE_NOT_FOUND', `Không tìm thấy tin đã lưu mã ${input.sourceRef} trong dự án này. Dùng mã bot đã trả lời trong nhóm của dự án, hoặc tin nhóm chung đã gán vào dự án.`, 422);
      invariant(sources.length === 1, 'SOURCE_AMBIGUOUS', 'Mã này khớp nhiều tin. Nhắn lại xác nhận đổi giờ để có mã mới.', 409);
      const made = (await tx.query<{ id: string }>(`INSERT INTO meeting_changes(tenant_id,project_id,series_id,kind,session_date,effective_from,new_time,source_candidate_id,source_pool_item_id,resolves_change_id,recorded_by,recorder_name,request_key,request_hash)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [p.tenantId, series.project_id, series.id, input.kind, sessionDate, effectiveFrom, input.newTime, sources[0].candidate_id, sources[0].pool_item_id, input.resolvesChangeId, p.id, p.name, requestKey, hash])).rows[0];
      const bumped = await tx.query('UPDATE meeting_series SET version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING id', [series.id, series.version]);
      invariant(bumped.rows.length === 1, 'REVISION_CONFLICT', 'Lịch họp vừa đổi. Tải lại rồi ghi lại.', 409);
      return { changeId: made.id, replayed: false, series: await view() };
    });
  }
}
