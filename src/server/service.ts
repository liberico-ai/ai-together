import { createHash } from 'node:crypto';
import { z } from 'zod';
import { scoped, type Database, type Queryable } from './db';
import { AppError, invariant } from './errors';
import { identityService } from './identity';
import { demoProfiles } from './identities';
import { projectWorkSummary } from './projector';
import { projectRole } from './types';
import type { Principal, Work, WorkDetail, Evidence, AuditEvent, Acceptance, Summary, Overview, WorkspaceData, Project, Service, State, Reconciliation } from './types';

const uuid = z.string().uuid();
const sha = z.string().regex(/^[a-f0-9]{40}$/, 'Cần SHA đủ 40 ký tự.');
const httpsUrl = z.string().url().max(1000).refine(v => { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; }, 'Dùng URL HTTPS không chứa thông tin đăng nhập.');
const base = { expectedVersion: z.number().int().positive() };
const commandSchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('transition'), state: z.enum(['planned','doing','review','blocked','done']), note: z.string().trim().min(3).max(1000) }).strict(),
  z.object({ ...base, kind: z.literal('evidence'), evidenceKind: z.enum(['spec','checks','release','uat']), sourceId: httpsUrl, sourceType: z.enum(['github','manual']), sourceSha: sha, note: z.string().trim().min(5).max(2000) }).strict(),
  z.object({ ...base, kind: z.enum(['technical_accept','business_accept']), sourceSha: sha, revision: z.number().int().positive(), evidenceId: uuid, confirmed: z.literal(true), note: z.string().trim().min(5).max(2000) }).strict(),
  z.object({ ...base, kind: z.literal('close_ticket'), ticketRef: z.string().trim().min(3).max(120), note: z.string().trim().min(5).max(2000) }).strict(),
  z.object({ ...base, kind: z.literal('revise'), sourceSha: sha, criteria: z.string().trim().min(10).max(3000), specUrl: httpsUrl, dueAt: z.string().datetime().nullable(), assigneeId: uuid, technicalId: uuid, businessId: uuid, note: z.string().trim().min(5).max(2000) }).strict(),
]);
const createSchema = z.object({ projectId: uuid, serviceId: uuid, code: z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,39}$/), title: z.string().trim().min(5).max(200), priority: z.enum(['normal','high']), dueAt: z.string().datetime().nullable(), assigneeId: uuid.nullable(), technicalId: uuid.nullable(), businessId: uuid.nullable(), criteria: z.string().max(3000), specUrl: httpsUrl.nullable(), sourceSha: sha.nullable() }).strict();
export type Command = z.infer<typeof commandSchema>;
export type CreateWork = z.infer<typeof createSchema>;
const transitions: Record<State, State[]> = { planned: ['doing','blocked'], doing: ['review','blocked'], review: ['doing','blocked','done'], blocked: ['doing','planned'], done: [] };
export function currentAcceptance(work: Work, events: AuditEvent[]): Acceptance {
  const valid = (kind: string) => events.some(e => e.kind === kind && e.payload.revision === work.revision && e.payload.sourceSha === work.source_sha);
  return { technical: valid('technical_accept'), business: valid('business_accept') };
}
function human(p: Principal) { invariant(p && p.role !== 'bot' && p.role !== 'viewer', 'READ_ONLY', 'Vai này chỉ được đọc dữ liệu trong phạm vi dự án.', 403); }
function canWriteSomewhere(p:Principal) {
  invariant(p.projectIds.some(projectId=>!['viewer','bot'].includes(projectRole(p,projectId))),
    'READ_ONLY','Vai này chỉ được đọc dữ liệu trong phạm vi dự án.',403);
}
function assigned(p: Principal, work: Work) { invariant(p.role === 'manager' || p.id === work.assignee_id, 'NOT_ASSIGNED', 'Chỉ điều phối hoặc người được giao mới được thực hiện thao tác này.', 403); }
async function approvers(p:Principal, assignee: string | null, tech: string | null, business: string | null, project: string) {
  invariant(!assignee || (assignee !== tech && assignee !== business), 'SELF_ACCEPTANCE', 'Người thực hiện phải khác người nghiệm thu.', 422);
  const people=process.env.LIBETECH_DEMO==='1'?Object.values(demoProfiles):await identityService().directory(p);
  for (const [id, role] of [[assignee,'engineer'],[tech,'technical'],[business,'business']]) {
    if (!id) continue;
    invariant(people.some(p => p.id === id && projectRole(p,project) === role), 'INVALID_ASSIGNMENT', 'Người được giao không có vai phù hợp trong dự án.', 422);
  }
}
export async function workRow(tx: Queryable, id: string, lock = false): Promise<Work> {
  invariant(uuid.safeParse(id).success, 'NOT_FOUND', 'Không tìm thấy việc trong phạm vi được cấp.', 404);
  const row = (await tx.query<Work>('SELECT * FROM work_items WHERE id = $1' + (lock ? ' FOR UPDATE' : ''), [id])).rows[0];
  invariant(row, 'SCOPE_DENIED', 'Không tìm thấy việc trong phạm vi được cấp.', 404); return row;
}
async function detail(tx: Queryable, work: Work): Promise<WorkDetail> {
  const evidence = (await tx.query<Evidence>('SELECT * FROM evidence WHERE work_id = $1 ORDER BY created_at DESC, id', [work.id])).rows;
  const events = (await tx.query<AuditEvent>('SELECT * FROM audit_events WHERE work_id = $1 ORDER BY created_at DESC, id', [work.id])).rows;
  return { work, evidence, events, acceptance: currentAcceptance(work, events) };
}
export async function append(tx: Queryable, p: Principal, w: Work, kind: string, payload: unknown) {
  await tx.query('INSERT INTO audit_events(tenant_id,project_id,work_id,actor_id,kind,payload) VALUES($1,$2,$3,$4,$5,$6)', [p.tenantId,w.project_id,w.id,p.id,kind,JSON.stringify(payload)]);
}
export async function deduplicate<T>(tx: Queryable, p: Principal, project: string, key: string, input: unknown, action: () => Promise<T>): Promise<T> {
  invariant(/^[A-Za-z0-9_-]{8,100}$/.test(key), 'IDEMPOTENCY_REQUIRED', 'Cần mã thao tác hợp lệ để chống ghi lặp.', 400);
  const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const created = (await tx.query<{ id: string }>(`INSERT INTO commands(tenant_id,project_id,actor_id,command_key,request_hash) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(tenant_id,project_id,actor_id,command_key) DO NOTHING RETURNING id`, [p.tenantId,project,p.id,key,hash])).rows[0];
  if (!created) {
    const old = (await tx.query<{ request_hash: string; response: T }>('SELECT request_hash,response FROM commands WHERE tenant_id=$1 AND project_id=$2 AND actor_id=$3 AND command_key=$4', [p.tenantId,project,p.id,key])).rows[0];
    invariant(old && old.request_hash === hash, 'IDEMPOTENCY_CONFLICT', 'Mã thao tác đã được dùng với nội dung khác.', 409);
    return old.response;
  }
  const result = await action();
  await tx.query('UPDATE commands SET response=$1, updated_at=now() WHERE id=$2', [JSON.stringify(result),created.id]);
  return result;
}
const emptySummary = (): Summary => ({ total:0,doing:0,review:0,done:0,blocked:0,missing_owner:0,missing_due:0,overdue:0,missing_spec:0 });
async function overview(tx: Queryable): Promise<Overview> {
  const rows = (await tx.query<{ metrics: Summary; snapshot_at: string }>('SELECT metrics,snapshot_at FROM analytics.work_summary')).rows;
  const summary = emptySummary();
  for (const row of rows) for (const key of Object.keys(summary) as (keyof Summary)[]) summary[key] += Number(row.metrics[key] || 0);
  const stamps = rows.map(r => new Date(r.snapshot_at).getTime());
  return { summary, asOf: stamps.length ? new Date(Math.min(...stamps)).toISOString() : null, source:'Z2', synthetic:process.env.LIBETECH_DEMO==='1' };
}
export class WorkService {
  constructor(private db: Database) {}
  workspace(p: Principal): Promise<WorkspaceData> {
    return scoped(this.db,p,async tx => ({
      people:process.env.LIBETECH_DEMO==='1'?Object.values(demoProfiles).filter(x=>x.tenantId===p.tenantId&&x.projectIds.some(id=>p.projectIds.includes(id))):await identityService().directory(p),
      reconciliations:(await tx.query<Reconciliation>('SELECT code,source_sha,source_id,source_type,ingested_at,quality_score,result FROM analytics.reconciliations ORDER BY ingested_at DESC LIMIT 50')).rows,
      projects:(await tx.query<Project>('SELECT id,name,bu FROM projects ORDER BY name')).rows,
      services:(await tx.query<Service>('SELECT * FROM services ORDER BY name')).rows,
      work:(await tx.query<Work>('SELECT * FROM work_items ORDER BY updated_at DESC, code LIMIT 200')).rows,
      overview:await overview(tx),
    }));
  }
  overview(p: Principal) { return scoped(this.db,p,overview); }
  detail(p: Principal, id: string) { return scoped(this.db,p,async tx => detail(tx,await workRow(tx,id))); }
  async refresh(p: Principal) {
    canWriteSomewhere(p);
    const managed=p.projectIds.filter(id=>projectRole(p,id)==='manager');
    invariant(managed.length,'MANAGER_REQUIRED','Chỉ điều phối được làm mới bản tổng hợp.',403);
    return scoped(this.db,p,async tx => { for (const id of managed) await projectWorkSummary(tx,p.tenantId,id); return overview(tx); });
  }
  async create(p: Principal, input: unknown, key: string): Promise<WorkDetail> {
    canWriteSomewhere(p);
    const data = createSchema.parse(input);
    invariant(projectRole(p,data.projectId)==='manager','MANAGER_REQUIRED','Chỉ điều phối dự án được tạo việc.',403);
    await approvers(p,data.assigneeId,data.technicalId,data.businessId,data.projectId);
    return scoped(this.db,p,async tx => {
      invariant((await tx.query('SELECT id FROM services WHERE id=$1 AND project_id=$2',[data.serviceId,data.projectId])).rows.length,'SCOPE_DENIED','Hệ thống không thuộc phạm vi được cấp.',404);
      return deduplicate(tx,p,data.projectId,key,data,async () => {
        const work = (await tx.query<Work>(`INSERT INTO work_items(tenant_id,project_id,service_id,code,title,priority,due_at,assignee_id,technical_id,business_id,criteria,spec_url,source_sha)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, [p.tenantId,data.projectId,data.serviceId,data.code,data.title,data.priority,data.dueAt,data.assigneeId,data.technicalId,data.businessId,data.criteria,data.specUrl,data.sourceSha])).rows[0];
        await append(tx,p,work,'created',{ title:data.title,revision:1,sourceSha:data.sourceSha });
        await projectWorkSummary(tx,p.tenantId,work.project_id);
        return detail(tx,work);
      });
    });
  }
  async command(principal: Principal, id: string, input: unknown, key: string): Promise<WorkDetail> {
    canWriteSomewhere(principal);
    const cmd = commandSchema.parse(input);
    return scoped(this.db,principal,async tx => {
      const work = await workRow(tx,id,true);
      const p={...principal,role:projectRole(principal,work.project_id)};
      human(p);
      return deduplicate(tx,p,work.project_id,key,{id,...cmd},async () => {
        invariant(work.version === cmd.expectedVersion,'VERSION_CONFLICT','Việc đã thay đổi. Đóng chi tiết và mở lại trước khi gửi.',409);
        let state = work.state, revision = work.revision;
        let payload: Record<string,unknown> = { ...cmd, revision:work.revision, sourceSha:work.source_sha };
        if (cmd.kind === 'transition') {
          assigned(p,work);
          invariant(transitions[work.state].includes(cmd.state),'INVALID_TRANSITION','Không được chuyển trạng thái theo bước này.',422);
          if (cmd.state === 'review') invariant(work.assignee_id && work.technical_id && work.business_id && work.source_sha && work.spec_url && work.criteria.trim().length >= 10,'INCOMPLETE_HANDOFF','Cần người thực hiện, hai người nghiệm thu, SHA và tiêu chí/spec trước khi bàn giao.',422);
          if (cmd.state === 'done') { const a = (await detail(tx,work)).acceptance; invariant(a.technical && a.business,'ACCEPTANCE_REQUIRED','Cần cả chấp nhận kỹ thuật và nghiệm thu nghiệp vụ cho đúng SHA/phiên bản.',422); }
          if (work.state === 'review' && cmd.state !== 'done') revision++;
          state = cmd.state; payload = { ...payload, from:work.state,to:state,newRevision:revision };
        } else if (cmd.kind === 'evidence') {
          const current=(await tx.query<{parts:{owner_id:string}[]}>(`SELECT b.proposed_assignment->'parts' AS parts
            FROM bom_receipts r JOIN bom_proposals b ON b.id=r.proposal_id
            WHERE r.work_id=$1 ORDER BY r.work_version DESC LIMIT 1`,[id])).rows[0];
          invariant(p.role === 'manager' || [work.assignee_id,work.technical_id,work.business_id].includes(p.id)
            || current?.parts.some(part=>part.owner_id===p.id),'NOT_ASSIGNED','Chỉ người tham gia được bổ sung bằng chứng.',403);
          invariant(work.state !== 'done','ALREADY_DONE','Muốn bổ sung hồ sơ, điều phối cần mở phiên bản mới.',422);
          invariant(cmd.sourceSha === work.source_sha,'SHA_MISMATCH','SHA bằng chứng phải trùng SHA đang bàn giao.',422);
          if (cmd.sourceType === 'github') invariant(new URL(cmd.sourceId).hostname === 'github.com','INVALID_SOURCE','Nguồn GitHub phải là github.com.',422);
          const evidence = (await tx.query<{id:string}>(`INSERT INTO evidence(tenant_id,project_id,work_id,kind,source_id,source_type,source_sha,revision,quality_score,note,actor_id)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10) RETURNING id`, [p.tenantId,work.project_id,id,cmd.evidenceKind,cmd.sourceId,cmd.sourceType,cmd.sourceSha,revision,cmd.note,p.id])).rows[0];
          payload = { ...payload,evidenceId:evidence.id,verification:'declared-not-fetched' };
        } else if (cmd.kind === 'technical_accept' || cmd.kind === 'business_accept') {
          const technical = cmd.kind === 'technical_accept';
          const participant=(await tx.query(`SELECT 1 FROM bom_receipts r JOIN bom_proposals b ON b.id=r.proposal_id
            WHERE r.work_id=$1 AND (b.before_assignment->>'lead_id'=$2 OR b.proposed_assignment->>'lead_id'=$2
             OR EXISTS (SELECT 1 FROM jsonb_array_elements((b.before_assignment->'parts')||(b.proposed_assignment->'parts')) AS part
              WHERE part->>'owner_id'=$2)) LIMIT 1`,[id,p.id])).rows.length;
          invariant(p.id !== work.assignee_id && !participant,'SELF_ACCEPTANCE','Người thực hiện không được tự nghiệm thu.',403);
          invariant(p.id === (technical ? work.technical_id : work.business_id) && p.role === (technical ? 'technical' : 'business'),'WRONG_ACCEPTOR','Bạn không phải người nghiệm thu được giao cho bước này.',403);
          invariant(work.state === 'review','NOT_IN_REVIEW','Việc phải ở trạng thái Chờ nghiệm thu.',422);
          invariant(cmd.sourceSha === work.source_sha && cmd.revision === revision,'REVISION_MISMATCH','Nghiệm thu phải khớp SHA và phiên bản hiện tại.',422);
          const e = (await tx.query<Evidence>('SELECT * FROM evidence WHERE id=$1 AND work_id=$2',[cmd.evidenceId,id])).rows[0];
          invariant(e && e.revision === revision && e.source_sha === work.source_sha && (technical ? ['checks','release'].includes(e.kind) : e.kind === 'uat'),'EVIDENCE_REQUIRED','Cần bằng chứng đúng phiên bản: checks/release cho kỹ thuật, UAT cho nghiệp vụ.',422);
          const a = (await detail(tx,work)).acceptance;
          invariant(!(technical ? a.technical : a.business),'ALREADY_ACCEPTED','Bước này đã được nghiệm thu cho phiên bản hiện tại.',409);
          payload = { ...payload,acceptanceType:technical?'technical':'business',humanDeclared:true };
        } else if (cmd.kind === 'close_ticket') {
          invariant(p.role === 'manager','MANAGER_REQUIRED','Chỉ điều phối được ghi nhận đóng ticket.',403);
          payload = { ...payload,changesAcceptance:false,changesWorkState:false };
        } else if (cmd.kind === 'revise') {
          invariant(p.role === 'manager','MANAGER_REQUIRED','Chỉ điều phối được mở phiên bản mới.',403);
          const controlled=(await tx.query('SELECT 1 FROM bom_scopes WHERE project_id=$1 AND enabled',[work.project_id])).rows.length;
          invariant(!controlled || cmd.assigneeId === work.assignee_id,
            'BOM_REQUIRED','Dùng phiếu BoM 3/3 để đổi người thực hiện.',409);
          invariant(cmd.assigneeId!==cmd.technicalId && cmd.assigneeId!==cmd.businessId,
            'SELF_ACCEPTANCE','Người thực hiện phải khác người nghiệm thu.',422);
          await approvers(p,controlled ? null : cmd.assigneeId,cmd.technicalId,cmd.businessId,work.project_id);
          revision++; state = 'doing';
          await tx.query('UPDATE work_items SET source_sha=$1,criteria=$2,spec_url=$3,due_at=$4,assignee_id=$5,technical_id=$6,business_id=$7 WHERE id=$8',[cmd.sourceSha,cmd.criteria,cmd.specUrl,cmd.dueAt,cmd.assigneeId,cmd.technicalId,cmd.businessId,id]);
          payload = { ...payload,oldSha:work.source_sha,newSha:cmd.sourceSha,oldRevision:work.revision,newRevision:revision };
        }
        const updated = (await tx.query<Work>('UPDATE work_items SET state=$1,revision=$2,version=version+1,updated_at=now() WHERE id=$3 RETURNING *',[state,revision,id])).rows[0];
        await append(tx,p,updated,cmd.kind,payload);
        await projectWorkSummary(tx,p.tenantId,work.project_id);
        return detail(tx,updated);
      });
    });
  }
}
