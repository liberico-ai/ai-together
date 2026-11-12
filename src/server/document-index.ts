import { z } from 'zod';
import { scoped, type Database } from './db';
import { AppError, invariant } from './errors';
import type { DocumentIndexRow, Principal } from './types';

/** DOC-10: list/search/export read ONLY analytics.document_index (Z2). Slice 1 requires projectId (controller ruling R1). */
const DOC_TYPES = ['project_index', 'change_brief', 'requirements', 'design', 'plan', 'verification', 'guide', 'other'] as const;
const NOT_FOUND = 'Không tìm thấy tài liệu trong phạm vi được cấp.';
const denied = () => new AppError('SCOPE_DENIED', NOT_FOUND, 404);
const EXPORT_MAX = 5000;

export type DocumentIndexPage = { rows: DocumentIndexRow[]; total: number; projectedAt: string | null; source: 'Z2' };

const findSchema = z.object({
  projectId: z.uuid(),
  q: z.string().min(1).max(100).optional(),
  docType: z.enum(DOC_TYPES).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
}).strict();

const iso = (v: unknown) => v == null ? null : new Date(v as string).toISOString();
const escapeLike = (q: string) => q.replace(/[\\%_]/g, c => '\\' + c);

function authorise(p: Principal, projectId: string): void {
  invariant(p?.role !== 'bot', 'READ_ONLY', 'Vai này không được dùng sổ tài liệu.', 403);
  if (!p?.projectIds?.includes(projectId)) throw denied();
}

type Filter = { projectId: string; q?: string; docType?: string };
async function query(db: Database, p: Principal, f: Filter, limit: number, offset: number): Promise<DocumentIndexPage> {
  const scope = [f.projectId];
  const params: unknown[] = [f.projectId];
  let where = 'project_id = $1';
  if (f.q !== undefined) {
    params.push(escapeLike(f.q));
    const n = params.length;
    where += ` AND (title ILIKE '%'||$${n}||'%' ESCAPE '\\' OR ref_code ILIKE '%'||$${n}||'%' ESCAPE '\\' OR doc_type ILIKE '%'||$${n}||'%' ESCAPE '\\')`;
  }
  if (f.docType !== undefined) { params.push(f.docType); where += ` AND doc_type = $${params.length}`; }
  const { rows, total, at } = await scoped(db, { ...p, projectIds: scope }, async tx => {
    const list = (await tx.query<Record<string, unknown>>(`SELECT document_id,project_id,ref_code,doc_type,title,owner_label,source_type,latest_revision_no,
        approved_revision_no,hash_verification,source_state,freeze_state,missing_count,review_due_at,record_updated_at,projected_at
      FROM analytics.document_index WHERE ${where} ORDER BY record_updated_at DESC, document_id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset])).rows;
    const agg = (await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM analytics.document_index WHERE ${where}`, params)).rows[0];
    const m = (await tx.query<{ at: unknown }>('SELECT min(projected_at) AS at FROM analytics.document_index WHERE project_id = $1', [f.projectId])).rows[0];
    return { rows: list, total: agg.n, at: m.at };
  });
  const out: DocumentIndexRow[] = rows.map(r => ({
    document_id: r.document_id as string, project_id: r.project_id as string, ref_code: r.ref_code as string, doc_type: r.doc_type as DocumentIndexRow['doc_type'],
    title: r.title as string, owner_label: r.owner_label as string, source_type: r.source_type as DocumentIndexRow['source_type'],
    latest_revision_no: r.latest_revision_no as number | null, approved_revision_no: r.approved_revision_no as number | null,
    hash_verification: r.hash_verification as DocumentIndexRow['hash_verification'], source_state: r.source_state as DocumentIndexRow['source_state'],
    freeze_state: 'SOURCE_NOT_FROZEN', missing_count: r.missing_count as number, review_due_at: iso(r.review_due_at),
    record_updated_at: iso(r.record_updated_at)!, projected_at: iso(r.projected_at)!,
  }));
  if (out.some(r => !scope.includes(r.project_id))) throw denied(); // never a partial result
  return { rows: out, total, projectedAt: iso(at), source: 'Z2' };
}

export async function findDocuments(db: Database, p: Principal, raw: unknown): Promise<DocumentIndexPage> {
  invariant(p?.role !== 'bot', 'READ_ONLY', 'Vai này không được dùng sổ tài liệu.', 403);
  const input = findSchema.parse(raw);
  authorise(p, input.projectId);
  return query(db, p, input, input.limit, input.offset);
}

const rev = (n: number | null) => n == null ? 'Chưa có' : `r${n}`;
const cell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? "'" + v : v).replace(/"/g, '""')}"`;
export const CSV_HEADER = 'ma,loai,tieu_de,chu_noi_dung,nguon,ban_dang_soan,ban_chuan,muc_hash,trang_thai_nguon,dong_bang,thoi_diem_chieu';

export async function exportDocumentsCsv(db: Database, p: Principal, projectId: string): Promise<string> {
  invariant(p?.role !== 'bot', 'READ_ONLY', 'Vai này không được dùng sổ tài liệu.', 403);
  if (!z.uuid().safeParse(projectId).success) throw denied();
  authorise(p, projectId);
  const page = await query(db, p, { projectId }, EXPORT_MAX + 1, 0);
  if (page.rows.length > EXPORT_MAX) throw new AppError('EXPORT_TOO_LARGE', 'Danh sách quá dài để xuất một lần. Lọc theo loại rồi xuất lại.', 422);
  const lines = page.rows.map(r => [r.ref_code, r.doc_type, r.title, r.owner_label, r.source_type, rev(r.latest_revision_no), rev(r.approved_revision_no),
    r.hash_verification === 'self_declared' ? 'tự khai' : r.hash_verification === 'verified' ? 'đã kiểm' : '', r.source_state, r.freeze_state, r.projected_at].map(cell).join(','));
  return [CSV_HEADER, ...lines].join('\n');
}
