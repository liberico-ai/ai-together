import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { statusLabel, variantOf, primaryAction, inboxState, commandErrorMessage, CONFLICT_COPY } from '../src/components/inbox-view';
import { Inbox, InboxBody, IntakeCard, SourceList, FailureList, GatewayHash } from '../src/components/inbox';
import { ApprovalItem } from '../src/components/approvals';
import { AccessActions, expandsAccess } from '../src/components/team-accounts';
import type { CandidateCard, IntakeStatus, SourceAvailabilityRow, FailureRow } from '../src/server/inbox';

// Every id, chat id and text below is synthetic.
const status = (over: Partial<IntakeStatus> = {}): IntakeStatus => ({ receivedAt: '2026-11-13T01:00:00.000Z', persistedAt: '2026-11-13T01:00:01.000Z', projectedAt: null, deliveredAt: null, acknowledgedAt: null, outboxState: null, ...over });
const card = (over: Partial<CandidateCard> = {}): CandidateCard => ({ candidateId: '11111111-1111-4111-8111-111111111111', ref: 'IN-1111', projectId: '22222222-2222-4222-8222-222222222222',
  projectLabel: 'Dự án Thử', sourceRef: 'telegram:-1000000000001:42', receivedAt: '2026-11-13T01:00:00.000Z', classification: null, state: 'new', missingFields: [], duplicateCandidates: [],
  contentMode: 'excerpt', excerpt: 'Cổng thanh toán lỗi từ 9 giờ', forwarded: false, attachments: [], ticketRef: null, status: status(), version: 1, ...over });
const noop = async () => {};
const render = (c: CandidateCard, canAct = true) => renderToStaticMarkup(<IntakeCard card={c} canAct={canAct} onCommand={noop} />);
const body = (state: Parameters<typeof InboxBody>[0]['state']) => renderToStaticMarkup(
  <InboxBody state={state} items={[]} total={0} error="Lỗi mạng" projectLabel="Dự án Bí Mật" canAct onRetry={noop as never} onCommand={noop} />);

