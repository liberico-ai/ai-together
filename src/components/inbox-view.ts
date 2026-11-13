import type { CandidateCard, CandidateState, FailureRow, IntakeStatus, SourceAvailabilityRow } from '../server/inbox';

// Pure helpers for the Inbox screen (markup tests render these without a browser).
export type InboxPageState = 'loading' | 'denied' | 'error' | 'empty' | 'ready';
export const CONFLICT_COPY = 'Mục này vừa được người khác cập nhật. Tải lại để xem bản mới.';
export const NOT_MANAGER_COPY = 'Chỉ điều phối dự án được thao tác. Vai hiện tại của anh/chị chỉ xem Inbox.';
export const POINTER_ONLY_COPY = 'Chỉ giữ con trỏ và hash. Mở tin gốc trong Telegram';

export const inboxState = (i: { loading: boolean; error: string | null; denied: boolean; count: number }): InboxPageState =>
  i.loading ? 'loading' : i.denied ? 'denied' : i.error ? 'error' : i.count === 0 ? 'empty' : 'ready';

/**
 * One line for the delivery lifecycle. «Đã gửi» is only ever produced from deliveredAt (set by the gateway receipt),
 * never from the outbox state alone and never from persisted/received.
 */
export const statusLabel = (s: IntakeStatus): string => {
  const delivered = s.deliveredAt !== null && s.outboxState === 'delivered';
  if (delivered) return 'Đã gửi tới nhóm' + (s.acknowledgedAt ? ' · người nhận đã xác nhận' : '');
  switch (s.outboxState) {
    case 'leased': return 'Đang gửi';
    case 'uncertain': return 'Chưa rõ đã gửi hay chưa — đang đối soát';
    case 'dead': case 'abandoned': return 'Không gửi được';
    default: return 'Đã ghi, chưa gửi';
  }
};

export const failureLabel = (f: Pick<FailureRow, 'state' | 'overdue'>): string =>
  f.state === 'uncertain' ? 'Chưa rõ đã gửi hay chưa — đang đối soát' : f.state === 'dead' ? 'Không gửi được'
    : f.state === 'leased' ? 'Đang gửi — quá hạn, chưa có biên nhận'
    : f.overdue ? 'Đã ghi, chưa gửi — quá hạn 10 phút' : 'Đã ghi, chưa gửi';

/** What an outbox row is, in the reader's words; an unknown template shows its code rather than a guess. */
export const TEMPLATE_LABELS: Record<string, string> = { 'intake.received': 'Biên nhận đã nhận tin', 'intake.recovered': 'Biên nhận nhận bù',
  'intake.attachment_failed': 'Báo tệp lỗi', 'account_approval.pending': 'DM phiếu duyệt' };
export const templateLabel = (template: string): string => TEMPLATE_LABELS[template] ?? template;

export type CardType = 'incident' | 'request' | 'document';
export const isOpen = (c: Pick<CandidateCard, 'state'>): boolean => c.state === 'new' || c.state === 'needs_info';

/**
 * Unsaved choices on one card. Picking a type is local: nothing reaches the server until a commit button is pressed.
 * The server sets `classification` only with `confirm`, so an open card (new, needs_info) always arrives unclassified.
 */
export type CardDraft = { pick: CardType | null; note: string; missing: string; reason: string; dupOf: string };
/** A needs_info card starts its «ask again» list from what was already asked. */
export const initialDraft = (c: Pick<CandidateCard, 'state' | 'missingFields'>): CardDraft =>
  ({ pick: null, note: '', missing: c.state === 'needs_info' ? c.missingFields.join('\n') : '', reason: '', dupOf: '' });

/** Type a card shows: the stored classification, else the person's unsaved pick while the card is open. */
export const variantOf = (c: CandidateCard, d?: Pick<CardDraft, 'pick'>): CardType | 'unclassified' =>
  c.classification ?? (d && isOpen(c) ? d.pick : null) ?? 'unclassified';

export const VARIANT_NAMES = { incident: 'Sự cố', request: 'Yêu cầu', document: 'Tài liệu', unclassified: 'Chưa phân loại' } as const;
export const STATE_NAMES: Record<CandidateState, string> = { new: 'Mới', needs_info: 'Cần bổ sung', confirmed: 'Đã xác nhận', duplicate: 'Trùng', dismissed: 'Đã bỏ qua' };

/** Commands exactly as the inbox API takes them (src/server/inbox.ts commandSchema), without expectedVersion. */
export type CardCommand =
  | { kind: 'confirm'; classification: CardType; note?: string }
  | { kind: 'need_info'; missingFields: string[] }
  | { kind: 'mark_duplicate'; duplicateOf: string; reason: string }
  | { kind: 'dismiss'; reason: string }
  | { kind: 'reopen'; reason: string };
