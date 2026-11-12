import { z } from 'zod';
import { scoped, type Database, type Queryable } from './db';
import { AppError, invariant } from './errors';
import { deduplicate } from './service';
import { projectRole } from './types';
import type { DocumentDetail, DocumentRecord, DocumentRevision, Principal, RegistryEvent, SourceLink, SourceState, SourceType } from './types';

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

const line = z.string().max(200);
const sourceRef = z.object({ kind: z.enum(['git_sha', 'url', 'z2_source_ref']), label: z.string().min(1).max(80), value: z.string().min(1).max(1000) }).strict().superRefine((r, ctx) => {
  if (r.kind === 'git_sha' && !/^[a-f0-9]{40}$/.test(r.value)) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Mã commit gồm 40 ký tự thập lục phân thường.' });
  if (r.kind === 'url' && !httpsPointer.safeParse(r.value).success) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Dùng URL HTTPS không chứa thông tin đăng nhập.' });
});
const proposeSchema = z.object({
  expectedVersion: z.number().int().positive(),
  basedOnRevisionId: z.string().uuid().nullable(),
  sourceRevision: z.string().max(200).nullable(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  sourceModifiedAt: z.string().datetime().nullable(),
  changes: z.object({ summary: z.string().min(5).max(2000), present: z.array(line).max(30), missing: z.array(line).max(30) }).strict(),
  sourceRefs: z.array(sourceRef).max(20),
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
type RevisionRow = Omit<DocumentRevision, 'source_modified_at' | 'created_at'> & { source_modified_at: unknown; created_at: unknown };
const toRevision = (r: RevisionRow): DocumentRevision => ({
  id: r.id, document_id: r.document_id, revision_no: r.revision_no, based_on_revision_id: r.based_on_revision_id,
  source_revision: r.source_revision, source_hash: r.source_hash, hash_verification: 'self_declared',
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
  async proposeRevision(p: Principal, documentId: string, raw: unknown, key: string): Promise<DocumentDetail> {
    invariant(p?.role !== 'bot', 'READ_ONLY', 'Vai này không được ghi sổ tài liệu.', 403);
    invariant(z.string().uuid().safeParse(documentId).success, 'SCOPE_DENIED', NOT_FOUND, 404);
    const input = proposeSchema.parse(raw);
    return scoped(this.db, p, async tx => {
      const record = (await tx.query<RecordRow>('SELECT * FROM document_records WHERE id=$1 FOR UPDATE', [documentId])).rows[0];
      invariant(record, 'SCOPE_DENIED', NOT_FOUND, 404);
      const role = projectRole(p, record.project_id);
      invariant(role !== 'viewer' && role !== 'bot', 'READ_ONLY', 'Vai này không được ghi sổ tài liệu.', 403);
      return deduplicate(tx, p, record.project_id, key, { op: 'document.propose_revision', documentId, ...input }, async () => {
        invariant(record.version === input.expectedVersion && input.basedOnRevisionId === record.latest_revision_id,
          'REVISION_CONFLICT', 'Tài liệu đã đổi. Đọc bản mới trước khi gửi lại.', 409);
        const no = (await tx.query<{ n: number }>('SELECT coalesce(max(revision_no),0)+1 AS n FROM document_revisions WHERE document_id=$1', [documentId])).rows[0].n;
        const rev = (await tx.query<{ id: string }>(`INSERT INTO document_revisions(tenant_id,project_id,document_id,revision_no,based_on_revision_id,source_id,source_type,quality_score,
          source_revision,source_hash,hash_verification,source_modified_at,changes,source_refs,proposed_by)
          VALUES($1,$2,$3,$4,$5,$6,$7,0,$8,$9,'self_declared',$10,$11,$12,$13) RETURNING id`,
          [p.tenantId, record.project_id, documentId, no, input.basedOnRevisionId, record.canonical_uri, record.source_type, input.sourceRevision, input.sourceHash,
            input.sourceModifiedAt, JSON.stringify(input.changes), JSON.stringify(input.sourceRefs), p.id])).rows[0];
        await tx.query('UPDATE document_records SET latest_revision_id=$1, version=version+1, updated_at=now() WHERE id=$2', [rev.id, documentId]);
        await tx.query(`INSERT INTO registry_events(tenant_id,project_id,entity_type,entity_id,actor_id,kind,command_key,payload) VALUES($1,$2,'document_revision',$3,$4,'revision_proposed',$5,$6)`,
          [p.tenantId, record.project_id, rev.id, p.id, key, JSON.stringify({ revisionNo: no, basedOnRevisionId: input.basedOnRevisionId, expectedVersion: input.expectedVersion,
            sourceHash: input.sourceHash, hashVerification: 'self_declared' })]);
        return load(tx, documentId);
      });
    });
  }
  async detail(p: Principal, documentId: string): Promise<DocumentDetail> {
    invariant(p?.role !== 'bot', 'READ_ONLY', 'Vai này không được dùng sổ tài liệu.', 403);
    invariant(z.string().uuid().safeParse(documentId).success, 'SCOPE_DENIED', NOT_FOUND, 404);
    return scoped(this.db, p, tx => load(tx, documentId));
  }
  async openSource(p: Principal, documentId: string): Promise<{ uri: string; sourceType: SourceType; sourceState: SourceState; title: string }> {
    invariant(p?.role !== 'bot', 'READ_ONLY', 'Vai này không được dùng sổ tài liệu.', 403);
    invariant(z.string().uuid().safeParse(documentId).success, 'SCOPE_DENIED', NOT_FOUND, 404);
    return scoped(this.db, p, async tx => {
      const r = (await tx.query<{ canonical_uri: string; source_type: SourceType; source_state: SourceState; title: string }>(
        'SELECT canonical_uri,source_type,source_state,title FROM document_records WHERE id=$1', [documentId])).rows[0];
      if (!r) throw denied();
      invariant(r.source_state !== 'unavailable' && r.source_state !== 'denied', 'SOURCE_UNAVAILABLE', 'Nguồn hiện không mở được. Lịch sử trong sổ vẫn còn.', 409);
      return { uri: r.canonical_uri, sourceType: r.source_type, sourceState: r.source_state, title: r.title };
    });
  }
}
