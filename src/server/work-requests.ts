import { createHash } from 'node:crypto';
import { z } from 'zod';
import { scoped, type Database, type Queryable } from './db';
import { AppError, invariant } from './errors';
import { projectWorkSummary } from './projector';
import { append, approvers, deduplicate, httpsUrl } from './service';
import { projectRole } from './types';
import type { Principal, Project, Work } from './types';

// Team Tech files a work request; one BoM seat of the project other than the requester approves or rejects it (migration 024).
// Identity and tenant come from the principal only. Every transaction runs as libetech_runtime with app.person_id set (the convention of inbox.ts run()).
// Approval creates the work_items row in the same transaction, with the proposed assignee and acceptors (the initial assignment, as WorkService.create allowed); later changes of the assignee need the 3/3 ballot (bom_guard_assignment).
const uuid = z.string().uuid();
const code = z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,39}$/);
const submitSchema = z.object({
  projectId: uuid, requestKey: uuid, code: code.nullable(), title: z.string().trim().min(5).max(200), priority: z.enum(['normal', 'high']),
  dueAt: z.string().datetime().nullable(), criteria: z.string().max(3000), specUrl: httpsUrl.nullable(),
  assigneeId: uuid.nullable(), technicalId: uuid.nullable(), businessId: uuid.nullable(),
}).strict();
// On approval the seat may fill the people the request left empty (the requester may hold no grant in the project and so cannot see its members);
// it never replaces a person the requester proposed. Changing people after that is the 3/3 ballot.
const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']), expectedVersion: z.number().int().positive(), serviceId: uuid.nullable(), code: code.nullable(), note: z.string().trim().min(5).max(2000),
  assigneeId: uuid.nullable().default(null), technicalId: uuid.nullable().default(null), businessId: uuid.nullable().default(null),
}).strict();
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
 * What leaves the server (E-SEC-01): no tenant, no idempotency key or hash, and the decider's id only for a seat of the project or the decider.
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

const NOT_FOUND = () => new AppError('NOT_FOUND', 'Không tìm thấy yêu cầu trong phạm vi được cấp.', 404);
const scopeDenied = () => new AppError('SCOPE_DENIED', 'Không tìm thấy dự án trong phạm vi được cấp.', 404);
const canonical = (o: Record<string, unknown>) => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const PROJECT_LIST = "string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]";

export class WorkRequestService {
  constructor(private db: Database) {}
  private run<T>(p: Principal, fn: (tx: Queryable) => Promise<T>): Promise<T> {
    return scoped(this.db, p, async tx => {
      await tx.query("SELECT set_config('app.person_id',$1,true)", [p.id]);
      return fn(tx);
    });
  }

  /** Every project for a Team Tech member; for anybody else, the projects they manage. */
  async catalog(p: Principal): Promise<CatalogProject[]> {
    return this.run(p, async tx => {
      const all = (await tx.query<CatalogProject>('SELECT id,name,bu FROM public.tech_project_catalog()')).rows;
      if (all.length) return all;
      const managed = p.projectIds.filter(id => projectRole(p, id) === 'manager');
      return (await tx.query<CatalogProject>('SELECT id,name,bu FROM projects WHERE id=ANY($1::uuid[]) ORDER BY name,id', [managed])).rows;
    });
  }

