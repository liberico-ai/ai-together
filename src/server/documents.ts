import { z } from 'zod';
import { scoped, type Database, type Queryable } from './db';
import { AppError, invariant } from './errors';
import { deduplicate } from './service';
import { projectRole } from './types';
import type { DocumentDetail, DocumentRecord, DocumentRevision, Principal, RegistryEvent, SourceLink } from './types';

const DOC_TYPES = ['project_index', 'change_brief', 'requirements', 'design', 'plan', 'verification', 'guide', 'other'] as const;
const NOT_FOUND = 'Không tìm thấy tài liệu trong phạm vi được cấp.';
const denied = () => new AppError('SCOPE_DENIED', NOT_FOUND, 404);

const httpsPointer = z.string().transform(v => v.trim()).pipe(z.string().max(1000)).refine(v => {
  try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}, 'Dùng URL HTTPS không chứa thông tin đăng nhập.').transform(v => new URL(v).href);
const note = z.string().max(500).optional();
const registerSchema = z.object({
  projectId: z.string().uuid(),
  refCode: z.union([z.literal(''), z.string().regex(/^[A-Z0-9][A-Z0-9-]{1,39}$/)]),
  docType: z.enum(DOC_TYPES),
  title: z.string().min(5).max(200),
  templateCode: z.enum(['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6']).optional(),
  sourceType: z.enum(['drive', 'git', 'vault']),
  canonicalUri: httpsPointer,
  ownerLabel: z.string().max(120),
  reviewDueAt: z.string().datetime().nullable(),
  metadata: z.object({ author: note, reviewer: note, authorityNote: note, audienceNote: note, readingLimits: note,
    missingFields: z.array(z.string().max(120)).max(20) }).strict(),
  sourceLinks: z.array(z.object({ kind: z.literal('z2_source_ref'), value: z.string().min(3).max(300) }).strict()).max(10),
}).strict();

const iso = (v: unknown) => v == null ? null : new Date(v as string).toISOString();
type RecordRow = Omit<DocumentRecord, 'created_at' | 'updated_at' | 'source_checked_at' | 'review_due_at'> & { created_at: unknown; updated_at: unknown; source_checked_at: unknown; review_due_at: unknown };
const toRecord = (r: RecordRow, present?: Set<string>): DocumentRecord => ({
  id: r.id, project_id: r.project_id, ref_code: r.ref_code, doc_type: r.doc_type, title: r.title, source_type: r.source_type, canonical_uri: r.canonical_uri,
  owner_label: r.owner_label, classification: 'unclassified', metadata: r.metadata,
  source_links: (r.source_links as SourceLink[]).map(l => ({ kind: l.kind, value: l.value, label: 'chưa đối soát', ...(present ? { present: present.has(l.value) } : {}) })),
  source_state: r.source_state, source_checked_at: iso(r.source_checked_at), review_due_at: iso(r.review_due_at), freeze_state: 'SOURCE_NOT_FROZEN',
  latest_revision_id: r.latest_revision_id, approved_revision_id: r.approved_revision_id, version: r.version, created_at: iso(r.created_at)!, updated_at: iso(r.updated_at)!,
});
type RevisionRow = Omit<DocumentRevision, 'ingested_at' | 'source_modified_at' | 'created_at'> & { ingested_at: unknown; source_modified_at: unknown; created_at: unknown };
const toRevision = (r: RevisionRow): DocumentRevision => ({
  id: r.id, document_id: r.document_id, revision_no: r.revision_no, based_on_revision_id: r.based_on_revision_id, source_id: r.source_id, source_type: r.source_type,
  ingested_at: iso(r.ingested_at)!, quality_score: String(r.quality_score), source_revision: r.source_revision, source_hash: r.source_hash, hash_verification: 'self_declared',
  source_modified_at: iso(r.source_modified_at), snapshot_ref: null, changes: r.changes, source_refs: r.source_refs, proposed_by: r.proposed_by, created_at: iso(r.created_at)!,
});

