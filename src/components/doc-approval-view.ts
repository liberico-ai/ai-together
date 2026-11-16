import type { DocApprovalProposal } from '../server/doc-approval-proposals';
import type { ApproverView } from '../server/review-delegations';
import type { ProposalsInitial } from '../server/review-page';
import type { DocType } from '../server/types';
import { ApiError } from './api';
import { DOC_TYPES, GENERIC_COPY, NETWORK_COPY, checkBasis, describeError, sameId } from './review-view';

// Pure helpers of the block «Trình phiếu cấp quyền duyệt bản chuẩn» on the Review screen (Task 7c, step 16b): its state, what a person typed,
// the exact request bodies and the sentence of each refusal. Nothing here decides a permission: the block follows what the service returned,
// and every refusal comes back from the service (DocApprovalProposalService). Only the account admin applies a ballot, on /team.

export const PROPOSAL_PANEL_TITLE = 'Trình phiếu cấp quyền duyệt bản chuẩn';
export const PROPOSALS_LOADING_LABEL = 'Đang tải phiếu đã trình';
export const PROPOSALS_ADMIN_COPY = 'Quản trị tài khoản trình phiếu cấp quyền duyệt bản chuẩn ở trang Quản trị tài khoản.';
export const PROPOSALS_LOAD_ERROR_COPY = 'Không tải được phiếu anh/chị đã trình. Dữ liệu đã lưu không bị thay đổi.';
export const PROPOSALS_DENIED_COPY = 'Chỉ điều phối của dự án này trình được phiếu cấp quyền duyệt bản chuẩn.';
export const PROPOSALS_FORMER_COPY = 'Anh/chị không còn là điều phối của dự án này nên không trình được phiếu mới. Phiếu đã trình còn chờ thì vẫn rút được ở đây.';
export const PROPOSALS_EMPTY_COPY = 'Anh/chị chưa có phiếu nào đang mở.';
export const PROPOSALS_COORDINATOR_COPY = 'Phiếu cần một thành viên BoM đồng ý. Quyền chỉ có hiệu lực sau khi quản trị tài khoản áp.';
// decision OQ-48 (b); «kể từ lúc phiếu đóng» is the second decision of 16/11/2026; the last sentence is the cap of T7C-19 item 8
export const PROPOSALS_WAIT_COPY = 'Phiếu tự rút thì anh/chị trình lại được ngay. Phiếu bị quản trị tài khoản huỷ, bị từ chối hoặc hết hạn thì phải qua 24 giờ kể từ lúc phiếu đóng mới trình lại được cho cùng người; cần sớm hơn thì nhờ quản trị tài khoản trình. Phiếu hết dùng được vì tài khoản của người được cấp vừa đổi thì có thể phải chờ tới 24 giờ sau hạn của phiếu.';
export const PROPOSALS_APPROVED_NOTE = 'Phiếu đã đủ xác nhận nên không rút được ở đây; muốn dừng thì nhờ quản trị tài khoản huỷ.';
export const PROPOSALS_CO_MANAGER_COPY = 'Người này cũng là điều phối của dự án. Phiếu sẽ nêu rõ điều đó cho người bỏ phiếu.';
export const PROPOSED_NOTICE = 'Đã trình phiếu. Quyền chưa đổi cho tới khi một thành viên BoM đồng ý và quản trị tài khoản áp.';
export const WITHDRAWN_NOTICE = 'Đã rút phiếu. Quyền của người này không đổi.';

export type ProposalPanelState = 'loading' | 'admin' | 'error' | 'denied' | 'former' | 'empty' | 'ready';
/** Precedence: loading > admin > error > denied > former > empty > ready. `denied` when the service refused the list, or when the viewer may not
 *  propose and has no ballot; `former` when the viewer may not propose but still has own ballots (lost the manager role, decision OQ-50 c). */
export function proposalPanelState(i: { loading: boolean; admin: boolean; failed: boolean; denied: boolean; canPropose: boolean; count: number }): ProposalPanelState {
  if (i.loading) return 'loading';
  if (i.admin) return 'admin';
  if (i.failed) return 'error';
  if (i.denied) return 'denied';
  if (!i.canPropose) return i.count === 0 ? 'denied' : 'former';
  return i.count === 0 ? 'empty' : 'ready';
}

