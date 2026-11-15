import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { scoped, type Database, type Queryable } from './db';
import { claimDocumentCommand } from './document-commands';
import { AppError } from './errors';
import { storable } from './text-safety';
import { projectRole } from './types';
import type { DocType, Principal, SourceRef } from './types';

// Document review (slice 3, Task 5): the queue of documents waiting for a look, the revision with its diff and comments, and the decision.
// A decision names the exact revision, hash and record version the person read; it is stored only while that revision is still the document's latest.
// Authority is read from the database inside the transaction (the live delegation row, public.document_approvers), never from the session.
// Every write: one scoped transaction on a single project, the document row locked first, one idempotent claim, one immutable review_events row.
// No answer and no error carries a name, a title, a count or a comment text from outside the caller's scope.
const NOT_FOUND = 'Không tìm thấy tài liệu trong phạm vi được cấp.';
const denied = () => new AppError('SCOPE_DENIED', NOT_FOUND, 404);
const notAuthorized = () => new AppError('APPROVER_NOT_AUTHORIZED', 'Bạn chưa được giao quyền cho thao tác này với loại tài liệu này.', 403);
const stale = () => new AppError('REVISION_CONFLICT', 'Nguồn đã đổi. Đọc bản mới trước khi gửi lại.', 409);
const alreadyDecided = () => new AppError('REVIEW_ALREADY_DECIDED', 'Bản này đã có quyết định.', 409);
export const READ_ROLES = new Set(['manager', 'engineer', 'technical', 'business']);

export type ReviewRevision = { id: string; revisionNo: number; basedOnRevisionId: string | null; sourceRevision: string | null; sourceHash: string | null; hashVerification: 'self_declared' | 'verified'; frozen: boolean;
  changes: { summary: string; present: string[]; missing: string[] }; sourceRefs: SourceRef[]; proposedBy: string; createdAt: string };
export type EligibilityReason = 'AUTHOR' | 'NO_DELEGATION' | 'TYPE_NOT_COVERED' | 'REVIEW_ONLY' | 'NOT_FROZEN' | 'ALREADY_DECIDED';
export type Eligibility = { canComment: boolean; canRequestChanges: boolean; canApprove: boolean; reason: EligibilityReason | null };
export type DecisionView = { id: string; result: 'approved' | 'changes_requested'; revisionId: string; revisionNo: number; revisionHash: string | null; scopeNote: string; exceptions: string[]; decidedBy: string; decidedAt: string };
export type ReviewItem = { documentId: string; projectId: string; refCode: string; title: string; docType: DocType; recordVersion: number; approvedRevisionId: string | null; revision: ReviewRevision;
  approverState: 'unassigned' | 'assigned'; eligibility: Eligibility; decision: DecisionView | null };
export type CommentView = { id: string; parentId: string | null; kind: 'comment' | 'addressed' | 'resolved'; anchor: string; body: string; actorId: string; revisionId: string; createdAt: string };
export type DiffEntry = { field: 'summary' | 'present' | 'missing' | 'source_refs' | 'source_revision' | 'source_hash'; change: 'added' | 'removed' | 'modified'; before: string | null; after: string | null };
export type ReviewDetail = { item: ReviewItem; base: ReviewRevision | null; diff: DiffEntry[]; comments: CommentView[] };

// ---- input: strict schemas, identifiers lower-cased at parse time, free text PostgreSQL can store ----
export { storable };
export const text = (min: number, max: number) => z.string().min(min).max(max).refine(storable, 'Chữ chứa ký tự không lưu được.');
export const uuid = z.string().uuid().transform(s => s.toLowerCase());
const queueSchema = z.object({ projectId: uuid, limit: z.number().int().min(1).max(200).default(50), offset: z.number().int().min(0).default(0) }).strict();
const decideSchema = z.object({
  revisionId: uuid,
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  expectedVersion: z.number().int().positive(),
  result: z.enum(['approved', 'changes_requested']),
  scopeNote: text(5, 1000).refine(s => s.trim().length >= 5, 'Ghi chú phạm vi cần ít nhất 5 ký tự.'),
  // the stored array is limited to 16 384 bytes of jsonb text; one comma and space per item is counted on top of the compact form
  exceptions: z.array(text(1, 300)).max(10).default([]).refine(a => Buffer.byteLength(JSON.stringify(a)) + a.length <= 16384, 'Danh sách ngoại lệ quá dài.'),
}).strict();
const commentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('comment'), revisionId: uuid, anchor: text(0, 200).default(''), body: text(1, 2000) }).strict(),
  z.object({ kind: z.literal('addressed'), parentId: uuid, body: text(1, 2000) }).strict(),
  z.object({ kind: z.literal('resolved'), parentId: uuid, body: text(1, 2000) }).strict(),
]);

