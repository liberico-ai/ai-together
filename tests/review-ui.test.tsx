import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { reviewPageState, eligibilityCopy, diffLabel, approverCopy, commandErrorCopy, describeError, decisionStateLabel, hashLabel, selectableMembers,
  decisionBody, commentBody, replyBody, grantBody, revokeBody, decisionCommand, grantCommand, revokeCommand, idempotencyKey, postReview,
  CONFLICT_COPY, DECIDED_COPY, NOT_FOUND_COPY, EMPTY_COPY, DENIED_COPY, ERROR_COPY, type PanelDraft, type DecisionDraft } from '../src/components/review-view';
import { ReviewQueueBody, RevisionDiff, DecisionFormView, CommentFormView, ReviewersPanelView, ReviewQueue, ReviewDetailScreen } from '../src/components/review';
import { ApiError } from '../src/components/api';
import { formatTime } from '../src/components/inbox-view';
import type { ReviewItem, ReviewRevision, DiffEntry, CommentView, Eligibility, EligibilityReason, DecisionView, ReviewDetail } from '../src/server/document-review';
import type { DependencyView } from '../src/server/document-dependencies';
import type { ListedDelegation, ApproverView } from '../src/server/review-delegations';
import type { DocType } from '../src/server/types';

// Every id, name and text below is synthetic.
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const DOC = U(100), PROJECT = U(200), VIEWER = U(1), AUTHOR = U(2), ALICE = U(3), BOB = U(4), READONLY = U(5);
const people = [{ id: VIEWER, name: 'Người Xem', role: 'manager' }, { id: AUTHOR, name: 'Tác Giả', role: 'engineer' }, { id: ALICE, name: 'An Nhận Xét', role: 'technical' },
  { id: BOB, name: 'Bình Duyệt', role: 'business' }, { id: READONLY, name: 'Chỉ Đọc', role: 'viewer' }];

const rev = (o: Partial<ReviewRevision> = {}): ReviewRevision => ({ id: U(300), revisionNo: 2, basedOnRevisionId: U(299), sourceRevision: 'abc123', sourceHash: 'a'.repeat(64), hashVerification: 'self_declared', frozen: false,
  changes: { summary: 'Tóm tắt mới', present: ['Mục còn nguyên'], missing: [] }, sourceRefs: [], proposedBy: AUTHOR, createdAt: '2026-11-14T01:00:00.000Z', ...o });
const base = (o: Partial<ReviewRevision> = {}): ReviewRevision => rev({ id: U(299), revisionNo: 1, basedOnRevisionId: null, changes: { summary: 'Tóm tắt cũ', present: ['Mục còn nguyên'], missing: ['Mục thiếu cũ'] }, ...o });
const ELIG: Record<string, Eligibility> = {
  none: { canComment: true, canRequestChanges: true, canApprove: true, reason: null },
  AUTHOR: { canComment: false, canRequestChanges: false, canApprove: false, reason: 'AUTHOR' },
  NO_DELEGATION: { canComment: false, canRequestChanges: false, canApprove: false, reason: 'NO_DELEGATION' },
  TYPE_NOT_COVERED: { canComment: false, canRequestChanges: false, canApprove: false, reason: 'TYPE_NOT_COVERED' },
  REVIEW_ONLY: { canComment: true, canRequestChanges: true, canApprove: false, reason: 'REVIEW_ONLY' },
  NOT_FROZEN: { canComment: true, canRequestChanges: true, canApprove: false, reason: 'NOT_FROZEN' },
  ALREADY_DECIDED: { canComment: false, canRequestChanges: false, canApprove: false, reason: 'ALREADY_DECIDED' },
};
const decision = (result: DecisionView['result']): DecisionView => ({ id: U(400), result, revisionId: U(300), revisionNo: 2, revisionHash: 'a'.repeat(64), scopeNote: 'Ghi chú phạm vi đã quyết', exceptions: [], decidedBy: BOB, decidedAt: '2026-11-14T03:00:00.000Z' });
const item = (o: Partial<ReviewItem> = {}): ReviewItem => ({ documentId: DOC, projectId: PROJECT, refCode: 'TL-001', title: 'Tài liệu thiết kế', docType: 'design', recordVersion: 7, approvedRevisionId: null,
  revision: rev(), approverState: 'assigned', eligibility: ELIG.none, decision: null, ...o });
const comment = (o: Partial<CommentView> = {}): CommentView => ({ id: U(500), parentId: null, kind: 'comment', anchor: 'summary', body: 'Cần làm rõ phạm vi', actorId: ALICE, revisionId: U(300), createdAt: '2026-11-14T02:00:00.000Z', ...o });
const entry = (o: Partial<DiffEntry>): DiffEntry => ({ field: 'summary', change: 'modified', before: 'Tóm tắt cũ', after: 'Tóm tắt mới', ...o });
const link = (o: Partial<DependencyView> = {}): DependencyView => ({ id: U(600), upstreamDocumentId: DOC, upstreamRevisionId: U(300), dependentDocumentId: U(101), note: 'Phụ thuộc vào bản thiết kế', needsReview: true, flaggedRevisionId: U(300), flaggedAt: '2026-11-14T02:30:00.000Z', version: 1, ...o });
const mine = (o: Partial<ListedDelegation> = {}): ListedDelegation => ({ id: U(700), projectId: PROJECT, delegateId: ALICE, docTypes: ['design', 'plan'], grantedBy: VIEWER, basis: 'Căn cứ chỉ định hợp lệ', revokedAt: null, revokedBy: null,
  revokeBasis: null, version: 3, createdAt: '2026-11-13T01:00:00.000Z', designatorIsCoordinator: true, dormant: false, ...o });