describe('inbox UI', () => {
  it('renders the four states: empty, error, loading and denied, with different wording for empty and denied', () => {
    expect(body('loading')).toContain('aria-busy="true"');
    expect(body('loading')).not.toContain('>0<');
    expect(body('empty')).toContain('Chưa có tin nào được tiếp nhận cho dự án này');
    expect(body('error')).toContain('role="alert"');
    expect(body('error')).toContain('Thử lại');
    expect(body('denied')).toContain('Anh/chị chưa có quyền xem Inbox của dự án này');
    expect(body('denied')).not.toContain('Dự án Bí Mật');
    expect(body('empty')).not.toContain('chưa có quyền');
    expect(body('denied')).not.toContain('Chưa có tin nào được tiếp nhận');
    expect(inboxState({ loading: true, error: 'x', denied: true, count: 0 })).toBe('loading');
    expect(inboxState({ loading: false, error: 'x', denied: true, count: 0 })).toBe('denied');
    expect(inboxState({ loading: false, error: 'x', denied: false, count: 0 })).toBe('error');
    expect(inboxState({ loading: false, error: null, denied: false, count: 0 })).toBe('empty');
    expect(inboxState({ loading: false, error: null, denied: false, count: 3 })).toBe('ready');
  });

  it('IntakeCard renders incident, request and document variants and an unclassified card with three human choices', () => {
    const pid = '22222222-2222-4222-8222-222222222222';
    const inc = render(card({ classification: 'incident', state: 'confirmed' }));
    expect(inc).toContain('Ảnh hưởng / khôi phục');
    const req = render(card({ classification: 'request', state: 'needs_info', missingFields: ['Môi trường', 'Mã đơn'] }));
    expect(req).toContain('Cần làm rõ');
    expect(req).toContain('Môi trường');
    expect(req).toContain('Mã đơn');
    const doc = render(card({ classification: 'document', state: 'confirmed' }));
    expect(doc).toContain('Đăng ký nguồn');
    expect(doc).toContain('href="/documents?projectId=' + pid + '"');
    expect(variantOf(card({ classification: 'document' }))).toBe('document');
    expect(variantOf(card())).toBe('unclassified');
    const un = render(card());
    for (const label of ['Sự cố', 'Yêu cầu', 'Tài liệu']) expect(un).toContain('>' + label + '<');
    expect(un).toContain('Chưa phân loại');
    expect(un).not.toMatch(/gợi ý|đề xuất loại|tự động/i);
    expect(un).not.toContain('Ảnh hưởng / khôi phục');
    const dup = render(card({ duplicateCandidates: [{ candidateId: '33333333-3333-4333-8333-333333333333', ref: 'IN-3333', reason: 'Cùng mã đơn và cùng nhóm trong 10 phút' }] }));
    expect(dup).toContain('IN-3333');
    expect(dup).toContain('Cùng mã đơn và cùng nhóm trong 10 phút');
    expect(primaryAction(card({ classification: 'incident' }), true)).toBe('Xác nhận yêu cầu');
    expect(primaryAction(card({ classification: 'request' }), true)).toBe('Bổ sung thông tin');
    expect(primaryAction(card({ classification: 'request', state: 'needs_info' }), true)).toBe('Xác nhận yêu cầu');
    expect(primaryAction(card(), true)).toBeNull();
    expect(primaryAction(card({ classification: 'incident', state: 'confirmed' }), true)).toBeNull();
    expect(primaryAction(card({ classification: 'incident' }), false)).toBeNull();
  });

  it('the project picker lists only permitted projects and the denied view leaks no name or count', () => {
    const picker = renderToStaticMarkup(<Inbox projects={[{ id: 'p1', name: 'Dự án Được Phép' }, { id: 'p2', name: 'Dự án Thứ Hai' }]} projectId={null} initial={null} sources={[]} failures={[]} denied={false} canAct={false} />);
    expect(picker).toContain('Dự án Được Phép');
    expect(picker).toContain('href="/inbox?projectId=p2"');
    expect(picker).not.toContain('Dự án Ngoài Quyền');
    const denied = renderToStaticMarkup(<Inbox projects={[{ id: 'p9', name: 'Dự án Ngoài Quyền' }]} projectId="p9" initial={{ items: [card({ projectLabel: 'Dự án Ngoài Quyền' })], total: 7 }}
      sources={[{ chatId: '-1000000000001', topicId: '', state: 'not-configured', coverageStart: null, coverageGaps: [], label: 'Chưa xác minh khả năng nhận tin' }]} failures={[]} denied canAct={false} />);
    expect(denied).toContain('Anh/chị chưa có quyền xem Inbox của dự án này');
    for (const leak of ['Dự án Ngoài Quyền', 'IN-1111', '>7<', '7 /', '-1000000000001', 'Cổng thanh toán']) expect(denied).not.toContain(leak);
  });

  it('a new group shows Chưa xác minh khả năng nhận tin and never Đã kết nối đầy đủ', () => {
    const rows: SourceAvailabilityRow[] = [{ chatId: '-1000000000001', topicId: '', state: 'not-configured', coverageStart: null, coverageGaps: [], label: 'Chưa xác minh khả năng nhận tin' },
      { chatId: '-1000000000002', topicId: '7', state: 'partially-received', coverageStart: '2026-11-13T01:00:00.000Z', coverageGaps: [{ from: '2026-11-13T02:00:00.000Z', to: '2026-11-13T03:00:00.000Z' }], label: 'Nhận từ 2026-11-13T01:00:00.000Z; không có lịch sử trước mốc này' }];
    const m = renderToStaticMarkup(<SourceList sources={rows} />);
    expect(m).toContain('Chưa xác minh khả năng nhận tin');
    expect(m).toContain('không có lịch sử trước mốc này');
    expect(m).not.toContain('Đã kết nối đầy đủ');
    expect(m).not.toContain('-1000000000001');
    expect(renderToStaticMarkup(<SourceList sources={[]} />)).toContain('Chưa có nhóm Telegram nào được đề xuất cho dự án này');
  });

  it('PM-07 a persisted but undelivered receipt reads Đã ghi, chưa gửi', () => {
    expect(statusLabel(status())).toBe('Đã ghi, chưa gửi');
    expect(statusLabel(status({ outboxState: 'pending' }))).toBe('Đã ghi, chưa gửi');
    expect(statusLabel(status({ outboxState: 'leased' }))).toBe('Đang gửi');
    expect(statusLabel(status({ outboxState: 'delivered', deliveredAt: '2026-11-13T01:05:00.000Z' }))).toBe('Đã gửi tới nhóm');
    expect(statusLabel(status({ outboxState: 'delivered', deliveredAt: '2026-11-13T01:05:00.000Z', acknowledgedAt: '2026-11-13T01:06:00.000Z' }))).toBe('Đã gửi tới nhóm · người nhận đã xác nhận');
    expect(statusLabel(status({ outboxState: 'uncertain' }))).toBe('Chưa rõ đã gửi hay chưa — đang đối soát');
    expect(statusLabel(status({ outboxState: 'dead' }))).toBe('Không gửi được');
    expect(statusLabel(status({ outboxState: 'abandoned' }))).toBe('Không gửi được');
    // six outbox states plus none: no label says Đã gửi without deliveredAt, even if the state or the acknowledgement claims otherwise
    for (const s of ['pending', 'leased', 'delivered', 'uncertain', 'dead', 'abandoned', null] as const) {
      const label = statusLabel(status({ outboxState: s, deliveredAt: null, acknowledgedAt: '2026-11-13T01:06:00.000Z' }));
      expect(label).not.toMatch(/Đã gửi/);
      expect(label).not.toContain('người nhận đã xác nhận');
    }
    const m = render(card({ status: status() }));
    expect(m).toContain('Đã ghi, chưa gửi');
    expect(m).toContain('Chưa chiếu');
    expect(m).not.toMatch(/Đã gửi/);
  });

  it('failure rows keep uncertain and dead apart and never say delivered', () => {
    const rows: FailureRow[] = [{ outboxId: 'a', state: 'uncertain', template: 'intake.receipt', lastErrorCode: null, ownerId: null, overdue: false, version: 1 },
      { outboxId: 'b', state: 'dead', template: 'intake.receipt', lastErrorCode: 'FORBIDDEN', ownerId: 'u', overdue: true, version: 2 },
      { outboxId: 'c', state: 'pending', template: 'intake.receipt', lastErrorCode: null, ownerId: null, overdue: true, version: 1 }];
    const m = renderToStaticMarkup(<FailureList failures={rows} />);
    expect(m).toContain('Chưa rõ đã gửi hay chưa — đang đối soát');
    expect(m).toContain('Không gửi được');
    expect(m).toContain('Đã ghi, chưa gửi');
    expect(m).not.toMatch(/Đã gửi/);
    expect(renderToStaticMarkup(<FailureList failures={[]} />)).toContain('Không có tin gửi nào cần xử lý');
  });

  it('pointer-only cards show no message text', () => {
    const m = render(card({ contentMode: 'pointer_only', excerpt: 'NỘI DUNG KHÔNG ĐƯỢC HIỆN', sourceRef: 'telegram:-1000000000001:99' }));
    expect(m).toContain('Chỉ giữ con trỏ và hash. Mở tin gốc trong Telegram');
    expect(m).toContain('telegram:-1000000000001:99');
    expect(m).not.toContain('NỘI DUNG KHÔNG ĐƯỢC HIỆN');
    const ex = render(card());
    expect(ex).toContain('Cổng thanh toán lỗi từ 9 giờ');
    expect(ex).not.toContain('Chỉ giữ con trỏ');
  });

  it('gateway-declared hashes are never shown as verified', () => {
    const h = 'a'.repeat(64);
    const m = renderToStaticMarkup(<GatewayHash hash={h} />);
    expect(m).toContain(h);
    expect(m).toContain('do gateway khai');
    expect(m).not.toMatch(/đã kiểm|đã xác minh|verified|✓|✔/i);
    expect(m).toContain('doc-wrap');
    expect(renderToStaticMarkup(<GatewayHash hash={null} />)).toContain('Không có hash');
  });

  it('a viewer of the card without manager role sees no action button, with the reason', () => {
    const m = render(card({ classification: 'request' }), false);
    expect(m).not.toContain('<button');
    expect(m).toContain('Chỉ điều phối dự án được thao tác');
    expect(render(card({ classification: 'request' }), true)).toContain('<button');
    expect(render(card({ classification: 'request' }), true)).not.toContain('Chỉ điều phối dự án được thao tác');
  });

  it('a stale version shows the conflict sentence and keeps the choice', () => {
    expect(CONFLICT_COPY).toBe('Mục này vừa được người khác cập nhật. Tải lại để xem bản mới.');
    expect(commandErrorMessage(new Error('Tin đã thay đổi. [REVISION_CONFLICT]'))).toBe(CONFLICT_COPY);
    expect(commandErrorMessage(new Error('Lỗi khác [INVALID_INPUT]'))).toBe('Lỗi khác [INVALID_INPUT]');
  });

  it('approvals show the ballot kind and current → proposed grants', () => {
    const base = { id: 'b1', name: 'Thành viên Thử', username: 'thu', reason: 'Cần mở rộng phạm vi', expires_at: '2026-11-20T00:00:00Z', project_interest: '' };
    const change = renderToStaticMarkup(<ApprovalItem busy={false} onVote={noop} item={{ ...base, kind: 'access_change',
      previous_grant_details: [{ name: 'Dự án A', role: 'viewer', reportPermissions: [] }],
      grant_details: [{ name: 'Dự án A', role: 'engineer', reportPermissions: ['people_read'] }, { name: 'Dự án B', role: 'manager', reportPermissions: [] }] }} />);
    expect(change).toContain('Phiếu đổi quyền');
    expect(change).not.toContain('Người đăng ký đề nghị');
    expect(change).toContain('Quyền hiện tại: Dự án A (Chỉ đọc)');
    expect(change).toContain('→');
    expect(change).toContain('Quyền đề nghị: Dự án A (Thực hiện, quyền báo cáo: people_read); Dự án B (Điều phối)');
    expect(change).toContain('Thành viên Thử');
    const noPrev = renderToStaticMarkup(<ApprovalItem busy={false} onVote={noop} item={{ ...base, kind: 'access_change', previous_grant_details: [], grant_details: [{ name: 'Dự án B', role: 'manager', reportPermissions: [] }] }} />);
    expect(noPrev).toContain('Quyền hiện tại: chưa có quyền nào');
    const reg = renderToStaticMarkup(<ApprovalItem busy={false} onVote={noop} item={{ ...base, kind: 'registration', project_interest: 'Dự án A', previous_grant_details: null, grant_details: [{ name: 'Dự án A', role: 'viewer', reportPermissions: [] }] }} />);
    expect(reg).toContain('Phiếu đăng ký thành viên');
    expect(reg).toContain('Người đăng ký đề nghị: Dự án A');
    expect(reg).not.toContain('Quyền hiện tại');
  });

  it('team accounts offer Trình phiếu đổi quyền only when access expands', () => {
    const before = [{ projectId: 'a', role: 'viewer' as const, reportPermissions: [] as never[] }];
    expect(expandsAccess(before, [{ projectId: 'a', role: 'engineer', reportPermissions: [] }])).toBe(true);
    expect(expandsAccess(before, [...before, { projectId: 'b', role: 'viewer', reportPermissions: [] }])).toBe(true);
    expect(expandsAccess(before, [{ projectId: 'a', role: 'viewer', reportPermissions: ['people_read'] }])).toBe(true);
    expect(expandsAccess(before, [])).toBe(false);
    expect(expandsAccess(before, before)).toBe(false);
    expect(expandsAccess([{ projectId: 'a', role: 'manager', reportPermissions: [] }], [{ projectId: 'a', role: 'viewer', reportPermissions: [] }])).toBe(false);
    const widen = renderToStaticMarkup(<AccessActions expands busy={false} />);
    expect(widen).toContain('Trình phiếu đổi quyền');
    expect(widen).toContain('value="propose_access_change"');
    expect(widen).not.toContain('>Lưu quyền<');
    const narrow = renderToStaticMarkup(<AccessActions expands={false} busy={false} />);
    expect(narrow).toContain('>Lưu quyền<');
    expect(narrow).toContain('value="access"');
    expect(narrow).not.toContain('Trình phiếu đổi quyền');
  });
});
