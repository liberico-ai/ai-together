import type { ReassignmentCard, ReviewCard } from '../server/decisions';
import { ApiError } from './api';
import { NETWORK_COPY, GENERIC_COPY, reviewPageState, type ReviewPageState } from './review-view';

// Pure helpers of the Decisions screen: wording and the exact vote request body. Nothing here decides a permission or a state:
// every label is read from a field of the card the service built, and the service decides every vote at the command.

export type DecisionsPageState = ReviewPageState;
export const decisionsPageState = reviewPageState;

export const EMPTY_COPY = 'Dự án này chưa có thẻ quyết định nào.';
export const DENIED_COPY = 'Anh/chị chưa có quyền xem các quyết định của dự án này.';
export const ERROR_COPY = 'Không tải được danh sách quyết định. Dữ liệu đã lưu không bị thay đổi.';
export const CONFLICT_COPY = 'Bản này đã thay đổi. Mở bản mới để xem lại.';
export const ACCOUNTS_COPY = 'Phiếu duyệt tài khoản và phiếu đổi quyền, gồm cả quyền duyệt bản chuẩn, nằm ở trang Duyệt tài khoản.';
export const UNKNOWN_PERSON = 'Thành viên chưa rõ tên';
export const NOTE_COPY = 'Ghi chú cần từ 5 đến 2000 ký tự.';
export const CHOICE_COPY = 'Chọn Đồng ý, Từ chối hoặc Yêu cầu sửa.';

/** The «đủ phiếu» line of a 3/3 card. Reads only the state and the agree count; whether a receipt exists is a separate line. */
export function reassignmentLabel(s: ReassignmentCard['state'], have: number): string {
  switch (s) {
    case 'pending': return 'Chưa đủ phiếu (' + have + '/3)';
    case 'quorum_met': return 'Đủ phiếu, chưa áp dụng';
    case 'applied': return 'Đã áp dụng';
    case 'rejected': return 'Từ chối';
    case 'revise': return 'Yêu cầu sửa';
    case 'cancelled': return 'Đã hủy';
    case 'expired': return 'Hết hạn';
    case 'reconcile': return 'Cần đối soát';
    default: return 'Cần đối soát';
  }
}

/** The two lines of a review card: the decision, and whether it is applied as the baseline. The second follows `appliedReceipt` alone. */
export function reviewLabels(c: ReviewCard): { vote: string; baseline: string } {
  return {
    vote: c.state === 'approved' ? 'Đã chấp thuận' : c.state === 'changes_requested' ? 'Yêu cầu sửa' : 'Chưa có quyết định',
    baseline: c.appliedReceipt === null ? 'Chưa áp dụng làm bản chuẩn' : 'Đã áp dụng làm bản chuẩn',
  };
}

const BLOCK_COPY: Record<'ALREADY_VOTED' | 'CLOSED' | 'EXPIRED', string> = {
  ALREADY_VOTED: 'Anh/chị đã bỏ phiếu cho phiếu này.',
  CLOSED: 'Vòng xác nhận đã kết thúc.',
  EXPIRED: 'Phiếu đã hết hạn.',
};
export const voteBlockCopy = (r: ReassignmentCard['actorEligibility']['reason']): string => (r === null ? '' : BLOCK_COPY[r] ?? '');

export const VOTE_CHOICES = [['agree', 'Đồng ý'], ['reject', 'Từ chối'], ['revise', 'Yêu cầu sửa']] as const;
export type VoteChoice = (typeof VOTE_CHOICES)[number][0];
export const choiceLabel = (c: ReassignmentCard['votes'][number]['choice'] | ReviewCard['votes'][number]['choice']): string =>
  c === 'agree' ? 'Đồng ý' : c === 'reject' ? 'Từ chối' : c === 'revise' || c === 'changes_requested' ? 'Yêu cầu sửa' : c === 'approved' ? 'Đã chấp thuận' : '';

/** The body `POST /api/team/bom` takes for a vote (as bom-workspace.tsx sends it): no actor, tenant or seat. */
export const voteBody = (proposalId: string, c: { choice: string; note: string }) => ({ action: 'vote' as const, proposalId, choice: c.choice, note: c.note });

type Checked<T> = { ok: true; cmd: T } | { ok: false; error: string };
/** Mirrors the service rule (5 to 2000 characters after trimming) so a person is told before sending; the service decides in the end. */
export function voteCommand(choice: string, rawNote: string): Checked<{ choice: VoteChoice; note: string }> {
  const picked = VOTE_CHOICES.find(([value]) => value === choice);
  if (!picked) return { ok: false, error: CHOICE_COPY };
  const note = rawNote.trim(), size = Array.from(note).length;
  if (size < 5 || size > 2000) return { ok: false, error: NOTE_COPY };
  return { ok: true, cmd: { choice: picked[0], note } };
}

// /api/team/bom raises PROPOSAL_CLOSED and VERSION_CONFLICT; the other two codes are never raised by it and are kept only for a future caller of the same screen.
const CONFLICT_CODES = new Set(['PROPOSAL_CLOSED', 'VERSION_CONFLICT', 'REVISION_CONFLICT', 'REVIEW_ALREADY_DECIDED']);
/** A sentence for any thrown value, whether a reload belongs with it, and the code. Never an object. */
export function describeVoteError(e: unknown): { text: string; reloadable: boolean; code: string } {
  if (e instanceof ApiError) {
    if (CONFLICT_CODES.has(e.code)) return { text: CONFLICT_COPY, reloadable: true, code: e.code };
    return { text: e.message || GENERIC_COPY, reloadable: false, code: e.code };
  }
  if (e instanceof TypeError) return { text: NETWORK_COPY, reloadable: false, code: 'NETWORK' };
  return { text: GENERIC_COPY, reloadable: false, code: '' };
}
/** After a vote failed: the typed note is kept; a closed or changed proposal gives the Conflict sentence with a reload. */
export function voteFailure(e: unknown): { message: string; reloadable: boolean; code: string; keepNote: true } {
  const d = describeVoteError(e);
  return { message: d.text, reloadable: d.reloadable, code: d.code, keepNote: true };
}
/** After a vote was recorded: the key is retired, the note is cleared and the cards are read again. */
export const voteRecorded = (): { resetKey: true; clearNote: true; reload: true } => ({ resetKey: true, clearNote: true, reload: true });