// ---- pure rules ----
export function isFrozen(r: { snapshot_ref: string | null; hash_verification: string; source_hash: string | null }): boolean {
  return r.snapshot_ref !== null && r.hash_verification === 'verified' && r.source_hash !== null;
}

/** Added, removed or modified between the baseline (or the revision this one is based on) and the revision under review. Removed entries come before added ones within a field. */
export function revisionDiff(base: ReviewRevision | null, candidate: ReviewRevision): DiffEntry[] {
  const out: DiffEntry[] = [];
  const scalar = (field: 'summary' | 'source_revision' | 'source_hash', before: string | null, after: string | null) => {
    if ((before ?? '') === (after ?? '')) return;
    out.push({ field, change: !before ? 'added' : !after ? 'removed' : 'modified', before, after });
  };
  const list = (field: 'present' | 'missing' | 'source_refs', before: string[], after: string[]) => {
    const b = new Set(before), a = new Set(after);
    for (const v of b) if (!a.has(v)) out.push({ field, change: 'removed', before: v, after: null });
    for (const v of a) if (!b.has(v)) out.push({ field, change: 'added', before: null, after: v });
  };
  const refKey = (r: SourceRef) => `${r.kind}:${r.label}:${r.value}`;
  scalar('summary', base ? base.changes.summary : null, candidate.changes.summary);
  list('present', base?.changes.present ?? [], candidate.changes.present);
  list('missing', base?.changes.missing ?? [], candidate.changes.missing);
  list('source_refs', (base?.sourceRefs ?? []).map(refKey), candidate.sourceRefs.map(refKey));
  scalar('source_revision', base?.sourceRevision ?? null, candidate.sourceRevision);
  scalar('source_hash', base?.sourceHash ?? null, candidate.sourceHash);
  return out;
}

/** What the viewer sees; `decide` and `comment` re-check on their own. Rows are taken in order and the first match answers. */
export function eligibility(i: { actorId: string; proposedBy: string; docType: DocType; frozen: boolean; decided: boolean; reviewTypes: readonly string[] | null; approveTypes: readonly string[] }): Eligibility {
  const no = (reason: EligibilityReason): Eligibility => ({ canComment: false, canRequestChanges: false, canApprove: false, reason });
  if (i.decided) return no('ALREADY_DECIDED');
  if (i.actorId === i.proposedBy) return no('AUTHOR');
  if (i.reviewTypes === null && i.approveTypes.length === 0) return no('NO_DELEGATION');
  const approves = i.approveTypes.includes(i.docType);
  if (!approves && !(i.reviewTypes ?? []).includes(i.docType)) return no('TYPE_NOT_COVERED');
  if (!approves) return { canComment: true, canRequestChanges: true, canApprove: false, reason: 'REVIEW_ONLY' };
  if (!i.frozen) return { canComment: true, canRequestChanges: true, canApprove: false, reason: 'NOT_FROZEN' };
  return { canComment: true, canRequestChanges: true, canApprove: true, reason: null };
}

// ---- rows ----
const iso = (v: unknown) => new Date(v as string).toISOString();
type RecordRow = { id: string; project_id: string; ref_code: string; title: string; doc_type: DocType; version: number; latest_revision_id: string | null; approved_revision_id: string | null };
type RevisionRow = { id: string; revision_no: number; based_on_revision_id: string | null; source_revision: string | null; source_hash: string | null; hash_verification: 'self_declared' | 'verified';
  snapshot_ref: string | null; changes: Partial<ReviewRevision['changes']> | null; source_refs: SourceRef[] | null; proposed_by: string; created_at: unknown };
