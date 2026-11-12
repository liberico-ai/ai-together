import type { SourceState } from '@/server/types';

export type PageState = 'loading' | 'error' | 'denied' | 'no-results' | 'empty' | 'ready';

export function pageState(i: { loading: boolean; error: string | null; denied: boolean; rows: number; term?: string }): PageState {
  if (i.loading) return 'loading';
  if (i.denied) return 'denied';
  if (i.error) return 'error';
  if (i.rows === 0) return (i.term ?? '').trim() ? 'no-results' : 'empty';
  return 'ready';
}

export const SOURCE_STATE_VIEW: Record<SourceState, { label: string; nextStep: string; tone: 'neutral' | 'warn' | 'error' }> = {
  fresh: { label: 'Nguồn vừa kiểm', nextStep: 'Có thể mở nguồn.', tone: 'neutral' },
  stale: { label: 'Nguồn chưa kiểm mới', nextStep: 'Mở nguồn để đối chiếu bản hiện tại.', tone: 'warn' },
  unavailable: { label: 'Nguồn không mở được', nextStep: 'Báo chủ nội dung kiểm lại liên kết. Lịch sử trong sổ vẫn còn.', tone: 'error' },
  denied: { label: 'Không đủ quyền xem nguồn', nextStep: 'Xin quyền từ người quản lý dự án.', tone: 'error' },
  'not-configured': { label: 'Chưa cấu hình kiểm nguồn', nextStep: 'Chưa có kiểm tự động; mở nguồn để xem trực tiếp.', tone: 'neutral' },
  'partially-received': { label: 'Mới nhận một phần', nextStep: 'Chờ nhận đủ hoặc kiểm lại nguồn.', tone: 'warn' },
};

export const approvedLabel = (revisionNo: number | null): string => revisionNo === null ? 'Chưa có' : 'r' + revisionNo;
export const draftLabel = (revisionNo: number | null, missing: number): string =>
  revisionNo === null ? 'Chưa có' : 'r' + revisionNo + (missing > 0 ? ' · Cần bổ sung' : '');
export function hashLabel(v: 'self_declared' | 'verified' | null): string {
  if (v === 'self_declared') return 'Hash tự khai — chưa kiểm';
  if (v === 'verified') return 'Hash đã kiểm';
  return 'Chưa có hash';
}
export const formatTime = (v: string): string =>
  new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(v));
export function freshnessLabel(projectedAt: string | null, recordUpdatedAt: string): string {
  if (!projectedAt) return 'Chưa chiếu';
  const at = formatTime(projectedAt);
  return new Date(projectedAt).getTime() < new Date(recordUpdatedAt).getTime() ? 'Chưa kiểm mới · chiếu lúc ' + at : 'Chiếu lúc ' + at;
}

export const noResultsCopy = (term: string): string => 'Không tìm thấy tài liệu khớp "' + term + '"';
export const emptyProjectionCopy = (projectedAt: string | null): string => projectedAt
  ? 'Tài liệu vừa đăng ký sẽ hiện sau lần chiếu chỉ mục kế tiếp (lần chiếu gần nhất: ' + formatTime(projectedAt) + ').'
  : 'Chỉ mục chưa được chiếu lần nào; tài liệu đã đăng ký sẽ hiện sau lần chiếu đầu tiên.';
export const registerNotice = (title: string, projectedAt: string | null): string =>
  'Đã đăng ký "' + title + '". Tài liệu sẽ hiện trong danh sách sau lần chiếu chỉ mục kế tiếp (lần chiếu gần nhất: ' + (projectedAt ? formatTime(projectedAt) : 'chưa chiếu lần nào') + ').';
/** Chỉ https mới được hiện thành liên kết; trả host hoặc null. */
export function safeHttpsHost(uri: string): string | null {
  try { const u = new URL(uri); return u.protocol === 'https:' ? u.hostname : null; } catch { return null; }
}
