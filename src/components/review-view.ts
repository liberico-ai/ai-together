import type { EligibilityReason, DiffEntry, DecisionView, ReviewItem, ReviewRevision, Eligibility } from '../server/document-review';
import type { ListedDelegation } from '../server/review-delegations';
import type { DocType } from '../server/types';
import { ApiError } from './api';
import { TYPE_NAMES } from './documents-view';

// Pure helpers of the Review screens: wording, validation of what a person typed, the exact request bodies, and the Idempotency-Key discipline.
// Nothing here decides a permission: buttons follow the service's `eligibility` and `canDesignate`, and every denial comes back from the service.

export type ReviewPageState = 'loading' | 'error' | 'denied' | 'empty' | 'ready';
export function reviewPageState(i: { loading: boolean; error: string | null; denied: boolean; rows: number }): ReviewPageState {
  if (i.loading) return 'loading';
  if (i.denied) return 'denied';
  if (i.error) return 'error';
  return i.rows === 0 ? 'empty' : 'ready';
}

export const EMPTY_COPY = 'Dự án này chưa có tài liệu nào có bản để review.';
export const DENIED_COPY = 'Anh/chị chưa có quyền xem phần review của dự án này.';
export const ERROR_COPY = 'Không tải được danh sách review. Dữ liệu đã lưu không bị thay đổi.';
export const NOT_FOUND_COPY = 'Không tìm thấy tài liệu trong phạm vi được cấp.';
export const CONFLICT_COPY = 'Nguồn đã đổi trong lúc anh/chị đang xem. Phiếu chưa được ghi.';
export const DECIDED_COPY = 'Bản này đã có quyết định. Muốn quyết lại cần một bản mới.';
export const NETWORK_COPY = 'Không kết nối được máy chủ. Nội dung đang nhập vẫn được giữ.';
export const GENERIC_COPY = 'Không xử lý được yêu cầu. Nội dung đang nhập vẫn được giữ.';
export const NOT_COORDINATOR_COPY = 'Chỉ điều phối của dự án này chỉ định và thu hồi được người nhận xét.';
export const APPROVAL_NOTE_COPY = 'Quyền duyệt bản chuẩn không chỉ định ở đây: quyền này cấp qua phiếu đổi quyền, cần một thành viên BoM đồng ý, ở trang Quản trị tài khoản.';
export const REVOKED_NOTICE = 'Đã thu hồi. Người này không còn nhận xét được từ lệnh kế tiếp; nhận xét và quyết định đã ghi vẫn giữ nguyên.';

const ELIGIBILITY_COPY: Record<EligibilityReason, string> = {
  AUTHOR: 'Anh/chị là tác giả của bản này nên không tự duyệt.',
  NO_DELEGATION: 'Anh/chị chưa được chỉ định review tài liệu của dự án này.',
  REVIEW_ONLY: 'Anh/chị được chỉ định nhận xét, chưa được chỉ định duyệt bản chuẩn.',
  TYPE_NOT_COVERED: 'Uỷ quyền của anh/chị không gồm loại tài liệu này.',
  NOT_FROZEN: 'Nguồn chưa đóng băng nên chưa duyệt thành bản chuẩn được. Anh/chị vẫn có thể nhận xét hoặc yêu cầu sửa.',
  ALREADY_DECIDED: DECIDED_COPY,
};
export const eligibilityCopy = (r: EligibilityReason | null): string => (r === null ? '' : ELIGIBILITY_COPY[r] ?? '');
export const diffLabel = (c: DiffEntry['change']): 'Thêm' | 'Xóa' | 'Sửa' => (c === 'added' ? 'Thêm' : c === 'removed' ? 'Xóa' : 'Sửa');
export const approverCopy = (s: 'unassigned' | 'assigned'): string => (s === 'unassigned' ? 'Chờ xác định người duyệt' : 'Đã có người duyệt');
export const decisionStateLabel = (d: DecisionView | null): string => (d === null ? 'Chưa có quyết định' : d.result === 'approved' ? 'Đã chấp thuận' : 'Yêu cầu sửa');
export const hashLabel = (v: ReviewRevision['hashVerification']): string => (v === 'verified' ? 'đã kiểm' : 'tự khai — chưa kiểm');
export const FIELD_NAMES: Record<DiffEntry['field'], string> = { summary: 'Tóm tắt', present: 'Đã có', missing: 'Còn thiếu', source_refs: 'Nguồn tham chiếu', source_revision: 'Bản nguồn', source_hash: 'Hash nguồn' };
export const fieldLabel = (f: string): string => (f in FIELD_NAMES ? FIELD_NAMES[f as DiffEntry['field']] : '');
export const docTypeLabel = (t: string): string => TYPE_NAMES[t] ?? 'Loại khác';
export const DOC_TYPES: DocType[] = ['project_index', 'change_brief', 'requirements', 'design', 'plan', 'verification', 'guide', 'other'];

