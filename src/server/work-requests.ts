import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Database, Queryable } from './db';
import { AppError, invariant } from './errors';
import { projectWorkSummary } from './projector';
import { append, approvers, deduplicate, httpsUrl, performersAmong } from './service';
export { performersAmong } from './service';
import { projectRole } from './types';
import type { Principal, Project, Work } from './types';

// Team Tech files a work request; one of the three BoM Tech, or a BoM seat of the project, other than the requester, approves or rejects it (migrations 024, 028).
// Identity and tenant come from the principal only. Every transaction runs as libetech_runtime with app.person_id set (the convention of inbox.ts run()).
// Approval creates the work_items row in the same transaction, with the final assignee and acceptors (the initial assignment, as WorkService.create allowed),
// the source row the 3/3 ballot needs (bom_sources, 'work_request:<id>') and, for a Team Tech member with no membership in the project, a traced access grant.
// Later changes of the assignee need the 3/3 ballot (bom_guard_assignment).
const uuid = z.string().uuid();
const code = z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,39}$/);
export const submitSchema = z.object({
  projectId: uuid, requestKey: uuid, code: code.nullable(), title: z.string().trim().min(5).max(200), priority: z.enum(['normal', 'high']),
  dueAt: z.string().datetime().nullable(), criteria: z.string().max(3000), specUrl: httpsUrl.nullable(),
  assigneeId: uuid.nullable(), technicalId: uuid.nullable(), businessId: uuid.nullable(),
}).strict();
// On approval the decider may fill the people the request left empty and change the people it proposed (M3, 0.9.2): proposed, final and who changed are recorded.
// A null leaves the slot as proposed. Changing the assignee after approval is the 3/3 ballot.
const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']), expectedVersion: z.number().int().positive(), serviceId: uuid.nullable(), code: code.nullable(), note: z.string().trim().min(5).max(2000),
  assigneeId: uuid.nullable().default(null), technicalId: uuid.nullable().default(null), businessId: uuid.nullable().default(null),
}).strict();
// Many requests in one approval (M7): a list of ids, or every pending request of one import batch. People given here only fill slots a request left empty.
const BULK_CAP = 200;
const manySchema = z.object({
  requestIds: z.array(uuid).min(1).max(BULK_CAP).optional(), batchId: uuid.optional(),
  services: z.array(z.object({ projectId: uuid, serviceId: uuid }).strict()).max(BULK_CAP).default([]),
  note: z.string().trim().min(5).max(2000),
  assigneeId: uuid.nullable().default(null), technicalId: uuid.nullable().default(null), businessId: uuid.nullable().default(null),
}).strict().refine(v => (v.requestIds === undefined) !== (v.batchId === undefined), 'Chọn danh sách yêu cầu hoặc một lô nhập.');
const listSchema = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50), offset: z.coerce.number().int().min(0).default(0) }).strict();

export type WorkRequest = {
  id: string; tenant_id: string; project_id: string; requester_id: string; requester_name: string; origin: 'form' | 'intake' | 'import'; source_ref: string | null;
  request_key: string; request_hash: string; code: string | null; title: string; priority: 'normal' | 'high'; due_at: string | null; criteria: string; spec_url: string | null;
  assignee_id: string | null; technical_id: string | null; business_id: string | null; state: 'pending' | 'approved' | 'rejected';
  decided_by: string | null; decider_name: string | null; decided_at: string | null; decision_note: string | null; work_id: string | null; version: number; created_at: string; updated_at: string;
};
export type WorkRequestItem = WorkRequest & { project_name: string | null; can_decide: boolean; seat_open: boolean | null; work_code: string | null; is_seat: boolean };
export type PublicRequest<T extends WorkRequest = WorkRequest> = Omit<T, 'tenant_id' | 'request_key' | 'request_hash' | 'decided_by' | 'is_seat'> & { decided_by?: string | null };
/**
 * What leaves the server (E-SEC-01): no tenant, no idempotency key or hash, and the decider's id only for a decider of the project or the decider.
 * The decider's name and the decision time stay: the screen shows who decided and when.
 */
