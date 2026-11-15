import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DOC_APPROVAL_TYPES } from './access-grants';
import { scoped, type Database, type Queryable } from './db';
import { claimDocumentCommand } from './document-commands';
import { READ_ROLES, reader, storable, uuid } from './document-review';
import { AppError } from './errors';
import { projectRole } from './types';
import type { DocType, Principal } from './types';

// Review delegations (slice 3, Task 7a): a manager of the project designates a member as commenter for named document types (OQ-31),
// and any manager of that project revokes the designation with a basis, effective at once (OQ-34).
// This service has no path that grants, proposes or implies approval of a baseline: that goes through the access-change ballot.
// Authority is read from the database inside the writing transaction (the caller's project role, the delegate's membership), never from the session alone;
// the guards of migration 020 (LTR02 on the INSERT, LTR03 on the UPDATE) are the last line and answer «not found / out of scope», never a server error.
// Every write: one scoped transaction on a single project, the acting person set, one idempotent claim, one immutable review_events row.
// Answers and errors carry no names; the basis text is never logged and never copied into an event (it stays on the row).
const NOT_FOUND = 'Không tìm thấy mục trong phạm vi được cấp.';
const denied = () => new AppError('SCOPE_DENIED', NOT_FOUND, 404);
const managerRequired = () => new AppError('MANAGER_REQUIRED', 'Chỉ điều phối dự án được thực hiện thao tác này.', 403);
const invalid = (message: string) => new AppError('DELEGATION_INVALID', message, 422);
const COLUMNS = 'id,project_id,delegate_id,doc_types,granted_by,basis,revoked_at,revoked_by,revoke_basis,version,created_at';

export type DelegationView = { id: string; projectId: string; delegateId: string; docTypes: DocType[]; grantedBy: string; basis: string; revokedAt: string | null; revokedBy: string | null;
  revokeBasis: string | null; version: number; createdAt: string };
export type ApproverView = { userId: string; docTypes: DocType[] };

// ---- input: strict schemas, identifiers lower-cased at parse time, text PostgreSQL can store and its CHECK (5..500 characters after trimming spaces) accepts ----
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/;
const codePoints = (s: string) => Array.from(s).length;
const basis = z.string().refine(storable, 'Chữ chứa ký tự không lưu được.').refine(s => !CONTROL.test(s), 'Căn cứ không được chứa ký tự điều khiển.')
  .refine(s => codePoints(s) <= 500 && codePoints(s.replace(/^ +| +$/g, '')) >= 5, 'Căn cứ cần từ 5 đến 500 ký tự.');
const docType = z.enum(DOC_APPROVAL_TYPES);
const listSchema = z.object({ projectId: uuid }).strict();
const grantSchema = z.object({
  projectId: uuid, delegateId: uuid,
  docTypes: z.array(docType).min(1).max(8).refine(a => new Set(a).size === a.length, 'Loại tài liệu không được trùng.').transform(a => [...a].sort()),
  basis,
}).strict();
const revokeSchema = z.object({ expectedVersion: z.number().int().positive().max(2147483647), basis }).strict();

type Row = { id: string; project_id: string; delegate_id: string; doc_types: DocType[]; granted_by: string; basis: string; revoked_at: unknown; revoked_by: string | null; revoke_basis: string | null; version: number; created_at: unknown };
const iso = (v: unknown) => new Date(v as string).toISOString();
const toView = (r: Row): DelegationView => ({ id: r.id, projectId: r.project_id, delegateId: r.delegate_id, docTypes: r.doc_types, grantedBy: r.granted_by, basis: r.basis,
  revokedAt: r.revoked_at == null ? null : iso(r.revoked_at), revokedBy: r.revoked_by, revokeBasis: r.revoke_basis, version: r.version, createdAt: iso(r.created_at) });
const sqlstate = (e: unknown) => (e as { code?: string })?.code;

export class DelegationService {
  constructor(private db: Database) {}