/** Codes with a fixed sentence; any other code returns '' so the caller shows the server's own message. */
export function commandErrorCopy(code: string): string {
  switch (code) {
    case 'REVISION_CONFLICT': return CONFLICT_COPY;
    case 'REVIEW_ALREADY_DECIDED': return DECIDED_COPY;
    case 'SCOPE_DENIED': return NOT_FOUND_COPY;
    case 'DELEGATION_CONFLICT': return 'Uỷ quyền này đã thay đổi. Tải lại để xem trạng thái mới.';
    case 'DELEGATION_EXISTS': return 'Người này đã là người nhận xét của dự án.';
    case 'MANAGER_REQUIRED': return NOT_COORDINATOR_COPY;
    default: return '';
  }
}
/** What to show for any thrown value: a sentence, whether a reload button belongs with it, and the code. Never an object. */
export function describeError(e: unknown): { text: string; reloadable: boolean; code: string } {
  if (e instanceof ApiError) {
    const fixed = commandErrorCopy(e.code);
    return { text: fixed || (e.message || GENERIC_COPY), reloadable: e.code === 'SCOPE_DENIED' || e.code === 'DELEGATION_CONFLICT', code: e.code };
  }
  if (e instanceof TypeError) return { text: NETWORK_COPY, reloadable: false, code: 'NETWORK' };
  return { text: GENERIC_COPY, reloadable: false, code: '' };
}

// ---- idempotency and transport ----
type KeyStore = { current: { fingerprint: string; key: string } | null };
/** The same body again (a retry of the same action) keeps its key; a different body, or a store cleared after a success, gets a fresh one. */
export function idempotencyKey(store: KeyStore, body: unknown): string {
  const fingerprint = JSON.stringify(body);
  if (store.current?.fingerprint !== fingerprint) store.current = { fingerprint, key: crypto.randomUUID() };
  return store.current.key;
}
export async function postReview<T>(path: string, body: unknown, key: string, doFetch: typeof fetch = fetch): Promise<T> {
  const response = await doFetch(path, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) {
    const code = String(result.error?.code ?? response.status);
    throw new ApiError((result.error?.message ?? 'Không xử lý được yêu cầu.') + ' [' + code + ']', code, response.status);
  }
  return result.data as T;
}

// ---- request bodies: only the fields the service schema takes ----
export type DecisionCmd = { result: 'approved' | 'changes_requested'; scopeNote: string; exceptions: string[] };
export const decisionBody = (item: ReviewItem, c: DecisionCmd) => ({ revisionId: item.revision.id, sourceHash: item.revision.sourceHash, expectedVersion: item.recordVersion, result: c.result, scopeNote: c.scopeNote, exceptions: c.exceptions });
export const commentBody = (item: ReviewItem, c: { body: string; anchor: string }) => ({ kind: 'comment' as const, revisionId: item.revision.id, anchor: c.anchor, body: c.body });
export const replyBody = (kind: 'addressed' | 'resolved', parentId: string, body: string) => ({ kind, parentId, body });
export const grantBody = (projectId: string, c: { delegateId: string; docTypes: DocType[]; basis: string }) => ({ projectId, delegateId: c.delegateId, docTypes: c.docTypes, basis: c.basis });
export const revokeBody = (c: { expectedVersion: number; basis: string }) => ({ expectedVersion: c.expectedVersion, basis: c.basis });