/** Whether the viewer may propose. A list the page read carries the service's answer; a list the page could not read (`error`, `denied`)
 *  carries none, so the block falls back on `canDesignate` of the reviewers panel, the same value the page passed to the service. Without
 *  this, a coordinator whose first read failed would see «denied» or «former» after a successful «Thử lại». */
export function canProposeFrom(initial: ProposalsInitial | undefined, canDesignate: boolean): boolean {
  return initial?.state === 'ready' ? initial.canPropose : canDesignate;
}

export type ProposalDraft = { userId: string; docTypes: DocType[]; basis: string; withdrawId: string | null; withdrawBasis: string };
export const EMPTY_PROPOSAL_DRAFT: ProposalDraft = { userId: '', docTypes: [], basis: '', withdrawId: null, withdrawBasis: '' };

/** The draft after a command answered. `false` keeps it whole. Any other answer clears the command's own fields (`cleared`), but only while
 *  every one of them still holds what was sent, so a proposal typed while the command was in flight is not wiped (code review, fix round 1). */
export function settledDraft(current: ProposalDraft, sent: ProposalDraft, cleared: Partial<ProposalDraft>, answer: boolean | void): ProposalDraft {
  if (answer === false) return current;
  const untouched = (Object.keys(cleared) as (keyof ProposalDraft)[]).every(k => JSON.stringify(current[k]) === JSON.stringify(sent[k]));
  return untouched ? { ...current, ...cleared } : current;
}

export type ProposalReload = { own: { kind: 'ok'; items: DocApprovalProposal[] } | { kind: 'denied' } | { kind: 'failed' }; delegationsError: string };
/** «Tải lại» and «Thử lại» of the block. With `withDelegations` — the «Tải lại» beside a reloadable refusal, such as VERSION_CONFLICT «Tải lại
 *  trước khi trình» — the reviewers panel's lists are read again first, so the held types and the `expectedTypes` the form sends are fresh; then
 *  the own list. Never throws: a scope refusal of the list is `denied`, any other failure `failed`; a failed reread of the approvers comes back as
 *  the sentence of `describeError`, so the block can say it and offer «Tải lại» again. */
export async function reloadProposals(io: { readOwn: () => Promise<DocApprovalProposal[]>; readDelegations: () => Promise<void> }, withDelegations: boolean): Promise<ProposalReload> {
  let delegationsError = '';
  if (withDelegations) { try { await io.readDelegations(); } catch (e) { delegationsError = describeError(e).text; } }
  try { return { own: { kind: 'ok', items: await io.readOwn() }, delegationsError }; }
  catch (e) { return { own: e instanceof ApiError && e.code === 'SCOPE_DENIED' ? { kind: 'denied' } : { kind: 'failed' }, delegationsError }; }
}

/** The types the person already approves, read from the `approvers` of the reviewers panel; ids compare ignoring case; in the order of DOC_TYPES. */
export function heldTypes(approvers: ApproverView[], userId: string): DocType[] {
  const held = approvers.filter(a => sameId(a.userId, userId)).flatMap(a => a.docTypes);
  return DOC_TYPES.filter(t => held.includes(t));
}

type Checked<T> = { ok: true; cmd: T } | { ok: false; error: string };
// The class the service refuses in a basis (T7C-20): controls, hidden format marks (bidi, joiners), line and paragraph separators.
const FORBIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const FORBIDDEN_COPY = 'Căn cứ không được chứa ký tự điều khiển hoặc ký tự định dạng ẩn.';
const proposalBasis = (raw: string) => checkBasis(raw, { max: 300, forbidden: FORBIDDEN, forbiddenCopy: FORBIDDEN_COPY, lengthCopy: 'Căn cứ cần từ 5 đến 300 ký tự.' });
const withdrawalBasis = (raw: string) => checkBasis(raw, { max: 500, forbidden: FORBIDDEN, forbiddenCopy: FORBIDDEN_COPY, lengthCopy: 'Căn cứ cần từ 5 đến 500 ký tự.' });