type DecisionRow = { id: string; document_revision_id: string; revision_no: number; revision_hash: string | null; result: DecisionView['result']; scope_note: string; exceptions: string[]; decided_by: string; decided_at: unknown };
const RECORD_COLS = 'd.id,d.project_id,d.ref_code,d.title,d.doc_type,d.version,d.latest_revision_id,d.approved_revision_id';
const REVISION_COLS = 'v.id,v.revision_no,v.based_on_revision_id,v.source_revision,v.source_hash,v.hash_verification,v.snapshot_ref,v.changes,v.source_refs,v.proposed_by,v.created_at';
const toRevision = (r: RevisionRow): ReviewRevision => ({
  id: r.id, revisionNo: r.revision_no, basedOnRevisionId: r.based_on_revision_id, sourceRevision: r.source_revision, sourceHash: r.source_hash, hashVerification: r.hash_verification, frozen: isFrozen(r),
  changes: { summary: r.changes?.summary ?? '', present: r.changes?.present ?? [], missing: r.changes?.missing ?? [] }, sourceRefs: r.source_refs ?? [], proposedBy: r.proposed_by, createdAt: iso(r.created_at) });
const toDecision = (r: DecisionRow): DecisionView => ({ id: r.id, result: r.result, revisionId: r.document_revision_id, revisionNo: r.revision_no, revisionHash: r.revision_hash,
  scopeNote: r.scope_note, exceptions: r.exceptions, decidedBy: r.decided_by, decidedAt: iso(r.decided_at) });

/** The caller's authority in one project, read inside the transaction: approval types from document_approvers, the live delegation, the project role. */
type Authority = { approveTypes: string[]; delegation: { id: string; types: string[] } | null; role: string | null };
const covers = (a: Authority, docType: string) => a.approveTypes.includes(docType) || (a.delegation?.types.includes(docType) ?? false);

/** Read needs a project role of manager, engineer, technical or business. Bot, viewer and a project outside the session are refused with the not-found answer (S11). */
export function reader(p: Principal, projectId: string): boolean {
  return !!p && p.role !== 'bot' && !!p.projectIds?.includes(projectId) && READ_ROLES.has(projectRole(p, projectId));
}

export class ReviewService {
  constructor(private db: Database) {}

  /** One scoped transaction on a single project, with the acting person set for the database (decision, comment and event actor). */
  private run<T>(p: Principal, projectId: string, fn: (tx: Queryable) => Promise<T>): Promise<T> {
    return scoped(this.db, { ...p, projectIds: [projectId] }, async tx => {
      await tx.query("SELECT set_config('app.person_id',$1,true)", [p.id]);
      return fn(tx);
    });
  }
  /** Which project a document belongs to among the projects this person is scoped to. Missing, out of scope, viewer and bot look the same. */
  private async locate(p: Principal, documentId: string): Promise<{ id: string; projectId: string }> {
    const id = uuid.safeParse(documentId);
    if (!p || p.role === 'bot' || !p.projectIds?.length || !id.success) throw denied();
    const row = await scoped(this.db, p, async tx => (await tx.query<{ project_id: string }>('SELECT project_id FROM document_records WHERE id=$1', [id.data])).rows[0]);
    if (!row?.project_id || !reader(p, row.project_id)) throw denied();
    return { id: id.data, projectId: row.project_id };
  }
  private async authority(tx: Queryable, projectId: string, personId: string): Promise<Authority> {
    const approvers = (await tx.query<{ doc_types: string[] }>('SELECT doc_types FROM public.document_approvers($1::uuid) WHERE user_id=$2::uuid', [projectId, personId])).rows[0];
    const role = (await tx.query<{ project_role: string }>('SELECT project_role FROM public.bom_eligible_members($1::uuid, ARRAY[$2::uuid])', [projectId, personId])).rows[0]?.project_role ?? null;
    // a plain read, no lock (S38): the document row is locked already and the decision guard re-checks the delegation at insert time.
    // The delegate must still be an active member with a reading role, as the guard demands.
    const delegation = role !== null && READ_ROLES.has(role)
      ? (await tx.query<{ id: string; doc_types: string[] }>('SELECT id,doc_types FROM review_delegations WHERE project_id=$1::uuid AND delegate_id=$2::uuid AND revoked_at IS NULL', [projectId, personId])).rows[0] ?? null
      : null;
    return { approveTypes: approvers?.doc_types ?? [], delegation: delegation ? { id: delegation.id, types: delegation.doc_types } : null, role };
  }