async function load(tx: Queryable, documentId: string): Promise<DocumentDetail> {
  const rec = (await tx.query<RecordRow>('SELECT * FROM document_records WHERE id=$1', [documentId])).rows[0];
  if (!rec) throw denied();
  const refs = new Set((await tx.query<{ source_ref: string }>('SELECT DISTINCT source_ref FROM analytics.tech_source_tasks WHERE project_id=$1', [rec.project_id])).rows.map(r => r.source_ref));
  const revisions = (await tx.query<RevisionRow>('SELECT * FROM document_revisions WHERE document_id=$1 ORDER BY revision_no', [documentId])).rows.map(toRevision);
  const events = (await tx.query<RegistryEvent & { created_at: unknown }>(`SELECT id,entity_type,entity_id,actor_id,kind,payload,created_at FROM registry_events
    WHERE entity_id=$1 OR (entity_type='document_revision' AND entity_id = ANY(SELECT id FROM document_revisions WHERE document_id=$1)) ORDER BY created_at, id`, [documentId]))
    .rows.map(e => ({ ...e, created_at: iso(e.created_at)! }));
  return { record: toRecord(rec, refs), revisions, events };
}

export class DocumentService {
  constructor(private db: Database) {}
  async register(p: Principal, raw: unknown, key: string): Promise<DocumentDetail> {
    invariant(p?.role !== 'bot', 'READ_ONLY', 'Vai này không được ghi sổ tài liệu.', 403);
    const projectId = (raw as { projectId?: unknown } | null)?.projectId;
    invariant(typeof projectId === 'string' && p.projectIds.includes(projectId), 'SCOPE_DENIED', NOT_FOUND, 404);
    const role = projectRole(p, projectId);
    invariant(role !== 'viewer' && role !== 'bot', 'READ_ONLY', 'Vai này không được ghi sổ tài liệu.', 403);
    const input = registerSchema.parse(raw);
    return scoped(this.db, { ...p, projectIds: [projectId] }, tx => deduplicate(tx, p, projectId, key, { op: 'document.register', ...input }, async () => {
      let templateId: string | null = null;
      if (input.templateCode) {
        templateId = (await tx.query<{ id: string }>('SELECT id FROM document_templates WHERE tenant_id=$1 AND code=$2 ORDER BY created_at DESC, id LIMIT 1', [p.tenantId, input.templateCode])).rows[0]?.id ?? null;
        invariant(templateId, 'TEMPLATE_UNKNOWN', 'Mẫu tài liệu không có trong chỉ mục.', 422);
      }
      const row = (await tx.query<RecordRow>(`INSERT INTO document_records(tenant_id,project_id,ref_code,doc_type,title,template_id,source_type,canonical_uri,owner_label,metadata,source_links,review_due_at,registered_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(tenant_id,project_id,canonical_uri) DO NOTHING RETURNING *`,
        [p.tenantId, projectId, input.refCode, input.docType, input.title, templateId, input.sourceType, input.canonicalUri, input.ownerLabel,
          JSON.stringify(input.metadata), JSON.stringify(input.sourceLinks.map(l => ({ ...l, label: 'chưa đối soát' }))), input.reviewDueAt, p.id])).rows[0];
      invariant(row, 'DOCUMENT_ALREADY_REGISTERED', 'Nguồn này đã có trong sổ của dự án.', 409);
      await tx.query(`INSERT INTO registry_events(tenant_id,project_id,entity_type,entity_id,actor_id,kind,command_key,payload) VALUES($1,$2,'document',$3,$4,'document_registered',$5,$6)`,
        [p.tenantId, projectId, row.id, p.id, key, JSON.stringify({ docType: input.docType, sourceType: input.sourceType, canonicalUri: input.canonicalUri, templateCode: input.templateCode ?? null, versionBefore: 0, versionAfter: 1 })]);
      return load(tx, row.id);
    }));
  }
  async detail(p: Principal, documentId: string): Promise<DocumentDetail> {
    invariant(p?.role !== 'bot', 'READ_ONLY', 'Vai này không được dùng sổ tài liệu.', 403);
    invariant(z.string().uuid().safeParse(documentId).success, 'SCOPE_DENIED', NOT_FOUND, 404);
    return scoped(this.db, p, tx => load(tx, documentId));
  }
}