/** `docTypes` is what was ticked minus what is held, in the order of DOC_TYPES; `expectedTypes` is exactly what the box shows as held; `reason` is
 *  the basis without the spaces at both ends. Told before sending; the service decides in the end. */
export function proposeCommand(d: ProposalDraft, held: DocType[]): Checked<{ userId: string; docTypes: DocType[]; expectedTypes: DocType[]; reason: string }> {
  if (!d.userId) return { ok: false, error: 'Chọn một thành viên.' };
  const docTypes = DOC_TYPES.filter(t => d.docTypes.includes(t) && !held.includes(t));
  if (docTypes.length === 0) return { ok: false, error: 'Chọn thêm ít nhất một loại tài liệu.' };
  const b = proposalBasis(d.basis);
  if (!b.ok) return b;
  return { ok: true, cmd: { userId: d.userId, docTypes, expectedTypes: DOC_TYPES.filter(t => held.includes(t)), reason: b.cmd } };
}
/** Only a `pending` row; an `approved` row is refused here (decision OQ-51 b), and the service refuses it too. */
export function withdrawCommand(row: Pick<DocApprovalProposal, 'approvalId' | 'state'>, basis: string): Checked<{ approvalId: string; reason: string }> {
  if (row.state !== 'pending') return { ok: false, error: 'Phiếu đã đủ xác nhận, không rút được ở đây.' };
  const b = withdrawalBasis(basis);
  if (!b.ok) return b;
  return { ok: true, cmd: { approvalId: row.approvalId, reason: b.cmd } };
}

// ---- request bodies: only the fields the strict service schema takes; never the person acting, the tenant, a grant, a role or a state ----
export const proposeBody = (projectId: string, c: { userId: string; docTypes: DocType[]; expectedTypes: DocType[]; reason: string }) =>
  ({ projectId, userId: c.userId, docTypes: c.docTypes, expectedTypes: c.expectedTypes, reason: c.reason });
/** The ballot id goes in the path only (T7C-31). */
export const withdrawBody = (c: { reason: string }) => ({ reason: c.reason });

export const proposalStateLabel = (s: 'pending' | 'approved'): string => (s === 'pending' ? 'Đang chờ một thành viên BoM' : 'Đã đủ phiếu, chờ quản trị tài khoản áp');

// Codes with one fixed sentence here, and whether the list beside it may be stale. Every other code shows the server's sentence as api() built it,
// with its « [CODE]» suffix (T7C-35): DOC_APPROVAL_PROPOSAL_INVALID and RATE_LIMITED each carry more than one sentence.
const FIXED = new Map<string, { message: string; reloadable: boolean }>([
  ['APPROVAL_PENDING', { message: 'Người này đang có một phiếu đổi quyền chưa xong.', reloadable: false }],
  ['MANAGER_REQUIRED', { message: 'Chỉ điều phối của dự án này trình được phiếu.', reloadable: true }],
  ['SCOPE_DENIED', { message: 'Không tìm thấy mục trong phạm vi được cấp.', reloadable: true }],
  ['APPROVAL_CLOSED', { message: 'Phiếu đã kết thúc hoặc hết hạn.', reloadable: true }],
  ['BALLOT_ALREADY_APPROVED', { message: 'Phiếu đã đủ xác nhận, không còn rút được ở đây. Nhờ quản trị tài khoản huỷ nếu cần.', reloadable: true }],
]);
/** After a command of the block failed: a sentence, never an object; whether a reload belongs with it; the typed draft is always kept. */
export function proposalFailure(e: unknown): { message: string; reloadable: boolean; keepDraft: true } {
  if (e instanceof ApiError) {
    const fixed = FIXED.get(e.code);
    if (fixed) return { ...fixed, keepDraft: true };
    return { message: e.message || GENERIC_COPY, reloadable: e.code === 'VERSION_CONFLICT', keepDraft: true };
  }
  if (e instanceof TypeError) return { message: NETWORK_COPY, reloadable: false, keepDraft: true };
  return { message: GENERIC_COPY, reloadable: false, keepDraft: true };
}