const hidden = (o: Partial<ListedDelegation> = {}): ListedDelegation => ({ id: U(701), delegateId: BOB, docTypes: ['requirements'], projectId: null, grantedBy: null, basis: null, revokedAt: null, revokedBy: null, revokeBasis: null,
  version: null, createdAt: null, designatorIsCoordinator: null, dormant: null, ...o });

const diffProps = (o: Partial<Parameters<typeof RevisionDiff>[0]> = {}) => ({ base: base(), candidate: rev(), diff: [entry({})], affectedLinks: [], comments: [], sourceChanged: false, changedOnly: true, ...o });
const html = (o: Partial<Parameters<typeof RevisionDiff>[0]> = {}) => renderToStaticMarkup(<RevisionDiff {...diffProps(o)} />);

// Drives hook-free views like a browser would: render, find a control, call its handler, render again.
type Host = { type: string; props: Record<string, unknown> & { children?: ReactNode } };
function hosts(node: ReactNode, out: Host[] = []): Host[] {
  if (node == null || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') return out;
  if (Array.isArray(node)) { for (const n of node) hosts(n, out); return out; }
  if (!isValidElement(node)) return out;
  const el = node as ReactElement<Host['props']>;
  if (typeof el.type === 'string') { out.push({ type: el.type, props: el.props }); hosts(el.props.children, out); }
  else if (el.type === Fragment) hosts(el.props.children, out);
  else if (typeof el.type === 'function') { let r: ReactNode; try { r = (el.type as (p: unknown) => ReactNode)(el.props); } catch { return out; } hosts(r, out); }
  return out;
}
const textOf = (n: ReactNode): string => n == null || typeof n === 'boolean' ? '' : typeof n === 'string' || typeof n === 'number' ? String(n)
  : Array.isArray(n) ? n.map(textOf).join('') : isValidElement(n) ? textOf((n.props as { children?: ReactNode }).children) : '';
const buttonsOf = (n: ReactNode) => hosts(n).filter(h => h.type === 'button').map(h => textOf(h.props.children));

function driveActions(it: ReviewItem) {
  let draft: DecisionDraft = { scopeNote: '', exceptions: '' };
  const sent: unknown[] = [], errors: string[] = [];
  const view = () => <><DecisionFormView item={it} draft={draft} busy={false} error="" onDraft={p => { draft = { ...draft, ...p }; }} onSubmit={c => { sent.push(c); }} onInvalid={m => { errors.push(m); }} />
    <CommentFormView item={it} draft={{ body: '', anchor: '' }} busy={false} error="" onDraft={() => {}} onSubmit={() => {}} onInvalid={() => {}} /></>;
  return { view, html: () => renderToStaticMarkup(view()), buttons: () => buttonsOf(view()), sent, errors, fields: () => hosts(view()).filter(h => ['textarea', 'input', 'select'].includes(h.type)).map(h => h.props.name),
    type: (name: string, value: string) => { const f = hosts(view()).find(h => h.props.name === name); if (!f) throw new Error('no field ' + name); (f.props.onChange as (e: unknown) => void)({ target: { value }, currentTarget: { value } }); },
    click: (label: string) => { const b = hosts(view()).find(h => h.type === 'button' && textOf(h.props.children) === label); if (!b) throw new Error('no button ' + label); (b.props.onClick as () => void)(); } };
}

type PanelOver = Partial<Parameters<typeof ReviewersPanelView>[0]>;
function drivePanel(over: PanelOver = {}) {
  let draft: PanelDraft = { delegateId: '', docTypes: [], basis: '', revokeId: null, revokeBasis: '' };
  const granted: unknown[] = [], revoked: unknown[] = [], errors: string[] = [];
  const view = () => <ReviewersPanelView reviewers={[]} approvers={[]} people={people} viewerId={VIEWER} canDesignate busy={false} error="" notice="" reloadable={false} localError=""
    draft={draft} onDraft={p => { draft = { ...draft, ...p }; }} onGrant={c => { granted.push(c); }} onRevoke={c => { revoked.push(c); }} onInvalid={m => { errors.push(m); }} {...over} />;
  return { html: () => renderToStaticMarkup(view()), buttons: () => buttonsOf(view()), granted, revoked, errors, draft: () => draft,
    options: () => { const s = hosts(view()).find(h => h.props.name === 'delegateId'); return hosts(s?.props.children).filter(h => h.type === 'option').map(h => h.props.value); },
    set: (name: string, value: unknown) => { const f = hosts(view()).find(h => h.props.name === name); if (!f) throw new Error('no field ' + name); (f.props.onChange as (e: unknown) => void)({ target: { value, checked: true }, currentTarget: { value, checked: true } }); },
    click: (label: string, nth = 0) => { const bs = hosts(view()).filter(h => h.type === 'button' && textOf(h.props.children) === label); if (!bs[nth]) throw new Error('no button ' + label); (bs[nth].props.onClick as () => void)(); } };
}

describe('review UI', () => {
  it('renders the four states: empty, error, loading and denied, with different wording for empty and denied', () => {
    const body = (state: Parameters<typeof ReviewQueueBody>[0]['state']) => renderToStaticMarkup(<ReviewQueueBody state={state} items={[]} total={0} error="Lỗi mạng" projectLabel="Dự án Bí Mật" onRetry={() => {}} />);
    expect(body('loading')).toContain('aria-busy="true"');
    expect(body('loading')).not.toContain('>0<');
    expect(body('empty')).toContain('Dự án này chưa có tài liệu nào có bản để review.');
    expect(body('empty')).not.toMatch(/chờ|chưa có quyền/);
    expect(body('error')).toContain('role="alert"');
    expect(body('error')).toContain('Không tải được danh sách review. Dữ liệu đã lưu không bị thay đổi.');
    expect(body('error')).toContain('Thử lại');
    expect(body('denied')).toContain('Anh/chị chưa có quyền xem phần review của dự án này.');
    expect(body('denied')).not.toContain('Chưa có tài liệu');
    expect(EMPTY_COPY).toBe('Dự án này chưa có tài liệu nào có bản để review.');
    expect(DENIED_COPY).toBe('Anh/chị chưa có quyền xem phần review của dự án này.');
    expect(ERROR_COPY).toContain('Dữ liệu đã lưu không bị thay đổi');
    expect(reviewPageState({ loading: true, error: 'x', denied: true, rows: 0 })).toBe('loading');
    expect(reviewPageState({ loading: false, error: 'x', denied: true, rows: 0 })).toBe('denied');
    expect(reviewPageState({ loading: false, error: 'x', denied: false, rows: 0 })).toBe('error');
    expect(reviewPageState({ loading: false, error: null, denied: false, rows: 0 })).toBe('empty');
    expect(reviewPageState({ loading: false, error: null, denied: false, rows: 2 })).toBe('ready');
  });

  it('the denied view leaks no project name and no count', () => {
    const denied = renderToStaticMarkup(<ReviewQueue projects={[{ id: PROJECT, name: 'Dự án Bí Mật' }]} projectId={PROJECT} initial={{ items: [item()], total: 41 }} denied delegations={null} people={people} viewerId={VIEWER} />);
    expect(denied).toContain(DENIED_COPY);
    expect(denied).not.toContain('Dự án Bí Mật');
    expect(denied).not.toContain('Tài liệu thiết kế');
    expect(denied).not.toContain('41');
  });

  it('Conflict: a stale decision shows the source-changed banner with Đọc bản mới and keeps the typed note', () => {
    const out = html({ sourceChanged: true, onReload: () => {} });
    expect(out).toContain('Nguồn đã đổi trong lúc anh/chị đang xem. Phiếu chưa được ghi.');
    expect(out).toContain('Đọc bản mới');
    expect(html({ sourceChanged: false })).not.toContain('Đọc bản mới');
    expect(commandErrorCopy('REVISION_CONFLICT')).toBe(CONFLICT_COPY);
    expect(CONFLICT_COPY).toBe('Nguồn đã đổi trong lúc anh/chị đang xem. Phiếu chưa được ghi.');
    const form = renderToStaticMarkup(<DecisionFormView item={item()} draft={{ scopeNote: 'Ghi chú đang gõ dở', exceptions: 'Ngoại lệ một' }} busy={false} error={CONFLICT_COPY} onDraft={() => {}} onSubmit={() => {}} onInvalid={() => {}} />);
    expect(form).toContain('Ghi chú đang gõ dở');
    expect(form).toContain('Ngoại lệ một');
    expect(form).toContain('role="alert"');
  });

  it('an already decided revision shows its own conflict sentence', () => {
    expect(commandErrorCopy('REVIEW_ALREADY_DECIDED')).toBe('Bản này đã có quyết định. Muốn quyết lại cần một bản mới.');
    expect(commandErrorCopy('REVIEW_ALREADY_DECIDED')).not.toBe(CONFLICT_COPY);
    expect(DECIDED_COPY).toBe(eligibilityCopy('ALREADY_DECIDED'));
  });

  it('a queue item without approver shows Chờ xác định người duyệt', () => {
    const out = renderToStaticMarkup(<ReviewQueueBody state="ready" items={[item({ approverState: 'unassigned' })]} total={1} error={null} projectLabel="P" />);
    expect(out).toContain('Chờ xác định người duyệt');
    expect(approverCopy('unassigned')).toBe('Chờ xác định người duyệt');
    expect(approverCopy('assigned')).toBe('Đã có người duyệt');
    expect(renderToStaticMarkup(<ReviewQueueBody state="ready" items={[item()]} total={1} error={null} projectLabel="P" />)).not.toContain('Chờ xác định người duyệt');
  });

  it('each eligibility reason renders its sentence and hides the buttons it forbids', () => {
    const sentences: Record<EligibilityReason, string> = {
      AUTHOR: 'Anh/chị là tác giả của bản này nên không tự duyệt.',
      NO_DELEGATION: 'Anh/chị chưa được chỉ định review tài liệu của dự án này.',
      REVIEW_ONLY: 'Anh/chị được chỉ định nhận xét, chưa được chỉ định duyệt bản chuẩn.',
      TYPE_NOT_COVERED: 'Uỷ quyền của anh/chị không gồm loại tài liệu này.',
      NOT_FROZEN: 'Nguồn chưa đóng băng nên chưa duyệt thành bản chuẩn được. Anh/chị vẫn có thể nhận xét hoặc yêu cầu sửa.',
      ALREADY_DECIDED: 'Bản này đã có quyết định. Muốn quyết lại cần một bản mới.',
    };
    for (const [reason, sentence] of Object.entries(sentences) as [EligibilityReason, string][]) {
      expect(eligibilityCopy(reason)).toBe(sentence);
      const d = driveActions(item({ eligibility: ELIG[reason] }));
      expect(d.html()).toContain(sentence);
      const e = ELIG[reason];
      expect(d.buttons().sort()).toEqual([e.canApprove && 'Chấp thuận', e.canRequestChanges && 'Yêu cầu sửa', e.canComment && 'Gửi nhận xét'].filter(Boolean).sort());
    }
    expect(eligibilityCopy(null)).toBe('');
    const none = driveActions(item({ eligibility: ELIG.none })).html();
    for (const s of Object.values(sentences)) expect(none).not.toContain(s);
    expect(driveActions(item({ eligibility: ELIG.none })).buttons().sort()).toEqual(['Chấp thuận', 'Gửi nhận xét', 'Yêu cầu sửa']);
  });

  it('buttons follow the service\'s eligibility and nothing else', () => {
    for (const canComment of [false, true]) for (const canRequestChanges of [false, true]) for (const canApprove of [false, true]) {
      const d = driveActions(item({ eligibility: { canComment, canRequestChanges, canApprove, reason: null } }));
      expect(d.buttons().sort(), JSON.stringify({ canComment, canRequestChanges, canApprove }))
        .toEqual([canApprove && 'Chấp thuận', canRequestChanges && 'Yêu cầu sửa', canComment && 'Gửi nhận xét'].filter(Boolean).sort());
      if (!canApprove && !canRequestChanges) expect(d.fields()).not.toContain('scopeNote');
    }
    // a designation is never a right to approve: an item whose service answer cannot approve offers no approval, whatever the document is
    expect(driveActions(item({ eligibility: ELIG.REVIEW_ONLY, approverState: 'unassigned' })).buttons()).not.toContain('Chấp thuận');
  });

  it('a decision sends the revision, hash and version shown; a short note is refused in place', () => {
    const d = driveActions(item());
    d.click('Yêu cầu sửa');
    expect(d.sent).toEqual([]);
    expect(d.errors).toEqual(['Ghi chú phạm vi cần ít nhất 5 ký tự.']);
    d.type('scopeNote', '  Cần bổ sung phạm vi  ');
    d.type('exceptions', 'Một\n\n  Hai  ');
    d.click('Chấp thuận');
    expect(d.sent).toEqual([{ result: 'approved', scopeNote: 'Cần bổ sung phạm vi', exceptions: ['Một', 'Hai'] }]);
    expect(decisionCommand('approved', { scopeNote: 'x'.repeat(1001), exceptions: '' })).toEqual({ ok: false, error: 'Ghi chú phạm vi tối đa 1000 ký tự.' });
    expect(decisionCommand('approved', { scopeNote: 'hợp lệ', exceptions: Array(11).fill('a').join('\n') })).toEqual({ ok: false, error: 'Tối đa 10 ngoại lệ.' });
    const it = item();
    expect(decisionBody(it, { result: 'changes_requested', scopeNote: 'Ghi chú đủ dài', exceptions: [] })).toEqual({
      revisionId: it.revision.id, sourceHash: it.revision.sourceHash, expectedVersion: it.recordVersion, result: 'changes_requested', scopeNote: 'Ghi chú đủ dài', exceptions: [] });
  });

  it('request bodies carry only the fields the service takes and never an actor, tenant, authority or request id', () => {
    const it = item();
    const bodies: Record<string, unknown>[] = [
      decisionBody(it, { result: 'approved', scopeNote: 'Ghi chú đủ dài', exceptions: [] }),
      commentBody(it, { body: 'Nhận xét', anchor: 'summary' }), replyBody('addressed', U(500), 'Đã sửa xong'),
      grantBody(PROJECT, { delegateId: ALICE, docTypes: ['design'], basis: 'Căn cứ hợp lệ' }), revokeBody({ expectedVersion: 3, basis: 'Căn cứ thu hồi' }),
    ];
    expect(Object.keys(bodies[0]).sort()).toEqual(['exceptions', 'expectedVersion', 'result', 'revisionId', 'scopeNote', 'sourceHash']);
    expect(bodies[1]).toEqual({ kind: 'comment', revisionId: it.revision.id, anchor: 'summary', body: 'Nhận xét' });
    expect(bodies[2]).toEqual({ kind: 'addressed', parentId: U(500), body: 'Đã sửa xong' });
    expect(bodies[3]).toEqual({ projectId: PROJECT, delegateId: ALICE, docTypes: ['design'], basis: 'Căn cứ hợp lệ' });
    expect(bodies[4]).toEqual({ expectedVersion: 3, basis: 'Căn cứ thu hồi' });
    for (const b of bodies) for (const k of Object.keys(b)) expect(k).not.toMatch(/actor|tenant|authority|requestId|delegationId|grantedBy|role/i);
    expect(Object.keys(bodies[0])).not.toContain('projectId');
  });

  it('one Idempotency-Key per user action, reused on a retry and renewed after a success', async () => {
    const store = { current: null as null | { fingerprint: string; key: string } };
    const body = { a: 1 };
    const k1 = idempotencyKey(store, body);
    expect(idempotencyKey(store, { a: 1 })).toBe(k1);
    expect(idempotencyKey(store, { a: 2 })).not.toBe(k1);
    const k3 = idempotencyKey(store, { a: 2 });
    store.current = null;
    expect(idempotencyKey(store, { a: 2 })).not.toBe(k3);
    const calls: { url: string; init: RequestInit }[] = [];
    const ok = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ data: { fine: 1 } }) }; }) as unknown as typeof fetch;
    expect(await postReview('/api/reviews/x/comments', body, 'key-1', ok)).toEqual({ fine: 1 });
    expect((calls[0].init.headers as Record<string, string>)['Idempotency-Key']).toBe('key-1');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(calls[0].init.body as string)).toEqual(body);
    const bad = (async () => ({ ok: false, status: 404, json: async () => ({ error: { code: 'SCOPE_DENIED', message: 'Không tìm thấy tài liệu trong phạm vi được cấp.' } }) })) as unknown as typeof fetch;
    await expect(postReview('/api/reviews/x/comments', body, 'key-2', bad)).rejects.toMatchObject({ code: 'SCOPE_DENIED', status: 404 });
  });

  it('error copy: the 404 sentence offers a reload, an unknown code shows the server message as text, never an object', () => {
    const notFound = describeError(new ApiError('Không tìm thấy tài liệu trong phạm vi được cấp. [SCOPE_DENIED]', 'SCOPE_DENIED', 404));
    expect(notFound).toEqual({ text: NOT_FOUND_COPY, reloadable: true, code: 'SCOPE_DENIED' });
    expect(NOT_FOUND_COPY).toBe('Không tìm thấy tài liệu trong phạm vi được cấp.');
    expect(describeError(new ApiError('Câu lạ của máy chủ [X_NEW]', 'X_NEW', 500))).toEqual({ text: 'Câu lạ của máy chủ [X_NEW]', reloadable: false, code: 'X_NEW' });
    for (const odd of [{ a: 1 }, null, undefined, 42, ['x']]) { const t = describeError(odd).text; expect(t).not.toContain('[object'); expect(t).not.toContain('{'); expect(t.length).toBeGreaterThan(5); }
    expect(commandErrorCopy('DELEGATION_CONFLICT')).toBe('Uỷ quyền này đã thay đổi. Tải lại để xem trạng thái mới.');
    expect(commandErrorCopy('DELEGATION_EXISTS')).toBe('Người này đã là người nhận xét của dự án.');
    expect(describeError(new ApiError('x', 'DELEGATION_CONFLICT', 409)).reloadable).toBe(true);
    expect(commandErrorCopy('SOMETHING_ELSE')).toBe('');
  });

  it('a decided revision offers no new comment and no decision, but keeps the follow-up actions on existing comments', () => {
    const decided = item({ eligibility: ELIG.ALREADY_DECIDED, decision: decision('changes_requested') });
    const detail: ReviewDetail = { item: decided, base: base(), diff: [entry({})], comments: [comment()] };
    const out = renderToStaticMarkup(<ReviewDetailScreen detail={detail} affectedLinks={[]} people={people} />);
    expect(out).toContain('Cần làm rõ phạm vi');
    expect(out).toContain('Đã sửa');
    expect(out).toContain('Xác nhận đã xử lý');
    expect(out).not.toContain('Gửi nhận xét');
    expect(out).not.toContain('Chấp thuận');
    expect(out).not.toContain('Yêu cầu sửa</button>');
    expect(out).toContain('Bản này đã có quyết định. Muốn quyết lại cần một bản mới.');
    expect(out).toContain('Ghi chú phạm vi đã quyết');
    // the same revision undecided offers the forms
    const open = renderToStaticMarkup(<ReviewDetailScreen detail={{ ...detail, item: item() }} affectedLinks={[]} people={people} />);
    expect(open).toContain('Gửi nhận xét');
    expect(open).toContain('Chấp thuận');
  });

  it('a queue row names the decision state and a requested change reads as a used decision slot', () => {
    const rows = (d: DecisionView | null) => renderToStaticMarkup(<ReviewQueueBody state="ready" items={[item({ decision: d, eligibility: d ? ELIG.ALREADY_DECIDED : ELIG.none })]} total={1} error={null} projectLabel="P" />);
    expect(decisionStateLabel(null)).toBe('Chưa có quyết định');
    expect(decisionStateLabel(decision('approved'))).toBe('Đã chấp thuận');
    expect(decisionStateLabel(decision('changes_requested'))).toBe('Yêu cầu sửa');
    expect(rows(null)).toContain('Chưa có quyết định');
    expect(rows(null)).not.toContain('Bản này đã có quyết định');
    expect(rows(decision('approved'))).toContain('Đã chấp thuận');
    const changed = rows(decision('changes_requested'));
    expect(changed).toContain('Yêu cầu sửa');
    expect(changed).toContain('Bản này đã có quyết định. Muốn quyết lại cần một bản mới.');
    expect(changed).not.toContain('Chưa có quyết định');
  });

  it('RevisionDiff labels every change with Thêm, Xóa or Sửa and shows base and candidate revision numbers', () => {
    expect(diffLabel('added')).toBe('Thêm'); expect(diffLabel('removed')).toBe('Xóa'); expect(diffLabel('modified')).toBe('Sửa');
    const out = html({ diff: [entry({ change: 'added', before: null, after: 'Mục mới' }), entry({ field: 'missing', change: 'removed', before: 'Mục bỏ', after: null }), entry({})] });
    for (const l of ['Thêm', 'Xóa', 'Sửa']) expect(out).toContain('>' + l + '<');
    expect(out).toContain('r1');
    expect(out).toContain('r2');
    expect(html({ base: null })).toContain('Chưa có bản nền');
  });

  it('changed-only mode hides unchanged fields and full mode shows them', () => {
    const c = rev({ changes: { summary: 'Tóm tắt mới', present: ['Mục còn nguyên khóa'], missing: [] }, sourceRevision: 'giữ-nguyên-rev' });
    expect(html({ candidate: c, changedOnly: true })).not.toContain('Mục còn nguyên khóa');
    expect(html({ candidate: c, changedOnly: true })).not.toContain('giữ-nguyên-rev');
    expect(html({ candidate: c, changedOnly: false })).toContain('Mục còn nguyên khóa');
    expect(html({ candidate: c, changedOnly: false })).toContain('giữ-nguyên-rev');
    const out = html({ onMode: () => {} });
    expect(out).toContain('Chỉ phần đổi'); expect(out).toContain('Xem đầy đủ');
  });

  it('flagged dependents are listed under Tài liệu phụ thuộc cần xem lại', () => {
    const out = html({ affectedLinks: [link(), link({ id: U(601), needsReview: false, note: 'Liên kết sạch' })], documentId: DOC });
    expect(out).toContain('Tài liệu phụ thuộc cần xem lại');
    expect(out).toContain('Phụ thuộc vào bản thiết kế');
    expect(out).not.toContain('Liên kết sạch');
    expect(out).toContain('href="/review/' + U(101) + '"');
    expect(html({ affectedLinks: [] })).not.toContain('Tài liệu phụ thuộc cần xem lại');
  });

  it('self-declared hashes are never shown as verified', () => {
    expect(hashLabel('self_declared')).toBe('tự khai — chưa kiểm');
    expect(hashLabel('verified')).toBe('đã kiểm');
    const self = html({ candidate: rev({ hashVerification: 'self_declared' }) });
    expect(self).toContain('tự khai — chưa kiểm');
    expect(self).not.toContain('đã kiểm');
    const ver = html({ candidate: rev({ hashVerification: 'verified' }) });
    expect(ver).toContain('đã kiểm');
    expect(ver).not.toContain('chưa kiểm');
    expect(html({ candidate: rev({ sourceHash: null, hashVerification: 'self_declared' }) })).toContain('Chưa có hash');
  });

  it('comment bodies with markup are rendered as text', () => {
    const evil = '<script>alert(1)</script><img src=x onerror=alert(2)>';
    const out = html({ comments: [comment({ body: evil, anchor: '<b>neo</b>' })], onReply: async () => {} });
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('<b>neo</b>');
    const q = renderToStaticMarkup(<ReviewQueueBody state="ready" items={[item({ title: '<script>x</script>javascript:alert(1)' })]} total={1} error={null} projectLabel="P" />);
    expect(q).not.toContain('<script>');
    for (const m of q.matchAll(/href="([^"]*)"/g)) expect(m[1]).toMatch(/^\/review(\/[0-9a-f-]{36})?(\?projectId=[0-9a-f-]{36})?$/);
  });

  it('the reviewers panel lets only a project manager designate, never offers the viewer themself or a read-only member, and requires a document type', () => {
    const reader = drivePanel({ canDesignate: false, reviewers: [hidden()] });
    expect(reader.html()).toContain('Chỉ điều phối của dự án này chỉ định và thu hồi được người nhận xét.');
    expect(reader.html()).not.toContain('Chỉ định người nhận xét');
    expect(reader.buttons()).toEqual([]);
    expect(reader.html()).not.toContain('<form');
    const p = drivePanel();
    expect(p.html()).toContain('Chỉ định người nhận xét');
    expect(p.html()).not.toContain('Chỉ điều phối của dự án này chỉ định và thu hồi được');
    const opts = p.options();
    expect(opts).not.toContain(VIEWER);
    expect(opts).not.toContain(READONLY);
    expect(opts).toEqual(expect.arrayContaining([AUTHOR, ALICE, BOB]));
    expect(selectableMembers(people, VIEWER.toUpperCase()).map(m => m.id)).not.toContain(VIEWER);
    p.set('delegateId', ALICE);
    p.set('basis', 'Căn cứ chỉ định hợp lệ');
    p.click('Chỉ định');
    expect(p.granted).toEqual([]);
    expect(p.errors).toEqual(['Chọn ít nhất một loại tài liệu.']);
    p.set('docType:design', 'design');
    p.click('Chỉ định');
    expect(p.granted).toEqual([{ delegateId: ALICE, docTypes: ['design'], basis: 'Căn cứ chỉ định hợp lệ' }]);
    expect(grantCommand({ delegateId: '', docTypes: ['design'], basis: 'Căn cứ hợp lệ', revokeId: null, revokeBasis: '' })).toEqual({ ok: false, error: 'Chọn một thành viên.' });
    expect(grantCommand({ delegateId: ALICE, docTypes: ['design'], basis: 'abc', revokeId: null, revokeBasis: '' })).toEqual({ ok: false, error: 'Căn cứ cần từ 5 đến 500 ký tự.' });
  });

  it('the approver list shows the types read from document_approvers', () => {
    const approvers: ApproverView[] = [{ userId: BOB, docTypes: ['design', 'plan'] }];
    const out = drivePanel({ canDesignate: false, approvers, people: people.map(p => ({ ...p })) }).html();
    expect(out).toContain('Bình Duyệt');
    expect(out).toContain('Thiết kế');
    expect(out).toContain('Kế hoạch');
    for (const other of ['Hướng dẫn', 'Kiểm chứng', 'Yêu cầu', 'Mục lục dự án', 'Phiếu thay đổi']) expect(out).not.toContain(other);
    expect(out).not.toContain('Chờ xác định người duyệt');
    expect(drivePanel({ canDesignate: false, approvers: [] }).html()).toContain('Chờ xác định người duyệt');
    expect(out).toContain('Quyền duyệt bản chuẩn không chỉ định ở đây: quyền này cấp qua phiếu đổi quyền, cần một thành viên BoM đồng ý, ở trang Quản trị tài khoản.');
  });

  it('OQ-34 only a project manager sees Thu hồi, and a revoke needs a basis', () => {
    const live = mine(), gone = mine({ id: U(702), delegateId: BOB, revokedAt: '2026-11-14T05:00:00.000Z', revokedBy: VIEWER, revokeBasis: 'Hết nhiệm vụ', version: 4 });
    // not a coordinator, even for the designated person's own row
    const own = drivePanel({ canDesignate: false, viewerId: ALICE, reviewers: [live] });
    expect(own.buttons()).toEqual([]);
    expect(own.html()).not.toContain('Thu hồi');
    // coordinator: the live row has the button, the revoked row does not
    const c = drivePanel({ reviewers: [live, gone] });
    expect(c.buttons().filter(b => b === 'Thu hồi')).toHaveLength(1);
    expect(c.html()).toContain('Đã thu hồi');
    expect(c.html()).toContain('Hết nhiệm vụ');
    expect(c.html()).toContain('Muốn đổi loại tài liệu của một người: thu hồi rồi chỉ định lại.');
    c.click('Thu hồi');
    expect(c.draft().revokeId).toBe(live.id);
    expect(c.html()).toContain('Căn cứ thu hồi');
    expect(c.buttons()).toContain('Xác nhận thu hồi');
    c.set('revokeBasis', 'abc');
    c.click('Xác nhận thu hồi');
    expect(c.revoked).toEqual([]);
    expect(c.errors).toEqual(['Căn cứ cần từ 5 đến 500 ký tự.']);
    c.set('revokeBasis', 'Căn cứ thu hồi đủ dài');
    c.click('Xác nhận thu hồi');
    expect(c.revoked).toEqual([{ delegationId: live.id, expectedVersion: 3, basis: 'Căn cứ thu hồi đủ dài' }]);
    expect(revokeCommand(live, '   ab   ')).toEqual({ ok: false, error: 'Căn cứ cần từ 5 đến 500 ký tự.' });
    // a conflict shows its sentence with the reload button and keeps the basis the user typed
    const conflict = drivePanel({ reviewers: [live], error: commandErrorCopy('DELEGATION_CONFLICT'), reloadable: true, onReload: () => {} });
    conflict.click('Thu hồi'); conflict.set('revokeBasis', 'Căn cứ đang gõ dở');
    const out = conflict.html();
    expect(out).toContain('Uỷ quyền này đã thay đổi. Tải lại để xem trạng thái mới.');
    expect(out).toContain('Tải lại');
    expect(out).toContain('Căn cứ đang gõ dở');
    expect(drivePanel({ notice: 'Đã thu hồi. Người này không còn nhận xét được từ lệnh kế tiếp; nhận xét và quyết định đã ghi vẫn giữ nguyên.' }).html()).toMatch(/role="status"[^>]*>Đã thu hồi\./);
  });

  it('the reviewers panel has no control that touches document approval', () => {
    const out = drivePanel({ reviewers: [mine()], approvers: [] }).html();
    expect(out).not.toContain('doc_approve:');
    expect(out).not.toContain('Chấp thuận');
    expect(out).not.toContain('Trình phiếu');
    expect(out).toContain('phiếu đổi quyền');
    expect(out).toContain('Chờ xác định người duyệt');
    const p = drivePanel({ reviewers: [mine()] });
    expect(p.buttons().sort()).toEqual(['Chỉ định', 'Thu hồi']);
    expect(hosts(<ReviewersPanelView reviewers={[]} approvers={[]} people={people} viewerId={VIEWER} canDesignate busy={false} error="" notice="" reloadable={false} localError="" draft={{ delegateId: '', docTypes: [], basis: '', revokeId: null, revokeBasis: '' }}
      onDraft={() => {}} onGrant={() => {}} onRevoke={() => {}} onInvalid={() => {}} />).every(h => !String(h.props.value ?? '').startsWith('doc_approve:') && !String(h.props.name ?? '').includes('approve'))).toBe(true);
  });

  it('a reader who is not a coordinator sees other reviewers as person and document types only', () => {
    const own = mine({ delegateId: ALICE.toUpperCase(), basis: 'Căn cứ của chính tôi', designatorIsCoordinator: null, dormant: null });
    const out = drivePanel({ canDesignate: false, viewerId: ALICE, reviewers: [own, hidden({ docTypes: ['requirements', 'guide'] })] }).html();
    expect(out).toContain('Bình Duyệt');
    expect(out).toContain('Yêu cầu');
    expect(out).toContain('Hướng dẫn');
    expect(out).not.toMatch(/null|undefined|NaN|Invalid Date/);
    expect(out).not.toContain('người chỉ định không còn là điều phối');
    expect(out).not.toContain('đang ngủ');
    expect(out).not.toContain('Thu hồi');
    expect(out.split('Chỉ định lúc').length - 1).toBe(1);   // only the viewer's own row carries a date
    expect(out).toMatch(/<bdi dir="auto">Căn cứ của chính tôi<\/bdi>/);
    expect(out.split('<bdi').length - 1).toBe(1);
  });

  it('only a coordinator sees người chỉ định không còn là điều phối and đang ngủ, and only for the strict booleans', () => {
    const rows = [mine({ id: U(710), delegateId: ALICE, designatorIsCoordinator: false, dormant: null }), mine({ id: U(711), delegateId: BOB, designatorIsCoordinator: true, dormant: true }),
      mine({ id: U(712), delegateId: AUTHOR, designatorIsCoordinator: null, dormant: null })];
    const c = drivePanel({ reviewers: rows });
    const out = c.html();
    expect(out.split('người chỉ định không còn là điều phối').length - 1).toBe(1);
    expect(out.split('đang ngủ').length - 1).toBe(1);
    expect(c.buttons().filter(b => b === 'Thu hồi')).toHaveLength(3);   // a dormant row that is not revoked keeps its button
    const nulls = drivePanel({ reviewers: [rows[2]] }).html();
    expect(nulls).not.toContain('người chỉ định không còn là điều phối');
    expect(nulls).not.toContain('đang ngủ');
    const plain = drivePanel({ canDesignate: false, viewerId: U(99), reviewers: rows }).html();
    expect(plain).not.toContain('người chỉ định không còn là điều phối');
    expect(plain).not.toContain('đang ngủ');
  });

  it('a basis with markup or bidirectional characters is rendered as text inside bdi', () => {
    const basis = '<img src=x onerror=alert(1)> ‮abc​ <script>x</script>';
    const out = drivePanel({ canDesignate: false, viewerId: ALICE, reviewers: [mine({ basis })] }).html();
    expect(out).not.toContain('<img');
    expect(out).not.toContain('<script>');
    expect(out).toMatch(/<bdi dir="auto">&lt;img src=x onerror=alert\(1\)&gt; ‮abc​ &lt;script&gt;x&lt;\/script&gt;<\/bdi>/);
    // a coordinator sees every basis the same way
    expect(drivePanel({ reviewers: [mine({ basis })] }).html()).toMatch(/<bdi dir="auto">&lt;img/);
  });

  it('shows another person\'s basis to nobody but a coordinator, even when the component is handed one', () => {
    const handed = hidden({ basis: 'Căn cứ của người khác', revokeBasis: 'Căn cứ thu hồi của người khác' });
    const reader = drivePanel({ canDesignate: false, viewerId: VIEWER, reviewers: [handed] }).html();
    expect(reader).not.toContain('Căn cứ của người khác');
    expect(reader).not.toContain('Căn cứ thu hồi của người khác');
    expect(drivePanel({ reviewers: [{ ...handed, version: 2, createdAt: '2026-11-13T01:00:00.000Z' }] }).html()).toContain('Căn cứ của người khác');
  });

  it('review CSS keeps one column below 950px, wraps long strings and gives actions 44px', async () => {
    const css = await readFile('src/app/globals.css', 'utf8');
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules: { selector: string; body: string; media: string }[] = [];
    const re = /(@media[^{]+)\{|([^{}@]+)\{([^{}]*)\}|\}/g;
    let media = '';
    for (const m of stripped.matchAll(re)) {
      if (m[1]) media = m[1].trim();
      else if (m[2]) rules.push({ selector: m[2].trim(), body: m[3], media });
      else media = '';
    }
    const review = rules.filter(r => /\.review-/.test(r.selector));
    expect(review.length).toBeGreaterThan(10);
    const diff = review.filter(r => /\.review-diff(?![\w-])/.test(r.selector));
    expect(diff.length).toBeGreaterThan(0);
    const tracks = (body: string) => { const m = /grid-template-columns\s*:\s*([^;}]+)/.exec(body); if (!m) return 0;
      const v = m[1].trim(); const rep = /^repeat\(\s*(\d+)/.exec(v); return rep ? Number(rep[1]) : v.replace(/minmax\([^)]*\)/g, 'T').split(/\s+/).length; };
    for (const r of diff) if (tracks(r.body) > 1) expect(r.media).toContain('min-width:950px');
    expect(diff.some(r => r.media.includes('min-width:950px') && /grid-template-columns/.test(r.body))).toBe(true);
    for (const r of review) for (const m of r.body.matchAll(/(?:^|;)\s*(?:min-|max-)?width\s*:\s*(\d+)px/g)) expect(Number(m[1]), r.selector).toBeLessThanOrEqual(328);
    const textual = ['review-title', 'review-text', 'review-meta', 'review-comment', 'review-person-name', 'review-change', 'review-person', 'review-notice', 'review-problem'];
    for (const cls of textual) expect(review.some(r => r.selector.split(',').map(x => x.trim()).includes('.' + cls) && /overflow-wrap\s*:\s*anywhere/.test(r.body)), cls).toBe(true);
    expect(review.some(r => /\.review-action/.test(r.selector) && /min-height\s*:\s*44px/.test(r.body))).toBe(true);
    // the new rules are the only ones this task adds: nothing outside review-* is declared after the marker
    const marker = css.indexOf('/* Review (.review-*)');
    expect(marker).toBeGreaterThan(0);
    const tail = css.slice(marker).replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '');
    for (const m of tail.matchAll(/(?:^|\})\s*([^{}]+)\{/g)) for (const s of m[1].split(',')) expect(s.trim(), s).toMatch(/^\.review-/);
  });
});
