import type { CandidateCard, CandidateState, FailureRow, IntakeStatus } from '../server/inbox';

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
    : f.overdue ? 'Đã ghi, chưa gửi — quá hạn 10 phút' : 'Đã ghi, chưa gửi';

export const variantOf = (c: CandidateCard): 'incident' | 'request' | 'document' | 'unclassified' => c.classification ?? 'unclassified';

export const VARIANT_NAMES = { incident: 'Sự cố', request: 'Yêu cầu', document: 'Tài liệu', unclassified: 'Chưa phân loại' } as const;
export const STATE_NAMES: Record<CandidateState, string> = { new: 'Mới', needs_info: 'Cần bổ sung', confirmed: 'Đã xác nhận', duplicate: 'Trùng', dismissed: 'Đã bỏ qua' };

/** Primary button of a card. Unclassified cards have none: the person picks the type with the three choice buttons. */
export const primaryAction = (c: CandidateCard, canAct: boolean): 'Xác nhận yêu cầu' | 'Bổ sung thông tin' | null => {
  if (!canAct || (c.state !== 'new' && c.state !== 'needs_info') || c.classification === null) return null;
  if (c.state === 'new' && c.classification === 'request') return 'Bổ sung thông tin';
  return 'Xác nhận yêu cầu';
};

export const commandErrorMessage = (e: unknown): string => {
  const m = e instanceof Error ? e.message : 'Không xử lý được yêu cầu.';
  return m.includes('[REVISION_CONFLICT]') ? CONFLICT_COPY : m;
};

export const formatTime = (v: string | null): string => v ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(v)) : '';
export const sizeLabel = (n: number | null): string => n === null ? 'Chưa rõ dung lượng' : n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
/** Only the tail of a chat id is shown, enough to tell groups apart. */
export const chatTail = (chatId: string): string => '…' + chatId.slice(-4);