  async submit(p: Principal, raw: unknown): Promise<{ request: WorkRequest; replayed: boolean }> {
    invariant(p && p.role !== 'bot', 'READ_ONLY', 'Vai này chỉ được đọc dữ liệu trong phạm vi dự án.', 403);
    const { requestKey, ...content } = submitSchema.parse(raw);
    const hash = sha256(canonical(content));
    return this.run(p, async tx => {
      const tech = (await tx.query<{ ok: boolean }>('SELECT public.app_actor_is_tech_member() AS ok')).rows[0].ok === true;
      const denied = () => new AppError('WORK_REQUEST_DENIED', 'Chỉ thành viên Team Tech hoặc điều phối dự án được tạo việc.', 403);
      if (!tech && !p.projectIds.some(id => projectRole(p, id) === 'manager')) throw denied();
      const inScope = tech
        ? (await tx.query('SELECT 1 FROM public.tech_project_catalog() WHERE id=$1', [content.projectId])).rows.length > 0
        : p.projectIds.includes(content.projectId);
      if (!inScope) throw scopeDenied();
      if (!tech && projectRole(p, content.projectId) !== 'manager') throw denied();
      // The filing policy asks the same question of the account rows (work_request_filer, 024); a session whose grant the database does not back
      // (a demo profile, a manager role removed since sign-in) gets this answer instead of a row-level security error.
      const filer = (await tx.query<{ ok: boolean }>('SELECT public.work_request_filer($1) AS ok', [content.projectId])).rows[0].ok === true;
      if (!filer) throw denied();
      await approvers({ ...p, role: projectRole(p, content.projectId) }, content.assigneeId, content.technicalId, content.businessId, content.projectId);
      const made = (await tx.query<WorkRequest>(`INSERT INTO work_requests(tenant_id,project_id,requester_id,requester_name,origin,request_key,request_hash,code,title,priority,due_at,criteria,spec_url,assignee_id,technical_id,business_id)
        VALUES($1,$2,$3,$4,'form',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (tenant_id,requester_id,request_key) DO NOTHING RETURNING *`,
        [p.tenantId, content.projectId, p.id, p.name, requestKey, hash, content.code, content.title, content.priority, content.dueAt, content.criteria, content.specUrl, content.assigneeId, content.technicalId, content.businessId])).rows[0];
      if (!made) {
        const old = (await tx.query<WorkRequest>('SELECT * FROM work_requests WHERE tenant_id=$1 AND requester_id=$2 AND request_key=$3', [p.tenantId, p.id, requestKey])).rows[0];
        invariant(old && old.request_hash === hash, 'IDEMPOTENCY_CONFLICT', 'Mã thao tác đã được dùng với nội dung khác.', 409);
        return { request: old, replayed: true };
      }
      await tx.query(`INSERT INTO work_request_events(tenant_id,project_id,request_id,requester_id,actor_id,kind,payload) VALUES($1,$2,$3,$4,$4,'submitted',$5)`,
        [p.tenantId, made.project_id, made.id, p.id, JSON.stringify({ origin: 'form', title: made.title })]);
      return { request: made, replayed: false };
    });
  }