  /** One scoped transaction on a single project, with the acting person set for the database (granter, revoker and event actor). */
  private run<T>(p: Principal, projectId: string, fn: (tx: Queryable) => Promise<T>): Promise<T> {
    return scoped(this.db, { ...p, projectIds: [projectId] }, async tx => {
      await tx.query("SELECT set_config('app.person_id',$1,true)", [p.id.toLowerCase()]);
      return fn(tx);
    });
  }
  /** The project role the database holds for a person right now (the same reader the guards use); null when the person is not an active member. */
  private async dbRole(tx: Queryable, projectId: string, personId: string): Promise<string | null> {
    return (await tx.query<{ project_role: string }>('SELECT project_role FROM public.bom_eligible_members($1::uuid, ARRAY[$2::uuid])', [projectId, personId])).rows[0]?.project_role ?? null;
  }
  /** The project of a delegation among the projects this person is scoped to. Missing, out of scope, viewer and bot look the same. */
  private async locate(p: Principal, delegationId: string): Promise<{ id: string; projectId: string }> {
    const id = uuid.safeParse(delegationId);
    if (!p || p.role === 'bot' || !p.projectIds?.length || !id.success) throw denied();
    const row = await scoped(this.db, p, async tx => (await tx.query<{ project_id: string }>('SELECT project_id FROM review_delegations WHERE id=$1', [id.data])).rows[0]);
    if (!row?.project_id || !reader(p, row.project_id)) throw denied();
    return { id: id.data, projectId: row.project_id };
  }
  private async view(tx: Queryable, projectId: string, id: string): Promise<DelegationView> {
    const row = (await tx.query<Row>(`SELECT ${COLUMNS} FROM review_delegations WHERE id=$1 AND project_id=$2`, [id, projectId])).rows[0];
    if (!row) throw denied();
    return toView(row);
  }
  private async event(tx: Queryable, p: Principal, projectId: string, entityId: string, kind: string, requestId: string, payload: unknown): Promise<void> {
    await tx.query(`INSERT INTO review_events(tenant_id,project_id,entity_type,entity_id,actor_id,kind,request_id,trace_id,payload) VALUES($1,$2,'review_delegation',$3,$4,$5,$6,$7,$8)`,
      [p.tenantId, projectId, entityId, p.id.toLowerCase(), kind, requestId, randomUUID(), JSON.stringify(payload)]);
  }

  /** Delegations of the project (live first, then revoked, at most 200) and the holders of an approval grant (read-only). Ids only, no names. */
  async list(p: Principal, raw: unknown): Promise<{ reviewers: DelegationView[]; approvers: ApproverView[]; canDesignate: boolean }> {
    if (!p || p.role === 'bot') throw denied();
    const q = listSchema.parse(raw);
    if (!reader(p, q.projectId)) throw denied();
    return this.run(p, q.projectId, async tx => {
      const reviewers = (await tx.query<Row>(`SELECT ${COLUMNS} FROM review_delegations WHERE project_id=$1 ORDER BY (revoked_at IS NOT NULL), created_at DESC, id LIMIT 200`, [q.projectId])).rows.map(toView);
      const approvers = (await tx.query<{ user_id: string; doc_types: DocType[] }>('SELECT user_id,doc_types FROM public.document_approvers($1::uuid)', [q.projectId])).rows
        .map(a => ({ userId: a.user_id, docTypes: a.doc_types }));
      const canDesignate = projectRole(p, q.projectId) === 'manager' && (await this.dbRole(tx, q.projectId, p.id.toLowerCase())) === 'manager';
      return { reviewers, approvers, canDesignate };
    });
  }