export function publicRequest<T extends WorkRequest>(r: T, readerId: string, readerIsSeat = false): PublicRequest<T> {
  const { tenant_id: _t, request_key: _k, request_hash: _h, is_seat: _s, ...rest } = r as T & { is_seat?: boolean };
  void _t; void _k; void _h; void _s;
  if (readerIsSeat || r.decided_by === readerId) return { ...rest, decided_by: r.decided_by } as PublicRequest<T>;
  const { decided_by: _d, ...kept } = rest as { decided_by?: string | null };
  void _d;
  return kept as PublicRequest<T>;
}
export const publicPage = (page: { items: WorkRequestItem[]; total: number }, readerId: string) =>
  ({ items: page.items.map(i => publicRequest(i, readerId, i.is_seat)), total: page.total });
export type CatalogProject = Pick<Project, 'id' | 'name' | 'bu'>;
export type BulkResult = { id: string; ok: true; workId: string | null } | { id: string; ok: false; code: string; message: string };
export type DecideContext = { projectIds: string[]; services: { id: string; project_id: string; name: string }[]; seats: Record<string, string[]> };

// Every refusal says what to do next (M10). None names a project: a person outside it learns nothing from the answer.
const NOT_FOUND = () => new AppError('NOT_FOUND', 'Không tìm thấy yêu cầu trong phạm vi được cấp. Tải lại danh sách.', 404);
const scopeDenied = () => new AppError('SCOPE_DENIED', 'Không tìm thấy dự án trong phạm vi được cấp. Chọn một dự án trong danh sách.', 404);
const filingDenied = () => new AppError('WORK_REQUEST_DENIED', 'Chỉ thành viên Team Tech hoặc điều phối dự án được tạo việc. Nhờ điều phối dự án tạo việc giúp bạn, hoặc nhờ người quản trị thêm bạn vào Team Tech.', 403);
const READ_ONLY = 'Vai này chỉ được đọc dữ liệu trong phạm vi dự án.';
const canonical = (o: Record<string, unknown>) => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const PROJECT_LIST = "string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]";
const SLOTS = ['assigneeId', 'technicalId', 'businessId'] as const;
type People = Record<typeof SLOTS[number], string | null>;

/**
 * The transaction of the work-request flow: the runtime role, the tenant, the caller's projects and app.person_id from the session (the convention of inbox.ts run()).
 * A Team Tech member who holds no project grant still gets one (they file and read their own requests, M6): the policies show them nothing else. A BoM Tech reads
 * and decides requests of every project through the request policies (work_request_seat, migration 028); their scope stays that of their memberships.
 */
export async function requestScope<T>(db: Database, p: Principal, fn: (tx: Queryable) => Promise<T>): Promise<T> {
  if (!p?.id || !p.tenantId) throw new AppError('UNAUTHENTICATED', 'Cần đăng nhập để tiếp tục.', 401);
  return db.transaction(async tx => {
    await tx.query('SET LOCAL ROLE libetech_runtime');
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.person_id',$3,true)", [p.tenantId, p.projectIds.join(','), p.id]);
    return fn(tx);
  });
}
/**
 * Add to this transaction's scope the projects where the caller decides a request now (a BoM Tech holds no membership there): the decision reads the services, seats
 * and people of that project and writes its work there. Nothing else of the project opens, and only for this transaction.
 */
async function decidingIn(tx: Queryable, p: Principal, projects: string[]): Promise<string[]> {
  const scope = [...new Set([...p.projectIds, ...projects])];
  if (scope.length !== p.projectIds.length) await tx.query("SELECT set_config('app.project_ids',$1,true)", [scope.join(',')]);
  return scope;
}

export type SubmitInput = z.infer<typeof submitSchema>;
/**
 * The filing of a request inside the caller's transaction (already scoped, app.person_id set). The HTTP route reaches it with origin 'form'; the intake
 * paths (pool triage, candidate command) reach it with origin 'intake' and a source_ref made of the IN code and the internal uuid of the pool item or candidate,
 * never a Telegram id. `authorization: 'standard'` is PR A's rule: a Team Tech member, or the manager of the project.
 */