  async list(p: Principal, raw: unknown): Promise<{ items: WorkRequestItem[]; total: number }> {
    invariant(p && p.role !== 'bot', 'READ_ONLY', 'Vai này chỉ được đọc dữ liệu trong phạm vi dự án.', 403);
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
    invariant(p && p.role !== 'bot', 'READ_ONLY', 'Vai này chỉ được đọc dữ liệu trong phạm vi dự án.', 403);
    const input = decisionSchema.parse(raw);
    invariant(uuid.safeParse(id).success, 'NOT_FOUND', NOT_FOUND().message, 404);
    return this.run(p, async tx => {
      // Lock first, then check from locked rows. Row level security shows the request only to its requester, its decider and a seat of the project, so a
      // person who is none of them gets the same 404 as for an id that does not exist.
      const request = (await tx.query<WorkRequest>('SELECT * FROM work_requests WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!request) throw NOT_FOUND();
      invariant(request.requester_id !== p.id, 'SELF_APPROVAL', 'Người tạo việc không tự duyệt việc của mình.', 403);
      const project = request.project_id;
      // the seat standing is read under share locks (the scope row, then users, memberships and Telegram links, as the 3/3 vote does): a change of seats waits for this decision
      const scope = (await tx.query<{ seat_ids: string[]; enabled: boolean }>('SELECT seat_ids,enabled FROM bom_scopes WHERE project_id=$1 FOR SHARE', [project])).rows[0];
      const named = [request.assignee_id, request.technical_id, request.business_id, input.assigneeId, input.technicalId, input.businessId].filter((x): x is string => x !== null);
      const eligible = (await tx.query<{ user_id: string; project_role: string; linked: boolean }>('SELECT * FROM bom_eligible_members($1,$2,true)',
        [project, [...new Set([p.id, ...(input.decision === 'approve' ? named : [])])]])).rows;
      const standing = scope?.enabled === true && scope.seat_ids.includes(p.id) && eligible.some(m => m.user_id === p.id && m.linked);
      invariant(standing, 'BOM_SEAT_REQUIRED', 'Chỉ ghế BoM của dự án được duyệt việc mới.', 403);
      return deduplicate(tx, p, project, key, { id, ...input }, async () => {
        invariant(request.state === 'pending', 'REQUEST_DECIDED', 'Yêu cầu này đã được quyết định.', 409);
        invariant(request.version === input.expectedVersion, 'VERSION_CONFLICT', 'Yêu cầu đã thay đổi. Tải lại danh sách trước khi quyết định.', 409);
        let work: Work | null = null;
        let people: { assigneeId: string | null; technicalId: string | null; businessId: string | null; filledBySeat: string[] } | null = null;
        if (input.decision === 'approve') {
          invariant(input.serviceId, 'SERVICE_REQUIRED', 'Chọn hệ thống để tạo việc.', 422);
          invariant((await tx.query('SELECT id FROM services WHERE id=$1 AND project_id=$2', [input.serviceId, project])).rows.length, 'SCOPE_DENIED', 'Hệ thống không thuộc phạm vi được cấp.', 404);
          const filledBySeat: string[] = [];
          const fill = (field: string, proposed: string | null, given: string | null) => {
            if (proposed) {
              invariant(!given || given === proposed, 'PROPOSAL_FIXED', 'Người duyệt chỉ điền chỗ còn trống. Muốn đổi người đã đề xuất thì từ chối để người tạo gửi lại.', 422);
              return proposed;
            }
            if (given) filledBySeat.push(field);
            return given;
          };
          people = { assigneeId: fill('assigneeId', request.assignee_id, input.assigneeId), technicalId: fill('technicalId', request.technical_id, input.technicalId),
            businessId: fill('businessId', request.business_id, input.businessId), filledBySeat };
          // work without an assignee could never be given one: in a project under BoM control the 3/3 ballot only moves an existing assignee (bom.ts)
          invariant(people.assigneeId, 'ASSIGNEE_REQUIRED', 'Chọn người thực hiện trước khi duyệt.', 422);
          invariant(people.assigneeId !== p.id, 'SELF_ASSIGNMENT', 'Ghế BoM không giao việc mới cho chính mình khi duyệt.', 403);
          // giving new work to a BoM member is held for the Chairman (OQ-60 (e)): «Giữ luật xác nhận 3/3 … kể cả chia việc giữa ba thành viên BoM»
          invariant(!scope.seat_ids.includes(people.assigneeId), 'BOM_ASSIGNEE_HELD', 'Giao việc mới cho một thành viên BoM đang chờ Chairman quyết (OQ-60 (e)). Chọn người khác hoặc để yêu cầu chờ.', 422);
          invariant(people.assigneeId !== people.technicalId && people.assigneeId !== people.businessId, 'SELF_ACCEPTANCE', 'Người thực hiện phải khác người nghiệm thu.', 422);
          // every final person is an active, activated member of the project with the right role, read from the locked rows
          for (const [who, role] of [[people.assigneeId, 'engineer'], [people.technicalId, 'technical'], [people.businessId, 'business']] as const)
            if (who) invariant(eligible.some(m => m.user_id === who && m.project_role === role), 'INVALID_ASSIGNMENT', 'Người được giao không có vai phù hợp trong dự án.', 422);
          const workCode = input.code ?? request.code ?? 'WR-' + request.id.slice(0, 8).toUpperCase();
          work = (await tx.query<Work>(`INSERT INTO work_items(tenant_id,project_id,service_id,code,title,priority,due_at,assignee_id,technical_id,business_id,criteria,spec_url,source_sha)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NULL) ON CONFLICT (tenant_id,project_id,code) DO NOTHING RETURNING *`,
            [p.tenantId, project, input.serviceId, workCode, request.title, request.priority, request.due_at, people.assigneeId, people.technicalId, people.businessId, request.criteria, request.spec_url])).rows[0] ?? null;
          invariant(work, 'CODE_TAKEN', 'Mã việc đã có trong dự án. Chọn mã khác.', 409);
          await append(tx, p, work, 'created', { title: work.title, revision: 1, sourceSha: null, requestId: request.id, requestedBy: request.requester_id,
            requesterName: request.requester_name, approvedBy: p.id, origin: request.origin, sourceRef: request.source_ref, filledBySeat });
        }
        const state = input.decision === 'approve' ? 'approved' : 'rejected';
        const updated = (await tx.query<WorkRequest>(`UPDATE work_requests SET state=$1,decided_by=$2,decider_name=$3,decided_at=now(),decision_note=$4,work_id=$5,version=version+1,updated_at=now()
          WHERE id=$6 AND version=$7 RETURNING *`, [state, p.id, p.name, input.note, work?.id ?? null, id, input.expectedVersion])).rows[0];
        invariant(updated, 'VERSION_CONFLICT', 'Yêu cầu đã thay đổi. Tải lại danh sách trước khi quyết định.', 409);
        await tx.query('INSERT INTO work_request_events(tenant_id,project_id,request_id,requester_id,actor_id,kind,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [p.tenantId, project, id, request.requester_id, p.id, state, JSON.stringify({ note: input.note, workId: work?.id ?? null, ...(people ?? {}) })]);
        if (work) await projectWorkSummary(tx, p.tenantId, project);
        return { request: updated, work };
      });
    });
  }
}