// ---- what a person typed ----
type Checked<T> = { ok: true; cmd: T } | { ok: false; error: string };
export type DecisionDraft = { scopeNote: string; exceptions: string };
export type CommentDraft = { body: string; anchor: string };
export type PanelDraft = { delegateId: string; docTypes: DocType[]; basis: string; revokeId: string | null; revokeBasis: string };
export const EMPTY_PANEL_DRAFT: PanelDraft = { delegateId: '', docTypes: [], basis: '', revokeId: null, revokeBasis: '' };

const points = (s: string) => Array.from(s).length;
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/;
const trimSpaces = (s: string) => s.replace(/^ +| +$/g, '');
const BASIS_COPY = 'Căn cứ cần từ 5 đến 500 ký tự.';
/** Mirrors the service rule (5 to 500 characters after trimming spaces, no control characters) so a person is told before sending; the service decides in the end. */
function basisCheck(raw: string): Checked<string> {
  if (CONTROL.test(raw)) return { ok: false, error: 'Căn cứ không được chứa ký tự điều khiển.' };
  const b = trimSpaces(raw);
  return points(raw) > 500 || points(b) < 5 ? { ok: false, error: BASIS_COPY } : { ok: true, cmd: b };
}

export function decisionCommand(result: DecisionCmd['result'], d: DecisionDraft): Checked<DecisionCmd> {
  const note = d.scopeNote.trim();
  if (note.length < 5) return { ok: false, error: 'Ghi chú phạm vi cần ít nhất 5 ký tự.' };
  if (points(note) > 1000) return { ok: false, error: 'Ghi chú phạm vi tối đa 1000 ký tự.' };
  const exceptions = d.exceptions.split('\n').map(s => s.trim()).filter(Boolean);
  if (exceptions.length > 10) return { ok: false, error: 'Tối đa 10 ngoại lệ.' };
  if (exceptions.some(s => points(s) > 300)) return { ok: false, error: 'Mỗi ngoại lệ tối đa 300 ký tự.' };
  return { ok: true, cmd: { result, scopeNote: note, exceptions } };
}
export function commentCommand(d: CommentDraft): Checked<CommentDraft> {
  const body = d.body.trim();
  if (!body) return { ok: false, error: 'Nhập nội dung nhận xét.' };
  if (points(body) > 2000) return { ok: false, error: 'Nhận xét tối đa 2000 ký tự.' };
  return { ok: true, cmd: { body, anchor: d.anchor } };
}
export function replyCommand(kind: 'addressed' | 'resolved', parentId: string, text: string): Checked<ReturnType<typeof replyBody>> {
  const body = text.trim();
  if (!body) return { ok: false, error: 'Nhập ghi chú trước khi gửi.' };
  if (points(body) > 2000) return { ok: false, error: 'Ghi chú tối đa 2000 ký tự.' };
  return { ok: true, cmd: replyBody(kind, parentId, body) };
}
export function grantCommand(d: PanelDraft): Checked<{ delegateId: string; docTypes: DocType[]; basis: string }> {
  if (!d.delegateId) return { ok: false, error: 'Chọn một thành viên.' };
  if (d.docTypes.length === 0) return { ok: false, error: 'Chọn ít nhất một loại tài liệu.' };
  const b = basisCheck(d.basis);
  if (!b.ok) return b;
  return { ok: true, cmd: { delegateId: d.delegateId, docTypes: DOC_TYPES.filter(t => d.docTypes.includes(t)), basis: b.cmd } };
}
export function revokeCommand(row: Pick<ListedDelegation, 'id' | 'version'>, basis: string): Checked<{ delegationId: string; expectedVersion: number; basis: string }> {
  if (typeof row.version !== 'number') return { ok: false, error: NOT_COORDINATOR_COPY };
  const b = basisCheck(basis);
  if (!b.ok) return b;
  return { ok: true, cmd: { delegationId: row.id, expectedVersion: row.version, basis: b.cmd } };
}

/** People a coordinator may designate: members who read in this project, never the viewer, never a read-only member. Identifiers compare ignoring case. */
const READING = new Set(['manager', 'engineer', 'technical', 'business']);
export function selectableMembers<T extends { id: string; role: string }>(people: T[], viewerId: string): T[] {
  return people.filter(p => p.id.toLowerCase() !== viewerId.toLowerCase() && READING.has(p.role));
}
export const sameId = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
export type { Eligibility };