export async function fileRequestIn(tx: Queryable, p: Principal, input: SubmitInput, opts: { origin: 'form' | 'intake'; sourceRef: string | null; authorization: 'standard' }): Promise<{ request: WorkRequest; replayed: boolean }> {
  const { requestKey, ...content } = input;
  const hash = sha256(canonical(content));
  if (opts.authorization === 'standard') {
    const tech = (await tx.query<{ ok: boolean }>('SELECT public.app_actor_is_tech_member() AS ok')).rows[0].ok === true;
    if (!tech && !p.projectIds.some(id => projectRole(p, id) === 'manager')) throw filingDenied();
    const inScope = tech
      ? (await tx.query('SELECT 1 FROM public.tech_project_catalog() WHERE id=$1', [content.projectId])).rows.length > 0
      : p.projectIds.includes(content.projectId);
    if (!inScope) throw scopeDenied();
    if (!tech && projectRole(p, content.projectId) !== 'manager') throw filingDenied();
  } else if (!p.projectIds.includes(content.projectId)) throw scopeDenied();
  // The filing policy asks the same question of the account rows (work_request_filer, 024); a session whose grant the database does not back
  // (a demo profile, a manager role removed since sign-in) gets this answer instead of a row-level security error.
  const filer = (await tx.query<{ ok: boolean }>('SELECT public.work_request_filer($1) AS ok', [content.projectId])).rows[0].ok === true;
  if (!filer) throw filingDenied();
  invariant(!content.assigneeId || (content.assigneeId !== content.technicalId && content.assigneeId !== content.businessId), 'SELF_ACCEPTANCE', 'Người thực hiện phải khác người nghiệm thu. Chọn người nghiệm thu khác.', 422);
  // a Team Tech member may be proposed as the assignee of any project (M2); the other people keep the role rule of the project
  const performer = (await performersAmong(tx, [content.assigneeId])).size > 0;
  await approvers({ ...p, role: projectRole(p, content.projectId) }, performer ? null : content.assigneeId, content.technicalId, content.businessId, content.projectId);
  const made = (await tx.query<WorkRequest>(`INSERT INTO work_requests(tenant_id,project_id,requester_id,requester_name,origin,source_ref,request_key,request_hash,code,title,priority,due_at,criteria,spec_url,assignee_id,technical_id,business_id)
    VALUES($1,$2,$3,$4,$16,$17,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (tenant_id,requester_id,request_key) DO NOTHING RETURNING *`,
    [p.tenantId, content.projectId, p.id, p.name, requestKey, hash, content.code, content.title, content.priority, content.dueAt, content.criteria, content.specUrl, content.assigneeId, content.technicalId, content.businessId, opts.origin, opts.sourceRef])).rows[0];
  if (!made) {
    const old = (await tx.query<WorkRequest>('SELECT * FROM work_requests WHERE tenant_id=$1 AND requester_id=$2 AND request_key=$3', [p.tenantId, p.id, requestKey])).rows[0];
    invariant(old && old.request_hash === hash, 'IDEMPOTENCY_CONFLICT', 'Mã thao tác đã được dùng với nội dung khác. Tải lại trang rồi gửi lại.', 409);
    return { request: old, replayed: true };
  }
  await tx.query(`INSERT INTO work_request_events(tenant_id,project_id,request_id,requester_id,actor_id,kind,payload) VALUES($1,$2,$3,$4,$4,'submitted',$5)`,
    [p.tenantId, made.project_id, made.id, p.id, JSON.stringify({ origin: opts.origin, title: made.title })]);
  return { request: made, replayed: false };
}

type DecisionInput = z.infer<typeof decisionSchema>;
export class WorkRequestService {
  constructor(private db: Database) {}
  private run<T>(p: Principal, fn: (tx: Queryable) => Promise<T>): Promise<T> {
    return requestScope(this.db, p, fn);
  }

  /** Every project for a Team Tech member or a BoM Tech; for anybody else, the projects they manage. */
  async catalog(p: Principal): Promise<CatalogProject[]> {
    return this.run(p, async tx => {
      const all = (await tx.query<CatalogProject>('SELECT id,name,bu FROM public.tech_project_catalog()')).rows;
      if (all.length) return all;
      const managed = p.projectIds.filter(id => projectRole(p, id) === 'manager');
      return (await tx.query<CatalogProject>('SELECT id,name,bu FROM projects WHERE id=ANY($1::uuid[]) ORDER BY name,id', [managed])).rows;
    });
  }

