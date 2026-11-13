import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { statusLabel, variantOf, inboxState, commandErrorMessage, initialDraft, templateLabel, formatTime, reloadInbox, CONFLICT_COPY, NOT_MANAGER_COPY, type CardDraft } from '../src/components/inbox-view';
import { Inbox, InboxBody, IntakeCard, CardView, SourceList, FailureList, GatewayHash } from '../src/components/inbox';
import { ApprovalItem } from '../src/components/approvals';
import { AccessActions, expandsAccess } from '../src/components/team-accounts';
import type { CandidateCard, IntakeStatus, SourceAvailabilityRow, FailureRow } from '../src/server/inbox';

// Every id, chat id and text below is synthetic.
const status = (over: Partial<IntakeStatus> = {}): IntakeStatus => ({ receivedAt: '2026-11-13T01:00:00.000Z', persistedAt: '2026-11-13T01:00:01.000Z', projectedAt: null, deliveredAt: null, acknowledgedAt: null, outboxState: null, ...over });
const pid = '22222222-2222-4222-8222-222222222222';
const card = (over: Partial<CandidateCard> = {}): CandidateCard => ({ candidateId: '11111111-1111-4111-8111-111111111111', ref: 'IN-1111', projectId: pid,
  projectLabel: 'Dự án Thử', sourceRef: 'telegram:-1000000000001:42', receivedAt: '2026-11-13T01:00:00.000Z', classification: null, state: 'new', missingFields: [], duplicateCandidates: [],
  contentMode: 'excerpt', excerpt: 'Cổng thanh toán lỗi từ 9 giờ', forwarded: false, attachments: [], ticketRef: null, status: status(), version: 1, ...over });
// Only the (state, classification) pairs InboxService produces: ingest → new/null; need_info → needs_info/null (classification
// unchanged); confirm → confirmed/type; dismiss and mark_duplicate from an open card keep null; reopen → new/null.
const fresh = (over: Partial<CandidateCard> = {}) => card(over);
const asked = (missingFields: string[], over: Partial<CandidateCard> = {}) => card({ state: 'needs_info', missingFields, version: 2, ...over });
const confirmed = (classification: 'incident' | 'request' | 'document') => card({ state: 'confirmed', classification, version: 2 });
const reachable = (c: CandidateCard) => (c.state === 'confirmed') === (c.classification !== null);
const noop = async () => {};
const render = (c: CandidateCard, canAct = true) => renderToStaticMarkup(<IntakeCard card={c} canAct={canAct} onCommand={noop} />);
const body = (state: Parameters<typeof InboxBody>[0]['state']) => renderToStaticMarkup(
  <InboxBody state={state} items={[]} total={0} error="Lỗi mạng" projectLabel="Dự án Bí Mật" canAct onRetry={noop as never} onCommand={noop} />);

