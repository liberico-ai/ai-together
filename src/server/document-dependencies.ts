import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { scoped, type Database, type Queryable } from './db';
import { claimDocumentCommand } from './document-commands';
import { AppError } from './errors';
import { projectRole } from './types';
import type { Principal } from './types';

// Document dependencies (slice 3, Task 6): «document B depends on revision N of document A». When A gets a newer revision the link is flagged
// «needs review», inside the transaction that proposes the revision. Clearing the flag and notifying people are not part of this slice.
// Both documents of a link are in the caller's scope and in one project. Not found and out of scope give the same answer.
const NOT_FOUND = 'Không tìm thấy tài liệu trong phạm vi được cấp.';
const denied = () => new AppError('SCOPE_DENIED', NOT_FOUND, 404);
const READ_ROLES = new Set(['manager', 'engineer', 'technical', 'business']);

export type DependencyView = { id: string; upstreamDocumentId: string; upstreamRevisionId: string; dependentDocumentId: string; note: string; needsReview: boolean;
  flaggedRevisionId: string | null; flaggedAt: string | null; version: number };

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const storable = (s: string) => !s.includes('\u0000') && !LONE_SURROGATE.test(s);
const uuid = z.string().uuid().transform(s => s.toLowerCase());
const linkSchema = z.object({
  projectId: uuid, upstreamDocumentId: uuid, dependentDocumentId: uuid,
  note: z.string().max(500).refine(storable, 'Chữ chứa ký tự không lưu được.').default(''),
}).strict();
const listSchema = z.object({
  projectId: uuid, documentId: uuid.optional(), needsReview: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).default(50), offset: z.number().int().min(0).default(0),
}).strict();

type Row = { id: string; upstream_document_id: string; upstream_revision_id: string; dependent_document_id: string; note: string; needs_review: boolean;
  flagged_revision_id: string | null; flagged_at: unknown; version: number };
const COLS = 'id,upstream_document_id,upstream_revision_id,dependent_document_id,note,needs_review,flagged_revision_id,flagged_at,version';
const toView = (r: Row): DependencyView => ({ id: r.id, upstreamDocumentId: r.upstream_document_id, upstreamRevisionId: r.upstream_revision_id, dependentDocumentId: r.dependent_document_id,
  note: r.note, needsReview: r.needs_review, flaggedRevisionId: r.flagged_revision_id, flaggedAt: r.flagged_at == null ? null : new Date(r.flagged_at as string).toISOString(), version: r.version });

/**
 * Called inside the transaction of DocumentService.proposeRevision: every link whose upstream is this document is flagged at the new revision, one
 * review_events 'dependency.flagged' per link. Returns the number of links. The caller must already have put the acting person (p.id) in the
 * transaction-local `app.person_id` (the event's insert policy binds actor_id to it). The database stamps flagged_at and updated_at and checks
 * the version step and the direction of the flag.
 */
export async function flagDependents(tx: Queryable, p: Principal, i: { projectId: string; upstreamDocumentId: string; newRevisionId: string; requestId: string }): Promise<number> {
  const flagged = (await tx.query<{ id: string; version: number }>(
    `UPDATE document_dependencies SET needs_review=true, flagged_revision_id=$1, version=version+1
     WHERE tenant_id=$2 AND project_id=$3 AND upstream_document_id=$4 RETURNING id,version`,
    [i.newRevisionId, p.tenantId, i.projectId, i.upstreamDocumentId])).rows;
  for (const d of flagged.sort((a, b) => a.id < b.id ? -1 : 1)) {
    await tx.query(`INSERT INTO review_events(tenant_id,project_id,entity_type,entity_id,actor_id,kind,request_id,trace_id,payload) VALUES($1,$2,'document_dependency',$3,$4,'dependency.flagged',$5,$6,$7)`,
      [p.tenantId, i.projectId, d.id, p.id, i.requestId, randomUUID(),
        JSON.stringify({ dependencyId: d.id, upstreamDocumentId: i.upstreamDocumentId, flaggedRevisionId: i.newRevisionId, versionAfter: d.version })]);
  }
  return flagged.length;
}

export class DependencyService {
  constructor(private db: Database) {}