  /** Items for the given records, each at its latest revision: decisions, approvers and the viewer's authority are read once for the whole page. */
  private async items(tx: Queryable, p: Principal, projectId: string, recs: RecordRow[]): Promise<ReviewItem[]> {
    if (!recs.length) return [];
    const revisionIds = recs.map(r => r.latest_revision_id);
    const revisions = new Map((await tx.query<RevisionRow>(`SELECT ${REVISION_COLS} FROM document_revisions v WHERE v.id = ANY($1::uuid[])`, [revisionIds])).rows.map(r => [r.id, r]));
    const decisions = new Map((await tx.query<DecisionRow>(
      'SELECT id,document_revision_id,revision_no,revision_hash,result,scope_note,exceptions,decided_by,decided_at FROM review_decisions WHERE document_revision_id = ANY($1::uuid[])', [revisionIds])).rows.map(r => [r.document_revision_id, r]));
    const approvers = (await tx.query<{ user_id: string; doc_types: string[] }>('SELECT user_id,doc_types FROM public.document_approvers($1::uuid)', [projectId])).rows;
    const me = await this.authority(tx, projectId, p.id);
    const out: ReviewItem[] = [];
    for (const rec of recs) {
      const rev = revisions.get(rec.latest_revision_id!);
      if (!rev) continue;
      const revision = toRevision(rev);
      const decision = decisions.get(rev.id);
      out.push({ documentId: rec.id, projectId: rec.project_id, refCode: rec.ref_code, title: rec.title, docType: rec.doc_type, recordVersion: rec.version, approvedRevisionId: rec.approved_revision_id, revision,
        approverState: approvers.some(a => a.user_id !== rev.proposed_by && a.doc_types.includes(rec.doc_type)) ? 'assigned' : 'unassigned',
        eligibility: eligibility({ actorId: p.id.toLowerCase(), proposedBy: rev.proposed_by, docType: rec.doc_type, frozen: revision.frozen, decided: !!decision,
          reviewTypes: me.delegation?.types ?? null, approveTypes: me.approveTypes }),
        decision: decision ? toDecision(decision) : null });
    }
    return out;
  }

  private async load(tx: Queryable, p: Principal, projectId: string, documentId: string): Promise<ReviewDetail> {
    const rec = (await tx.query<RecordRow>(`SELECT ${RECORD_COLS} FROM document_records d WHERE d.id=$1 AND d.project_id=$2`, [documentId, projectId])).rows[0];
    if (!rec) throw denied();
    if (!rec.latest_revision_id) throw new AppError('NO_REVISION', 'Tài liệu chưa có bản nào để xét.', 409);
    const [item] = await this.items(tx, p, projectId, [rec]);
    // the baseline when there is one, else the revision this one was proposed on top of
    const baseId = rec.approved_revision_id ?? item.revision.basedOnRevisionId;
    const baseRow = baseId ? (await tx.query<RevisionRow>(`SELECT ${REVISION_COLS} FROM document_revisions v WHERE v.id=$1 AND v.document_id=$2`, [baseId, documentId])).rows[0] : undefined;
    const base = baseRow ? toRevision(baseRow) : null;
    const comments = (await tx.query<{ id: string; parent_id: string | null; kind: CommentView['kind']; anchor: string; body: string; actor_id: string; document_revision_id: string; created_at: unknown }>(
      'SELECT id,parent_id,kind,anchor,body,actor_id,document_revision_id,created_at FROM review_comments WHERE document_id=$1 ORDER BY created_at,id LIMIT 1000', [documentId])).rows
      .map(c => ({ id: c.id, parentId: c.parent_id, kind: c.kind, anchor: c.anchor, body: c.body, actorId: c.actor_id, revisionId: c.document_revision_id, createdAt: iso(c.created_at) }));
    return { item, base, diff: revisionDiff(base, item.revision), comments };
  }

  async queue(p: Principal, raw: unknown): Promise<{ items: ReviewItem[]; total: number }> {
    if (!p || p.role === 'bot') throw denied();
    const q = queueSchema.parse(raw);
    if (!reader(p, q.projectId)) throw denied();
    return this.run(p, q.projectId, async tx => {
      const total = (await tx.query<{ n: number }>('SELECT count(*)::int AS n FROM document_records WHERE project_id=$1 AND latest_revision_id IS NOT NULL', [q.projectId])).rows[0].n;
      const recs = (await tx.query<RecordRow>(`SELECT ${RECORD_COLS} FROM document_records d WHERE d.project_id=$1 AND d.latest_revision_id IS NOT NULL ORDER BY d.updated_at DESC, d.id LIMIT $2 OFFSET $3`,
        [q.projectId, q.limit, q.offset])).rows;
      return { items: await this.items(tx, p, q.projectId, recs), total };
    });
  }