  /**
   * What the screen needs to decide: the caller's projects and the projects of the requests waiting for their decision, the services of those projects, and the seats
   * of each enabled scope among them (a seat may take the work, M1). For a BoM Tech that is only where a request waits for them, never the whole tenant.
   */
  async context(p: Principal): Promise<DecideContext> {
    invariant(p && p.role !== 'bot', 'READ_ONLY', READ_ONLY, 403);
    return this.run(p, async tx => {
      const waiting = (await tx.query<{ project_id: string }>(`SELECT DISTINCT project_id FROM work_requests
        WHERE state='pending' AND requester_id<>$1 AND public.work_request_seat(project_id) ORDER BY project_id`, [p.id])).rows.map(r => r.project_id);
      const projectIds = await decidingIn(tx, p, waiting);
      const services = (await tx.query<DecideContext['services'][number]>('SELECT id,project_id,name FROM services WHERE project_id=ANY($1::uuid[]) ORDER BY name,id', [projectIds])).rows;
      const seats = (await tx.query<{ project_id: string; seat_ids: string[] }>('SELECT project_id,seat_ids FROM bom_scopes WHERE enabled AND project_id=ANY($1::uuid[])', [projectIds])).rows;
      return { projectIds, services, seats: Object.fromEntries(seats.map(s => [s.project_id, s.seat_ids])) };
    });
  }

  async submit(p: Principal, raw: unknown): Promise<{ request: WorkRequest; replayed: boolean }> {
    invariant(p && p.role !== 'bot', 'READ_ONLY', READ_ONLY, 403);
    const input = submitSchema.parse(raw);
    return this.run(p, tx => fileRequestIn(tx, p, input, { origin: 'form', sourceRef: null, authorization: 'standard' }));
  }