// Drives the hook-free card body like a browser would: render, find a control, call its handler, render again.
type Host = { type: string; props: Record<string, unknown> & { children?: ReactNode } };
function hosts(node: ReactNode, out: Host[] = []): Host[] {
  if (node == null || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') return out;
  if (Array.isArray(node)) { for (const n of node) hosts(n, out); return out; }
  if (!isValidElement(node)) return out;
  const el = node as ReactElement<Host['props']>;
  if (typeof el.type === 'string') { out.push({ type: el.type, props: el.props }); hosts(el.props.children, out); }
  else if (el.type === Fragment) hosts(el.props.children, out);
  else if (typeof el.type === 'function') {
    // a component with hooks (CardDetail) cannot run outside React; it holds no card action, so it is skipped
    let rendered: ReactNode;
    try { rendered = (el.type as (p: unknown) => ReactNode)(el.props); } catch { return out; }
    hosts(rendered, out);
  }
  return out;
}
const textOf = (n: ReactNode): string => n == null || typeof n === 'boolean' ? '' : typeof n === 'string' || typeof n === 'number' ? String(n)
  : Array.isArray(n) ? n.map(textOf).join('') : isValidElement(n) ? textOf((n.props as { children?: ReactNode }).children) : '';
function drive(c: CandidateCard, canAct = true) {
  let draft: CardDraft = initialDraft(c);
  const sent: Record<string, unknown>[] = [], errors: string[] = [];
  const view = () => <CardView card={c} canAct={canAct} draft={draft} busy={false} error=""
    onDraft={p => { draft = { ...draft, ...p }; }} onSubmit={cmd => { sent.push(cmd); }} onInvalid={m => { errors.push(m); }} />;
  const all = () => hosts(view());
  const buttons = () => all().filter(h => h.type === 'button').map(h => textOf(h.props.children));
  const control = (name: string) => all().find(h => h.props.name === name);
  return {
    html: () => renderToStaticMarkup(view()), buttons, sent, errors, draft: () => draft,
    fields: () => all().filter(h => ['textarea', 'input', 'select'].includes(h.type)).map(h => h.props.name),
    value: (name: string) => control(name)?.props.value,
    click: (label: string) => {
      const b = all().find(h => h.type === 'button' && textOf(h.props.children) === label);
      if (!b) throw new Error(`no button «${label}»; have ${JSON.stringify(buttons())}`);
      (b.props.onClick as () => void)();
    },
    type: (name: string, value: string) => {
      const f = control(name);
      if (!f) throw new Error('no field ' + name);
      (f.props.onChange as (e: unknown) => void)({ target: { value }, currentTarget: { value } });
    },
  };
}

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

  it('fixtures use only card states the server produces', () => {
    for (const c of [fresh(), asked(['Mã đơn']), confirmed('incident'), confirmed('request'), confirmed('document'), card({ state: 'dismissed', version: 2 }), card({ state: 'duplicate', version: 2 })])
      expect(reachable(c), c.state + '/' + c.classification).toBe(true);
    expect(variantOf(fresh())).toBe('unclassified');
    expect(variantOf(confirmed('document'))).toBe('document');
  });

  it('a new card offers the three human choices first; picking a type writes nothing and only then shows its inputs', () => {
    const d = drive(fresh());
    expect(d.buttons()).toEqual(expect.arrayContaining(['Sự cố', 'Yêu cầu', 'Tài liệu']));
    expect(d.html()).toContain('Chưa phân loại');
    expect(d.html()).not.toMatch(/gợi ý|đề xuất loại|tự động/i);
    for (const b of ['Xác nhận sự cố', 'Xác nhận tài liệu', 'Bổ sung thông tin', 'Xác nhận đủ thông tin', 'Xác nhận yêu cầu']) expect(d.buttons()).not.toContain(b);
    expect(d.fields()).not.toContain('note');
    expect(d.fields()).not.toContain('missing');
    d.click('Sự cố');
    expect(d.sent).toEqual([]);
    expect(d.html()).toContain('Ảnh hưởng / khôi phục');
    expect(d.fields()).toContain('note');
    expect(d.buttons()).toContain('Xác nhận sự cố');
    expect(d.buttons()).not.toContain('Sự cố');
    d.click('Đổi loại');
    expect(d.sent).toEqual([]);
    expect(d.buttons()).toEqual(expect.arrayContaining(['Sự cố', 'Yêu cầu', 'Tài liệu']));
    expect(d.fields()).not.toContain('note');
  });

  it('incident: the optional impact/recovery note goes with confirm', () => {
    const d = drive(fresh());
    d.click('Sự cố');
    d.type('note', '  Mất kết nối 15 phút; đã khởi động lại cổng  ');
    d.click('Xác nhận sự cố');
    expect(d.sent).toEqual([{ expectedVersion: 1, kind: 'confirm', classification: 'incident', note: 'Mất kết nối 15 phút; đã khởi động lại cổng' }]);
    const plain = drive(fresh());
    plain.click('Sự cố');
    plain.click('Xác nhận sự cố');
    expect(plain.sent).toEqual([{ expectedVersion: 1, kind: 'confirm', classification: 'incident' }]);
  });

  it('request: missing fields go to need_info, and «Xác nhận đủ thông tin» confirms the request', () => {
    const d = drive(fresh());
    d.click('Yêu cầu');
    expect(d.html()).toContain('Cần làm rõ');
    expect(d.fields()).toContain('missing');
    d.click('Bổ sung thông tin');
    expect(d.sent).toEqual([]);
    expect(d.errors).toEqual(['Nhập ít nhất một thông tin còn thiếu, mỗi dòng một mục.']);
    d.type('missing', 'Môi trường\n\n  Mã đơn  ');
    d.click('Bổ sung thông tin');
    expect(d.sent).toEqual([{ expectedVersion: 1, kind: 'need_info', missingFields: ['Môi trường', 'Mã đơn'] }]);
    const ok = drive(fresh());
    ok.click('Yêu cầu');
    ok.click('Xác nhận đủ thông tin');
    expect(ok.sent).toEqual([{ expectedVersion: 1, kind: 'confirm', classification: 'request' }]);
    // the server takes 1..10 fields of at most 100 characters: the screen says so instead of sending
    const many = drive(fresh());
    many.click('Yêu cầu');
    many.type('missing', Array.from({ length: 11 }, (_, i) => 'Mục ' + i).join('\n'));
    many.click('Bổ sung thông tin');
    many.type('missing', 'x'.repeat(101));
    many.click('Bổ sung thông tin');
    expect(many.sent).toEqual([]);
    expect(many.errors).toEqual(['Tối đa 10 mục còn thiếu.', 'Mỗi mục còn thiếu tối đa 100 ký tự.']);
  });

  it('document: «Xác nhận tài liệu» confirms and the source registration link stays', () => {
    const d = drive(fresh());
    d.click('Tài liệu');
    expect(d.html()).toContain('Mở Tài liệu dự án để đăng ký nguồn');
    expect(d.html()).toContain('href="/documents?projectId=' + pid + '"');
    d.click('Xác nhận tài liệu');
    expect(d.sent).toEqual([{ expectedVersion: 1, kind: 'confirm', classification: 'document' }]);
  });

  it('a needs_info card always shows what was asked, whatever the type, and can be confirmed or asked again', () => {
    const fields = ['Môi trường', 'Mã đơn'];
    const d = drive(asked(fields));
    for (const step of [null, 'Sự cố', 'Đổi loại', 'Tài liệu', 'Đổi loại', 'Yêu cầu'] as const) {
      if (step) d.click(step);
      for (const f of fields) expect(d.html(), String(step)).toContain('>' + f + '<');
    }
    // asking again starts from the list already asked
    expect(d.value('missing')).toBe('Môi trường\nMã đơn');
    d.type('missing', 'Môi trường\nMã đơn\nẢnh chụp lỗi');
    d.click('Bổ sung thông tin');
    expect(d.sent).toEqual([{ expectedVersion: 2, kind: 'need_info', missingFields: ['Môi trường', 'Mã đơn', 'Ảnh chụp lỗi'] }]);
    const inc = drive(asked(fields));
    inc.click('Sự cố');
    inc.click('Xác nhận sự cố');
    expect(inc.sent).toEqual([{ expectedVersion: 2, kind: 'confirm', classification: 'incident' }]);
    // a reader without the manager role still sees what was asked
    const ro = renderToStaticMarkup(<IntakeCard card={asked(fields)} canAct={false} onCommand={noop} />);
    for (const f of fields) expect(ro).toContain('>' + f + '<');
    expect(ro).not.toContain('<button');
  });

  it('a confirmed card shows its type read-only and only offers reopen with a reason', () => {
    const inc = drive(confirmed('incident'));
    expect(inc.html()).toContain('Ảnh hưởng / khôi phục');
    expect(inc.html()).toContain('Xem chi tiết');
    expect(inc.fields()).not.toContain('note');
    expect(inc.buttons()).toEqual(['Mở lại']);
    inc.click('Mở lại');
    expect(inc.errors).toEqual(['Nhập căn cứ trước khi thực hiện thao tác này.']);
    inc.type('reason', ' xem lại ');
    inc.click('Mở lại');
    expect(inc.sent).toEqual([{ expectedVersion: 2, kind: 'reopen', reason: 'xem lại' }]);
    expect(drive(confirmed('document')).html()).toContain('href="/documents?projectId=' + pid + '"');
    const dup = drive(fresh({ duplicateCandidates: [{ candidateId: '33333333-3333-4333-8333-333333333333', ref: 'IN-3333', reason: 'Cùng mã đơn và cùng nhóm trong 10 phút' }] }));
    expect(dup.html()).toContain('IN-3333');
    expect(dup.html()).toContain('Cùng mã đơn và cùng nhóm trong 10 phút');
    dup.type('dupOf', '33333333-3333-4333-8333-333333333333');
    dup.type('reason', 'trùng tin trước');
    dup.click('Đánh dấu trùng');
    expect(dup.sent).toEqual([{ expectedVersion: 1, kind: 'mark_duplicate', duplicateOf: '33333333-3333-4333-8333-333333333333', reason: 'trùng tin trước' }]);
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

  it('a new group shows Chưa xác minh khả năng nhận tin and never Đã kết nối đầy đủ; the first receipt time is formatted, not raw ISO', () => {
    const rows: SourceAvailabilityRow[] = [{ chatId: '-1000000000001', topicId: '', state: 'not-configured', coverageStart: null, coverageGaps: [], label: 'Chưa xác minh khả năng nhận tin' },
      { chatId: '-1000000000002', topicId: '7', state: 'partially-received', coverageStart: '2026-11-13T01:00:00.000Z', coverageGaps: [{ from: '2026-11-13T02:00:00.000Z', to: '2026-11-13T03:00:00.000Z' }], label: 'Nhận từ mốc ghi đầu tiên; không có lịch sử trước mốc này' }];
    const m = renderToStaticMarkup(<SourceList sources={rows} />);
    expect(m).toContain('Chưa xác minh khả năng nhận tin');
    expect(m).toContain('Nhận từ ' + formatTime('2026-11-13T01:00:00.000Z') + '; không có lịch sử trước mốc này');
    expect(m).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/);
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

  it('failure rows keep uncertain and dead apart, never say delivered, and name the message in Vietnamese with its card', () => {
    const row = (over: Partial<FailureRow>): FailureRow => ({ outboxId: 'a', state: 'uncertain', template: 'intake.received', candidateRef: null, lastErrorCode: null, ownerId: null, overdue: false, version: 1, ...over });
    const rows: FailureRow[] = [row({ outboxId: 'a', candidateRef: 'IN-AAAA1111' }),
      row({ outboxId: 'b', state: 'dead', template: 'intake.attachment_failed', candidateRef: 'IN-BBBB2222', lastErrorCode: 'FORBIDDEN', ownerId: 'u', overdue: true, version: 2 }),
      row({ outboxId: 'c', state: 'pending', template: 'intake.recovered', overdue: true }),
      row({ outboxId: 'd', state: 'leased', candidateRef: 'IN-DDDD4444', overdue: true })];
    const m = renderToStaticMarkup(<FailureList failures={rows} />);
    expect(m).toContain('Chưa rõ đã gửi hay chưa — đang đối soát');
    expect(m).toContain('Không gửi được');
    expect(m).toContain('Đã ghi, chưa gửi');
    expect(m).toContain('Đang gửi — quá hạn, chưa có biên nhận');
    expect(m).not.toMatch(/Đã gửi/);
    for (const label of ['Biên nhận đã nhận tin', 'Báo tệp lỗi', 'Biên nhận nhận bù', 'IN-AAAA1111', 'IN-BBBB2222', 'IN-DDDD4444', 'FORBIDDEN']) expect(m).toContain(label);
    expect(m).not.toContain('intake.');
    expect(templateLabel('account_approval.pending')).toBe('DM phiếu duyệt');
    expect(templateLabel('intake.unknown_kind')).toBe('intake.unknown_kind');
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
    for (const c of [fresh(), asked(['Mã đơn']), confirmed('incident')]) {
      const m = render(c, false);
      expect(m).not.toContain('<button');
      expect(m).toContain(NOT_MANAGER_COPY);
      expect(render(c, true)).toContain('<button');
      expect(render(c, true)).not.toContain(NOT_MANAGER_COPY);
    }
  });

  it('I-1 InboxBody needs no command handler for loading and read-only use', () => {
    const loading = renderToStaticMarkup(<InboxBody state="loading" items={[]} total={0} error={null} projectLabel="" canAct={false} />);
    expect(loading).toContain('aria-busy="true"');
    const ready = renderToStaticMarkup(<InboxBody state="ready" items={[fresh()]} total={1} error={null} projectLabel="Dự án Thử" canAct />);
    // without a handler nothing can be sent, so no action is offered even to a manager
    expect(ready).not.toContain('<button');
    expect(ready).toContain('IN-1111');
  });

  it('m-3 after a command the page, the sources and the failures are read again together', async () => {
    const asked: string[] = [];
    const src: SourceAvailabilityRow[] = [{ chatId: '-1000000000002', topicId: '', state: 'partially-received', coverageStart: '2026-11-13T01:00:00.000Z', coverageGaps: [], label: 'x' }];
    const get = async <T,>(path: string): Promise<T> => {
      asked.push(path);
      return (path.startsWith('/api/inbox/sources') ? src : path.startsWith('/api/inbox/failures') ? [] : { items: [fresh()], total: 1 }) as T;
    };
    const r = await reloadInbox(pid, get);
    expect([...asked].sort()).toEqual(['/api/inbox/failures?projectId=' + pid, '/api/inbox/sources?projectId=' + pid, '/api/inbox?projectId=' + pid].sort());
    expect(r).toEqual({ page: { items: [fresh()], total: 1 }, sources: src, failures: [] });
    const { readFile } = await import('node:fs/promises');
    const screen = await readFile('src/components/inbox.tsx', 'utf8');
    expect(screen).toMatch(/reloadInbox\(projectId/);
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
    expect(change).toContain('Quyền đề nghị: Dự án A (Thực hiện, quyền báo cáo: Xem điểm nhân sự); Dự án B (Điều phối)');
    expect(change).not.toContain('people_read');
    expect(change).toContain('Thành viên Thử');
    const noPrev = renderToStaticMarkup(<ApprovalItem busy={false} onVote={noop} item={{ ...base, kind: 'access_change', previous_grant_details: [], grant_details: [{ name: 'Dự án B', role: 'manager', reportPermissions: [] }] }} />);
    expect(noPrev).toContain('Quyền hiện tại: chưa có quyền nào');
    const reg = renderToStaticMarkup(<ApprovalItem busy={false} onVote={noop} item={{ ...base, kind: 'registration', project_interest: 'Dự án A', previous_grant_details: null, grant_details: [{ name: 'Dự án A', role: 'viewer', reportPermissions: [] }] }} />);
    expect(reg).toContain('Phiếu đăng ký thành viên');
    expect(reg).toContain('Người đăng ký đề nghị: Dự án A');
    expect(reg).not.toContain('Quyền hiện tại');
  });

  it('one shared predicate decides whether a grant change widens access, for the team screen and the server', async () => {
    const { widensAccess } = await import('../src/server/access-grants');
    const { readFile } = await import('node:fs/promises');
    type G = { projectId: string; role: 'viewer' | 'engineer' | 'manager' | 'technical' | 'business'; reportPermissions: ('people_read' | 'quality_review' | 'report_approve')[] };
    const g = (projectId: string, role: G['role'], reportPermissions: G['reportPermissions'] = []): G => ({ projectId, role, reportPermissions });
    const table: [G[], G[], boolean][] = [
      [[g('a', 'viewer')], [g('a', 'engineer')], true],
      [[g('a', 'viewer')], [g('a', 'viewer'), g('b', 'viewer')], true],
      [[g('a', 'viewer')], [g('a', 'viewer', ['people_read'])], true],
      [[g('a', 'manager')], [g('a', 'technical')], true],
      [[g('a', 'viewer')], [], false],
      [[g('a', 'viewer')], [g('a', 'viewer')], false],
      [[g('a', 'manager')], [g('a', 'viewer')], false],
      [[g('a', 'engineer', ['people_read', 'quality_review'])], [g('a', 'engineer', ['quality_review'])], false],
      [[g('a', 'engineer'), g('b', 'viewer')], [g('b', 'viewer')], false],
    ];
    for (const [before, after, widens] of table) {
      expect(widensAccess(before, after), JSON.stringify([before, after])).toBe(widens);
      expect(expandsAccess(before, after), JSON.stringify([before, after])).toBe(widens);
    }
    // neither side keeps its own copy of the rule
    const server = await readFile('src/server/accounts.ts', 'utf8'), screen = await readFile('src/components/team-accounts.tsx', 'utf8');
    for (const src of [server, screen]) expect(src).toMatch(/from ['"](?:\.\/|\.\.\/server\/|@\/server\/)access-grants['"]/);
    expect(server).not.toMatch(/function reducesAccess/);
    expect(screen).not.toMatch(/prior\.reportPermissions\.includes/);
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