  async detail(p: Principal, documentId: string): Promise<ReviewDetail> {
    const { id, projectId } = await this.locate(p, documentId);
    return this.run(p, projectId, tx => this.load(tx, p, projectId, id));
  }

  /** The document row is locked first in every write, so two deciders, a decision and a new proposal, or two comments serialise on it. */
  private async lockRecord(tx: Queryable, documentId: string, projectId: string): Promise<RecordRow> {
    const rec = (await tx.query<RecordRow>(`SELECT ${RECORD_COLS} FROM document_records d WHERE d.id=$1 AND d.project_id=$2 FOR UPDATE`, [documentId, projectId])).rows[0];
    if (!rec) throw denied();
    return rec;
  }
  private async revisionOf(tx: Queryable, documentId: string, revisionId: string): Promise<RevisionRow | undefined> {
    return (await tx.query<RevisionRow>(`SELECT ${REVISION_COLS} FROM document_revisions v WHERE v.id=$1 AND v.document_id=$2`, [revisionId, documentId])).rows[0];
  }
  private async hasDecision(tx: Queryable, revisionId: string): Promise<boolean> {
    return (await tx.query('SELECT 1 FROM review_decisions WHERE document_revision_id=$1 LIMIT 1', [revisionId])).rows.length > 0;
  }

  /** requestId comes from the caller (the HTTP request id), never from JSON. */
  async comment(p: Principal, documentId: string, raw: unknown, key: string, requestId: string): Promise<ReviewDetail> {
    uuid.parse(requestId);
    const { id, projectId } = await this.locate(p, documentId);
    const input = commentSchema.parse(raw);
    const me = p.id.toLowerCase();
    return this.run(p, projectId, async tx => {
      const rec = await this.lockRecord(tx, id, projectId);
      await claimDocumentCommand(tx, p, projectId, key, { op: 'document.review.comment', documentId: id, ...input }, async () => {
        const auth = await this.authority(tx, projectId, me);
        let revisionId: string, parentId: string | null = null, anchor = '';
        if (input.kind === 'comment') {
          const rev = await this.revisionOf(tx, id, input.revisionId);
          if (!rev) throw stale();
          if (rev.proposed_by === me || !covers(auth, rec.doc_type)) throw notAuthorized();
          if (await this.hasDecision(tx, rev.id)) throw alreadyDecided();
          if (rec.latest_revision_id !== rev.id) throw stale();
          revisionId = rev.id; anchor = input.anchor;
        } else {
          // a reply answers a comment row of this document; a reply row, another document's row or an unknown id all look the same
          const parent = (await tx.query<{ id: string; document_revision_id: string; actor_id: string; proposed_by: string }>(
            `SELECT c.id,c.document_revision_id,c.actor_id,v.proposed_by FROM review_comments c JOIN document_revisions v ON v.id=c.document_revision_id
             WHERE c.id=$1 AND c.document_id=$2 AND c.kind='comment'`, [input.parentId, id])).rows[0];
          if (!parent) throw denied();
          const allowed = input.kind === 'addressed'
            ? parent.proposed_by === me || auth.role === 'manager'
            : parent.actor_id === me || (parent.proposed_by !== me && covers(auth, rec.doc_type));
          if (!allowed) throw notAuthorized();
          revisionId = parent.document_revision_id; parentId = parent.id;
        }
        const traceId = randomUUID();
        const row = (await tx.query<{ id: string }>(`INSERT INTO review_comments(tenant_id,project_id,document_id,document_revision_id,parent_id,kind,anchor,body,actor_id,request_id,trace_id)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`, [p.tenantId, projectId, id, revisionId, parentId, input.kind, anchor, input.body, p.id, requestId, traceId])).rows[0];
        await tx.query(`INSERT INTO review_events(tenant_id,project_id,entity_type,entity_id,actor_id,kind,request_id,trace_id,payload) VALUES($1,$2,'review_comment',$3,$4,$5,$6,$7,$8)`,
          [p.tenantId, projectId, row.id, p.id, 'review.' + input.kind, requestId, traceId, JSON.stringify({ commentId: row.id, revisionId, parentId })]);
        return { commentId: row.id };
      });
      return this.load(tx, p, projectId, id);
    });
  }