  /** requestId comes from the caller (the HTTP request id), never from JSON. */
  async grant(p: Principal, raw: unknown, key: string, requestId: string): Promise<DelegationView> {
    if (!p || p.role === 'bot') throw denied();
    const input = grantSchema.parse(raw);
    uuid.parse(requestId);
    if (!reader(p, input.projectId)) throw denied();                                                                  // (1)
    if (projectRole(p, input.projectId) !== 'manager') throw managerRequired();                                       // (2)
    const me = p.id.toLowerCase();
    return this.run(p, input.projectId, async tx => {
      if ((await this.dbRole(tx, input.projectId, me)) !== 'manager') throw denied();                                 // (2) again, from the database: a stale session
      if (input.delegateId === me) throw invalid('Không tự chỉ định chính mình.');                                   // (3)
      const role = await this.dbRole(tx, input.projectId, input.delegateId);                                          // (4) one answer for outsider, viewer, disabled
      if (!role || !READ_ROLES.has(role)) throw invalid('Người được chỉ định phải là thành viên đang hoạt động của dự án.');
      const done = await claimDocumentCommand(tx, p, input.projectId, key, { op: 'review.delegation.grant', ...input }, async () => {   // (5)
        let id: string | undefined;
        try {                                                                                                         // (6) the unique index of live designations decides
          id = (await tx.query<{ id: string }>(`INSERT INTO review_delegations(tenant_id,project_id,delegate_id,doc_types,granted_by,basis) VALUES($1,$2,$3,$4::text[],$5,$6)
            ON CONFLICT (tenant_id,project_id,delegate_id) WHERE revoked_at IS NULL DO NOTHING RETURNING id`,
            [p.tenantId, input.projectId, input.delegateId, input.docTypes, me, input.basis])).rows[0]?.id;
        } catch (e) {
          // the manager or the delegate stopped being eligible between the read above and this insert: the guard refuses with LTR02; any other database error stays as it is
          if (sqlstate(e) === 'LTR02') throw denied();
          throw e;
        }
        if (!id) throw new AppError('DELEGATION_EXISTS', 'Người này đã có uỷ quyền nhận xét còn hiệu lực trong dự án.', 409);
        await this.event(tx, p, input.projectId, id, 'delegation.granted', requestId, { delegateId: input.delegateId, docTypes: input.docTypes });   // (7)
        return { delegationId: id };
      });
      return this.view(tx, input.projectId, done.delegationId);
    });
  }

  /** OQ-34 (a): any manager of that project, with a basis; the database stamps the time and the version. */
  async revoke(p: Principal, delegationId: string, raw: unknown, key: string, requestId: string): Promise<DelegationView> {
    if (!p || p.role === 'bot') throw denied();
    uuid.parse(requestId);
    const { id, projectId } = await this.locate(p, delegationId);                                                     // (1)(2) scope and reading role
    const input = revokeSchema.parse(raw);
    if (projectRole(p, projectId) !== 'manager') throw managerRequired();                                             // also for the delegate themselves
    const me = p.id.toLowerCase();
    return this.run(p, projectId, async tx => {
      if ((await this.dbRole(tx, projectId, me)) !== 'manager') throw denied();                                       // stale session
      const done = await claimDocumentCommand(tx, p, projectId, key, { op: 'review.delegation.revoke', delegationId: id, ...input }, async () => {            // (3)
        let row: { delegate_id: string; version: number } | undefined;
        try {
          // revoked_at is a placeholder the guard needs to see set; the trigger overwrites it with its own clock and stamps version and updated_at
          row = (await tx.query<{ delegate_id: string; version: number }>(`UPDATE review_delegations SET revoked_at=now(),revoked_by=$1,revoke_basis=$2
            WHERE id=$3 AND project_id=$4 AND version=$5 AND revoked_at IS NULL RETURNING delegate_id,version`, [me, input.basis, id, projectId, input.expectedVersion])).rows[0];
        } catch (e) {
          // the caller stopped being a manager of this project between the read above and this update: the guard refuses with LTR03
          if (sqlstate(e) === 'LTR03') throw denied();
          throw e;
        }
        if (!row) throw new AppError('DELEGATION_CONFLICT', 'Uỷ quyền này đã thay đổi. Tải lại để xem trạng thái mới.', 409);                          // (4)
        await this.event(tx, p, projectId, id, 'delegation.revoked', requestId, { delegateId: row.delegate_id, versionBefore: input.expectedVersion, versionAfter: row.version });   // (5)
        return { delegationId: id };
      });
      return this.view(tx, projectId, done.delegationId);
    });
  }
}