  async list(p: Principal, raw: unknown): Promise<{ items: WorkRequestItem[]; total: number }> {
    invariant(p && p.role !== 'bot', 'READ_ONLY', READ_ONLY, 403);
    const q = listSchema.parse(raw ?? {});
    return this.run(p, async tx => {
      const mine = 'r.requester_id=$1 OR public.work_request_seat(r.project_id)';
      const total = (await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM work_requests r WHERE ${mine}`, [p.id])).rows[0].n;
      const items = (await tx.query<WorkRequestItem>(`SELECT r.*,coalesce(pr.name,cat.name) AS project_name,
          (r.state='pending' AND r.requester_id<>$1 AND public.work_request_seat(r.project_id)) AS can_decide,
          public.work_request_seat(r.project_id) AS is_seat,
          CASE WHEN r.project_id=ANY(${PROJECT_LIST}) THEN EXISTS (SELECT 1 FROM bom_scopes s WHERE s.project_id=r.project_id AND s.enabled) END AS seat_open,
          w.code AS work_code
        FROM work_requests r
        LEFT JOIN projects pr ON pr.id=r.project_id
        LEFT JOIN public.tech_project_catalog() cat ON cat.id=r.project_id
        LEFT JOIN work_items w ON w.id=r.work_id
        WHERE ${mine}
        ORDER BY (r.state='pending') DESC, r.created_at DESC, r.id LIMIT $2 OFFSET $3`, [p.id, q.limit, q.offset])).rows;
      return { items, total };
    });
  }

  async decide(p: Principal, id: string, raw: unknown, key: string): Promise<{ request: WorkRequest; work: Work | null }> {
    invariant(p && p.role !== 'bot', 'READ_ONLY', READ_ONLY, 403);
    const input = decisionSchema.parse(raw);
    invariant(uuid.safeParse(id).success, 'NOT_FOUND', NOT_FOUND().message, 404);
    return this.decideIn(p, id, input, key, { id, ...input });
  }

  /**
   * Approve many requests in one go (M7): each request in its own transaction, with its own event and its own decider, so a row that fails is answered on its own
   * line and does not stop the others. The key of the call gives each request a key of its own; calling again with the same key and body writes nothing new:
   * a batch is read again with the requests this caller already decided, and each request's replay is matched on what the client sent, never on values read since.
   */
  async decideMany(p: Principal, raw: unknown, key: string): Promise<{ results: BulkResult[] }> {
    invariant(p && p.role !== 'bot', 'READ_ONLY', READ_ONLY, 403);
    invariant(/^[A-Za-z0-9_-]{8,100}$/.test(key), 'IDEMPOTENCY_REQUIRED', 'Cần mã thao tác hợp lệ để chống ghi lặp. Tải lại trang rồi thử lại.', 400);
    const input = manySchema.parse(raw);
    const view = await this.run(p, async tx => {
      const named = input.requestIds ?? (await tx.query<{ request_id: string }>(`SELECT k.request_id FROM work_import_rows k JOIN work_requests r ON r.id=k.request_id
        WHERE k.batch_id=$1 AND (r.state='pending' OR r.decided_by=$2) ORDER BY k.source_row,k.request_id`, [input.batchId, p.id])).rows.map(r => r.request_id);
      const ids = [...new Set(named)];
      invariant(ids.length <= BULK_CAP, 'TOO_MANY', `Một lượt duyệt tối đa ${BULK_CAP} yêu cầu. Chọn bớt rồi duyệt tiếp.`, 422);
      const requests = (await tx.query<Pick<WorkRequest, 'id' | 'project_id' | 'version' | 'assignee_id' | 'technical_id' | 'business_id'>>(
        'SELECT id,project_id,version,assignee_id,technical_id,business_id FROM work_requests WHERE id=ANY($1::uuid[])', [ids])).rows;
      // the services of the projects where the caller decides these requests, read for this call only
      const deciding = (await tx.query<{ project_id: string }>('SELECT DISTINCT project_id FROM work_requests WHERE id=ANY($1::uuid[]) AND public.work_request_seat(project_id)', [ids])).rows.map(r => r.project_id);
      await decidingIn(tx, p, deciding);
      const services = (await tx.query<{ id: string; project_id: string }>('SELECT id,project_id FROM services WHERE project_id=ANY($1::uuid[]) ORDER BY name,id', [deciding])).rows;
      return { ids, requests, services };
    });
    const results: BulkResult[] = [];
    for (const id of view.ids) {
      const request = view.requests.find(r => r.id === id);
      if (!request) { results.push({ id, ok: false, code: 'NOT_FOUND', message: NOT_FOUND().message }); continue; }
      const own = view.services.filter(s => s.project_id === request.project_id);
      const serviceId = input.services.find(s => s.projectId === request.project_id)?.serviceId ?? (own.length === 1 ? own[0].id : null);
      // people given for the whole lot fill only what this request left empty; they never replace a proposed person
      const people: People = { assigneeId: request.assignee_id ? null : input.assigneeId, technicalId: request.technical_id ? null : input.technicalId, businessId: request.business_id ? null : input.businessId };
      const one: DecisionInput = { decision: 'approve', expectedVersion: request.version, serviceId, code: null, note: input.note, ...people };
      try {
        // the replay hash holds what the client sent for this request (the version, the service and the people read here are checked inside, not hashed):
        // the same call again gets the stored answer of each request even when a service or a person of the project changed in between
        const sent = { services: input.services, note: input.note, assigneeId: input.assigneeId, technicalId: input.technicalId, businessId: input.businessId };
        const out = await this.decideIn(p, id, one, sha256(key + ':' + id), { bulk: { id, ...sent } });
        results.push({ id, ok: true, workId: out.work?.id ?? null });
      } catch (e) {
        if (e instanceof AppError) { results.push({ id, ok: false, code: e.code, message: e.message }); continue; }
        // an unexpected failure of one row is reported on its line, with its SQLSTATE in the log, never the message (it may carry data)
        console.error(JSON.stringify({ level: 'error', event: 'work_request_bulk_row_failed', sqlstate: (e as { code?: string }).code ?? null }));
        results.push({ id, ok: false, code: 'DECISION_FAILED', message: 'Không duyệt được yêu cầu này. Tải lại danh sách rồi duyệt lại riêng yêu cầu này.' });
      }
    }
    return { results };
  }

  private decideIn(p: Principal, id: string, input: DecisionInput, key: string, replay: unknown): Promise<{ request: WorkRequest; work: Work | null }> {
    return this.run(p, async tx => {
      // Lock first, then check from locked rows. Row level security shows the request only to its requester, its decider and a decider of the project, so a
      // person who is none of them gets the same 404 as for an id that does not exist.
      const request = (await tx.query<WorkRequest>('SELECT * FROM work_requests WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!request) throw NOT_FOUND();
      invariant(request.requester_id !== p.id, 'SELF_APPROVAL', 'Người tạo việc không tự duyệt việc của mình. Nhờ một BoM Tech khác hoặc một ghế BoM khác của dự án duyệt.', 403);
      const project = request.project_id;
      // the standing is read under share locks (the BoM Tech row; the scope row, then users and memberships, as the 3/3 vote does): a change waits for this decision
      const bomTech = (await tx.query<{ ok: boolean }>('SELECT public.tech_bom_standing(true) AS ok')).rows[0].ok === true;
      // a BoM Tech decides in a project they hold no membership in: this transaction alone reads and writes that one project
      if (bomTech) await decidingIn(tx, p, [project]);
      const scope = (await tx.query<{ seat_ids: string[]; enabled: boolean }>('SELECT seat_ids,enabled FROM bom_scopes WHERE project_id=$1 FOR SHARE', [project])).rows[0];
      const named = input.decision === 'approve' ? [request.assignee_id, request.technical_id, request.business_id, input.assigneeId, input.technicalId, input.businessId].filter((x): x is string => x !== null) : [];
      const eligible = (await tx.query<{ user_id: string; project_role: string; linked: boolean }>('SELECT * FROM bom_eligible_members($1,$2,true)',
        [project, [...new Set([p.id, ...named])]])).rows;
      const performers = await performersAmong(tx, named, true);
      const seatOf = (who: string) => scope?.enabled === true && scope.seat_ids.includes(who) && eligible.some(m => m.user_id === who);
      // M5: one of the three BoM Tech, or a seat of the project; no Telegram link is asked for on the web
      invariant(bomTech || seatOf(p.id), 'BOM_SEAT_REQUIRED', 'Chỉ BoM Tech hoặc ghế BoM của dự án được duyệt việc mới. Nhờ một BoM Tech duyệt yêu cầu này.', 403);
      return deduplicate(tx, p, project, key, replay, async () => {
        invariant(request.state === 'pending', 'REQUEST_DECIDED', 'Yêu cầu này đã được quyết định. Tải lại danh sách để xem kết quả.', 409);
        invariant(request.version === input.expectedVersion, 'VERSION_CONFLICT', 'Yêu cầu đã thay đổi. Tải lại danh sách trước khi quyết định.', 409);
        let work: Work | null = null;
        let record: Record<string, unknown> = {};
        let grantTo: string | null = null;
        if (input.decision === 'approve') {
          invariant(input.serviceId, 'SERVICE_REQUIRED', 'Chọn hệ thống để tạo việc.', 422);
          invariant((await tx.query('SELECT id FROM services WHERE id=$1 AND project_id=$2', [input.serviceId, project])).rows.length, 'SCOPE_DENIED', 'Hệ thống không thuộc dự án của yêu cầu. Chọn hệ thống khác.', 404);
          // M3: the decider fills an empty slot or changes a proposed person; both are recorded with what was proposed
          const proposed: People = { assigneeId: request.assignee_id, technicalId: request.technical_id, businessId: request.business_id };
          const final: People = { assigneeId: input.assigneeId ?? proposed.assigneeId, technicalId: input.technicalId ?? proposed.technicalId, businessId: input.businessId ?? proposed.businessId };
          const filledBySeat = SLOTS.filter(s => !proposed[s] && final[s]);
          const changedBySeat = SLOTS.filter(s => proposed[s] && final[s] !== proposed[s]);
          // work without an assignee could never be given one: in a project under BoM control the 3/3 ballot only moves an existing assignee (bom.ts)
          const a = final.assigneeId;
          invariant(a, 'ASSIGNEE_REQUIRED', 'Chọn người thực hiện trước khi duyệt.', 422);
          invariant(a !== final.technicalId && a !== final.businessId, 'SELF_ACCEPTANCE', 'Người thực hiện phải khác người nghiệm thu. Chọn người nghiệm thu khác.', 422);
          // M1 + M2: the performer is an engineer of the project, a Team Tech member (any project; a BoM seat or the decider included), or a BoM seat of the project.
          // Anybody else keeps the role rule: a viewer, an acceptor or a manager who is none of these is not a performer.
          invariant(eligible.some(m => m.user_id === a && m.project_role === 'engineer') || performers.has(a) || seatOf(a), 'INVALID_ASSIGNMENT',
            'Người thực hiện phải là thành viên Team Tech, người thực hiện (engineer) hoặc ghế BoM của dự án. Chọn người khác.', 422);
          for (const [who, role] of [[final.technicalId, 'technical'], [final.businessId, 'business']] as const)
            if (who) invariant(eligible.some(m => m.user_id === who && m.project_role === role), 'INVALID_ASSIGNMENT', 'Người nghiệm thu phải giữ đúng vai nghiệm thu trong dự án. Chọn người khác.', 422);
          // a Team Tech member who holds no membership in the project gets a traced grant (M2); a member works with the grant they hold.
          // Nobody opens a project to themselves: a decider with no membership there gives the work to another member of Team Tech.
          if (performers.has(a) && !eligible.some(m => m.user_id === a)) grantTo = a;
          invariant(grantTo !== p.id, 'SELF_GRANT', 'Bạn chưa có membership ở dự án này nên không tự nhận việc ở đây được. Nhờ một BoM Tech khác hoặc một ghế BoM của dự án giao việc này cho bạn.', 403);
          const workCode = input.code ?? request.code ?? 'WR-' + request.id.slice(0, 8).toUpperCase();
          work = (await tx.query<Work>(`INSERT INTO work_items(tenant_id,project_id,service_id,code,title,priority,due_at,assignee_id,technical_id,business_id,criteria,spec_url,source_sha)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NULL) ON CONFLICT (tenant_id,project_id,code) DO NOTHING RETURNING *`,
            [p.tenantId, project, input.serviceId, workCode, request.title, request.priority, request.due_at, a, final.technicalId, final.businessId, request.criteria, request.spec_url])).rows[0] ?? null;
          invariant(work, 'CODE_TAKEN', 'Mã việc đã có trong dự án. Chọn mã khác.', 409);
          record = { ...final, proposed, final, filledBySeat, changedBySeat };
          await append(tx, p, work, 'created', { title: work.title, revision: 1, sourceSha: null, requestId: request.id, requestedBy: request.requester_id,
            requesterName: request.requester_name, approvedBy: p.id, origin: request.origin, sourceRef: request.source_ref, proposed, final, filledBySeat, changedBySeat });
        }
        const state = input.decision === 'approve' ? 'approved' : 'rejected';
        const updated = (await tx.query<WorkRequest>(`UPDATE work_requests SET state=$1,decided_by=$2,decider_name=$3,decided_at=now(),decision_note=$4,work_id=$5,version=version+1,updated_at=now()
          WHERE id=$6 AND version=$7 RETURNING *`, [state, p.id, p.name, input.note, work?.id ?? null, id, input.expectedVersion])).rows[0];
        invariant(updated, 'VERSION_CONFLICT', 'Yêu cầu đã thay đổi. Tải lại danh sách trước khi quyết định.', 409);
        await tx.query('INSERT INTO work_request_events(tenant_id,project_id,request_id,requester_id,actor_id,kind,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [p.tenantId, project, id, request.requester_id, p.id, state, JSON.stringify({ note: input.note, workId: work?.id ?? null, ...record })]);
        if (work) {
          // M4: the source the 3/3 ballot reads, pointing at this request and its hash, valid for ever (the guard of migration 028 checks it)
          await tx.query(`INSERT INTO bom_sources(work_id,tenant_id,project_id,source_ref,fingerprint,checked_at,valid_until) VALUES($1,$2,$3,$4,$5,now(),'infinity')`,
            [work.id, p.tenantId, project, 'work_request:' + id, request.request_hash]);
          if (grantTo) await tx.query(`INSERT INTO work_access_grants(tenant_id,project_id,work_id,user_id,source_kind,source_id,granted_by) VALUES($1,$2,$3,$4,'work_request',$5,$6)`,
            [p.tenantId, project, work.id, grantTo, id, p.id]);
          await projectWorkSummary(tx, p.tenantId, project);
        }
        return { request: updated, work };
      });
    });
  }
}