export type Built = { ok: true; cmd: CardCommand } | { ok: false; error: string };
export type CardAction = { label: string; primary: boolean; build: () => Built };

const lines = (text: string) => text.split('\n').map(l => l.trim()).filter(Boolean);
/** Same limits as the server (1..10 fields, at most 100 characters each), said before anything is sent. */
export function needInfoCommand(d: Pick<CardDraft, 'missing'>): Built {
  const fields = lines(d.missing);
  if (!fields.length) return { ok: false, error: 'Nhập ít nhất một thông tin còn thiếu, mỗi dòng một mục.' };
  if (fields.length > 10) return { ok: false, error: 'Tối đa 10 mục còn thiếu.' };
  if (fields.some(f => f.length > 100)) return { ok: false, error: 'Mỗi mục còn thiếu tối đa 100 ký tự.' };
  return { ok: true, cmd: { kind: 'need_info', missingFields: fields } };
}
const withReason = (d: Pick<CardDraft, 'reason'>, make: (reason: string) => CardCommand): Built =>
  d.reason.trim() ? { ok: true, cmd: make(d.reason.trim()) } : { ok: false, error: 'Nhập căn cứ trước khi thực hiện thao tác này.' };

/** The commit actions of a card, in display order. A manager on an open card must pick a type before any confirm exists. */
export function cardActions(c: CandidateCard, d: CardDraft, canAct: boolean): CardAction[] {
  if (!canAct) return [];
  if (!isOpen(c)) return [{ label: 'Mở lại', primary: false, build: () => withReason(d, reason => ({ kind: 'reopen', reason })) }];
  const out: CardAction[] = [];
  const type = variantOf(c, d);
  if (type === 'incident') {
    const note = d.note.trim();
    out.push({ label: 'Xác nhận sự cố', primary: true, build: () => ({ ok: true, cmd: { kind: 'confirm', classification: 'incident', ...(note ? { note } : {}) } }) });
  } else if (type === 'request') {
    out.push({ label: 'Bổ sung thông tin', primary: true, build: () => needInfoCommand(d) });
    out.push({ label: 'Xác nhận đủ thông tin', primary: false, build: () => ({ ok: true, cmd: { kind: 'confirm', classification: 'request' } }) });
  } else if (type === 'document') {
    out.push({ label: 'Xác nhận tài liệu', primary: true, build: () => ({ ok: true, cmd: { kind: 'confirm', classification: 'document' } }) });
  }
  if (c.duplicateCandidates.length > 0) out.push({ label: 'Đánh dấu trùng', primary: false,
    build: () => d.dupOf ? withReason(d, reason => ({ kind: 'mark_duplicate', duplicateOf: d.dupOf, reason })) : { ok: false, error: 'Chọn tin bị trùng trước.' } });
  out.push({ label: 'Bỏ qua tin này', primary: false, build: () => withReason(d, reason => ({ kind: 'dismiss', reason })) });
  return out;
}

export const commandErrorMessage = (e: unknown): string => {
  const m = e instanceof Error ? e.message : 'Không xử lý được yêu cầu.';
  return m.includes('[REVISION_CONFLICT]') ? CONFLICT_COPY : m;
};

export const formatTime = (v: string | null): string => v ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(v)) : '';
export const sizeLabel = (n: number | null): string => n === null ? 'Chưa rõ dung lượng' : n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
/** Only the tail of a chat id is shown, enough to tell groups apart. */
export const chatTail = (chatId: string): string => '…' + chatId.slice(-4);

/** A received group says from when it was received, in local time; the server sends the instant, never a formatted ISO string. */
export const sourceLabel = (s: Pick<SourceAvailabilityRow, 'coverageStart' | 'label'>): string =>
  s.coverageStart ? 'Nhận từ ' + formatTime(s.coverageStart) + '; không có lịch sử trước mốc này' : s.label;

export type InboxPage = { items: CandidateCard[]; total: number };
export type InboxData = { page: InboxPage; sources: SourceAvailabilityRow[]; failures: FailureRow[] };
/** The three reads of one project's Inbox, taken together after a command: a receipt the command changed shows in failures too. */
export async function reloadInbox(projectId: string, get: <T>(path: string) => Promise<T>): Promise<InboxData> {
  const q = '?' + new URLSearchParams({ projectId }).toString();
  const [page, sources, failures] = await Promise.all([get<InboxPage>('/api/inbox' + q), get<SourceAvailabilityRow[]>('/api/inbox/sources' + q),
    get<FailureRow[]>('/api/inbox/failures' + q)]);
  return { page, sources, failures };
}