  /** Check order is fixed (brief): revision of the document, authority, already decided, freshness, frozen for an approval, then the insert and the pointer. */
  async decide(p: Principal, documentId: string, raw: unknown, key: string, requestId: string): Promise<ReviewDetail> {
    uuid.parse(requestId);
    const { id, projectId } = await this.locate(p, documentId);
    const input = decideSchema.parse(raw);
    const me = p.id.toLowerCase();
    return this.run(p, projectId, async tx => {
      const rec = await this.lockRecord(tx, id, projectId);
      // the stored idempotent response holds the id only; the detail is always read again
      await claimDocumentCommand(tx, p, projectId, key, { op: 'document.review.decide', documentId: id, ...input }, async () => {
        const rev = await this.revisionOf(tx, id, input.revisionId);                                                   // (1)
        if (!rev) throw stale();
        const auth = await this.authority(tx, projectId, me);                                                           // (2)
        if (rev.proposed_by === me) throw notAuthorized();
        let authority: 'approval_grant' | 'review_delegation';
        let delegationId: string | null = null;
        if (auth.approveTypes.includes(rec.doc_type)) authority = 'approval_grant';
        else if (input.result === 'changes_requested' && auth.delegation?.types.includes(rec.doc_type)) { authority = 'review_delegation'; delegationId = auth.delegation.id; }
        else throw notAuthorized();
        if (await this.hasDecision(tx, rev.id)) throw alreadyDecided();                                                 // (3) only to give the right code; UNIQUE decides at (6)
        if (rec.version !== input.expectedVersion || rec.latest_revision_id !== rev.id || rev.source_hash !== input.sourceHash) throw stale(); // (4)
        if (input.result === 'approved' && !isFrozen(rev)) throw new AppError('SOURCE_NOT_FROZEN', 'Bản này chưa được đóng băng nên chưa chấp thuận được.', 409); // (5)
        const traceId = randomUUID();
        let decisionId: string | undefined;
        try {                                                                                                           // (6)
          decisionId = (await tx.query<{ id: string }>(`INSERT INTO review_decisions(tenant_id,project_id,document_id,document_revision_id,revision_no,revision_hash,record_version,result,scope_note,
            exceptions,authority,delegation_id,decided_by,command_key,request_id,trace_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
            ON CONFLICT(document_revision_id) DO NOTHING RETURNING id`,
            [p.tenantId, projectId, id, rev.id, rev.revision_no, rev.source_hash, rec.version, input.result, input.scopeNote, JSON.stringify(input.exceptions), authority, delegationId,
              p.id, key, requestId, traceId])).rows[0]?.id;
        } catch (e) {
          // authority revoked or reduced between the read above and this insert: the guard refuses with LTR01; any other database error stays as it is
          if ((e as { code?: string })?.code === 'LTR01') throw notAuthorized();
          throw e;
        }
        if (!decisionId) throw alreadyDecided();
        let versionAfter = rec.version;
        if (input.result === 'approved') {                                                                              // (7) one statement; latest_revision_id is not touched
          const moved = await tx.query<{ version: number }>('UPDATE document_records SET approved_revision_id=$1, version=version+1, updated_at=now() WHERE id=$2 AND version=$3 RETURNING version',
            [rev.id, id, rec.version]);
          if (!moved.rows.length) throw stale();
          versionAfter = moved.rows[0].version;
        }
        await tx.query(`INSERT INTO review_events(tenant_id,project_id,entity_type,entity_id,actor_id,kind,request_id,trace_id,payload) VALUES($1,$2,'review_decision',$3,$4,$5,$6,$7,$8)`, // (8)
          [p.tenantId, projectId, decisionId, p.id, 'review.' + input.result, requestId, traceId,
            JSON.stringify({ decisionId, revisionId: rev.id, result: input.result, versionBefore: rec.version, versionAfter })]);
        return { decisionId };
      });
      return this.load(tx, p, projectId, id);
    });
  }
}