  /** One scoped transaction on a single project, with the acting person placed in the transaction for the database (confirmed_by and event actor). */
  private run<T>(p: Principal, projectId: string, fn: (tx: Queryable) => Promise<T>): Promise<T> {
    return scoped(this.db, { ...p, projectIds: [projectId] }, async tx => {
      await tx.query("SELECT set_config('app.person_id',$1,true)", [p.id]);
      return fn(tx);
    });
  }

  /** requestId comes from the caller (the HTTP request id), never from JSON. Only a manager of the project links. */
  async link(p: Principal, raw: unknown, key: string, requestId: string): Promise<DependencyView> {
    uuid.parse(requestId);
    const input = linkSchema.parse(raw);
    if (!p || p.role === 'bot' || !p.projectIds?.includes(input.projectId) || projectRole(p, input.projectId) !== 'manager') throw denied();
    const projectId = input.projectId;
    return this.run(p, projectId, async tx => {
      // a share lock on the upstream row: a proposal in flight (it takes FOR UPDATE) finishes first, so «latest» below is the revision the new link refers to
      const up = (await tx.query<{ id: string; latest_revision_id: string | null }>('SELECT id,latest_revision_id FROM document_records WHERE id=$1 AND project_id=$2 FOR SHARE', [input.upstreamDocumentId, projectId])).rows[0];
      const dep = (await tx.query<{ id: string }>('SELECT id FROM document_records WHERE id=$1 AND project_id=$2', [input.dependentDocumentId, projectId])).rows[0];
      if (!up || !dep) throw denied();
      const done = await claimDocumentCommand(tx, p, projectId, key, { op: 'document.dependency.link', ...input }, async () => {
        if (up.id === dep.id || !up.latest_revision_id) throw new AppError('DEPENDENCY_INVALID', 'Liên kết phụ thuộc không hợp lệ.', 422);
        const row = (await tx.query<{ id: string }>(`INSERT INTO document_dependencies(tenant_id,project_id,upstream_document_id,upstream_revision_id,dependent_document_id,note,confirmed_by)
          VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,project_id,upstream_document_id,dependent_document_id) DO NOTHING RETURNING id`,
          [p.tenantId, projectId, up.id, up.latest_revision_id, dep.id, input.note, p.id])).rows[0];
        if (!row) throw new AppError('DEPENDENCY_EXISTS', 'Liên kết phụ thuộc này đã có.', 409);
        await tx.query(`INSERT INTO review_events(tenant_id,project_id,entity_type,entity_id,actor_id,kind,request_id,trace_id,payload) VALUES($1,$2,'document_dependency',$3,$4,'dependency.linked',$5,$6,$7)`,
          [p.tenantId, projectId, row.id, p.id, requestId, randomUUID(),
            JSON.stringify({ dependencyId: row.id, upstreamDocumentId: up.id, upstreamRevisionId: up.latest_revision_id, dependentDocumentId: dep.id })]);
        return { id: row.id };
      });
      // the stored idempotent response holds the id only; the link is always read again
      const view = (await tx.query<Row>(`SELECT ${COLS} FROM document_dependencies WHERE id=$1 AND project_id=$2`, [done.id, projectId])).rows[0];
      if (!view) throw denied();
      return toView(view);
    });
  }

  async list(p: Principal, raw: unknown): Promise<{ items: DependencyView[]; total: number }> {
    const q = listSchema.parse(raw);
    if (!p || p.role === 'bot' || !p.projectIds?.includes(q.projectId) || !READ_ROLES.has(projectRole(p, q.projectId))) throw denied();
    return this.run(p, q.projectId, async tx => {
      const where = 'project_id=$1 AND ($2::uuid IS NULL OR upstream_document_id=$2::uuid OR dependent_document_id=$2::uuid) AND ($3::boolean IS NULL OR needs_review=$3::boolean)';
      const args = [q.projectId, q.documentId ?? null, q.needsReview ?? null];
      const total = (await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM document_dependencies WHERE ${where}`, args)).rows[0].n;
      const items = (await tx.query<Row>(`SELECT ${COLS} FROM document_dependencies WHERE ${where} ORDER BY created_at DESC, id LIMIT $4 OFFSET $5`, [...args, q.limit, q.offset])).rows.map(toView);
      return { items, total };
    });
  }
}
