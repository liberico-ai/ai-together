import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { reassignmentLabel, reviewLabels, voteBlockCopy, voteBody, voteCommand, describeVoteError, voteFailure, voteRecorded, decisionsPageState,
  EMPTY_COPY, DENIED_COPY, ERROR_COPY, CONFLICT_COPY, ACCOUNTS_COPY } from '../src/components/decisions-view';
import { eligibilityCopy } from '../src/components/review-view';
import { DecisionsBody, DecisionCardView, Decisions } from '../src/components/decisions';
import { ApiError } from '../src/components/api';
import type { ReviewCard, ReassignmentCard, DecisionCard } from '../src/server/decisions';
import type { EligibilityReason } from '../src/server/document-review';

// Every id, name and text below is synthetic.
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PROJECT = U(200), DOC = U(100), WORK = U(150), PROPOSAL = U(160), VIEWER = U(1), ALICE = U(3), BOB = U(4), GHOST = U(99);
const people = [{ id: VIEWER, name: 'Người Xem' }, { id: ALICE, name: 'An Nhận Xét' }, { id: BOB, name: 'Bình Duyệt' }];
const ELIG_OK = { canComment: true, canRequestChanges: true, canApprove: true, reason: null } as const;

const review = (o: Partial<ReviewCard> = {}): ReviewCard => ({ kind: 'document_review', decisionId: U(300), projectId: PROJECT, documentId: DOC, refCode: 'TL-001', title: 'Tài liệu thiết kế',
  revision: { id: U(300), no: 2, hash: 'a'.repeat(64), recordVersion: 7 }, summary: 'Tóm tắt thay đổi', quorum: { needed: 1, have: 0 }, votes: [], actorEligibility: { ...ELIG_OK }, expiresAt: null,
  appliedReceipt: null, state: 'open', ...o });
const reassign = (o: Partial<ReassignmentCard> = {}): ReassignmentCard => ({ kind: 'reassignment', decisionId: PROPOSAL, projectId: PROJECT, workId: WORK, workCode: 'VT-009', title: 'Chia lại việc',
  revision: { workVersion: 4 }, summary: 'Lý do chia lại', quorum: { needed: 3, have: 1 }, votes: [{ actorId: ALICE, choice: 'agree', at: '2026-11-14T02:00:00.000Z' }],
  actorEligibility: { canVote: true, reason: null }, expiresAt: '2026-11-20T02:00:00.000Z', appliedReceipt: null, state: 'pending', ...o });

const STATES: ReassignmentCard['state'][] = ['pending', 'quorum_met', 'applied', 'rejected', 'revise', 'cancelled', 'expired', 'reconcile'];
const RECEIPT = { workVersion: 5, at: '2026-11-14T05:00:00.000Z' };

const cardHtml = (card: DecisionCard, o: Partial<Parameters<typeof DecisionCardView>[0]> = {}) =>
  renderToStaticMarkup(<DecisionCardView card={card} people={people} busy={false} error="" {...o} />);

// Drives hook-free views like a browser would: render, find a control, call its handler.
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
const lineOf = (markup: string, line: string) => new RegExp('data-line="' + line + '"[^>]*>([^<]*)').exec(markup)?.[1] ?? null;
const view = (card: DecisionCard, o: Partial<Parameters<typeof DecisionCardView>[0]> = {}) => <DecisionCardView card={card} people={people} busy={false} error="" {...o} />;

describe('decisions UI', () => {
  it('renders the four states with different wording for empty and denied; denied leaks no name or count', () => {
    const body = (state: Parameters<typeof DecisionsBody>[0]['state'], cards: DecisionCard[] = []) =>
      renderToStaticMarkup(<DecisionsBody state={state} cards={cards} error="Lỗi mạng" people={people} onRetry={() => {}} />);
    expect(body('loading')).toContain('aria-busy="true"');
    expect(body('loading')).not.toContain('>0<');
    expect(body('empty')).toContain('Dự án này chưa có thẻ quyết định nào.');
    expect(body('empty')).not.toMatch(/chưa có quyền/);
    expect(body('error')).toContain('role="alert"');
    expect(body('error')).toContain('Không tải được danh sách quyết định. Dữ liệu đã lưu không bị thay đổi.');
    expect(body('error')).toContain('Thử lại');
    expect(body('denied')).toContain('Anh/chị chưa có quyền xem các quyết định của dự án này.');
    expect(body('denied')).not.toContain('chưa có thẻ quyết định');
    expect(EMPTY_COPY).toBe('Dự án này chưa có thẻ quyết định nào.');
    expect(DENIED_COPY).toBe('Anh/chị chưa có quyền xem các quyết định của dự án này.');
    expect(ERROR_COPY).toBe('Không tải được danh sách quyết định. Dữ liệu đã lưu không bị thay đổi.');
    expect(decisionsPageState({ loading: true, error: 'x', denied: true, rows: 0 })).toBe('loading');
    expect(decisionsPageState({ loading: false, error: 'x', denied: true, rows: 0 })).toBe('denied');
    expect(decisionsPageState({ loading: false, error: 'x', denied: false, rows: 0 })).toBe('error');
    expect(decisionsPageState({ loading: false, error: null, denied: false, rows: 0 })).toBe('empty');
    expect(decisionsPageState({ loading: false, error: null, denied: false, rows: 3 })).toBe('ready');
    const leak = renderToStaticMarkup(<Decisions projects={[{ id: PROJECT, name: 'Dự án Bí Mật' }]} projectId={PROJECT} initial={{ cards: [review(), reassign()] }} denied people={people} />);
    expect(leak).toContain(DENIED_COPY);
    for (const secret of ['Dự án Bí Mật', 'Tài liệu thiết kế', 'Chia lại việc', 'VT-009', 'TL-001', '1/3']) expect(leak).not.toContain(secret);
  });

  it('DOC-09 a 2/3 card reads Chưa đủ phiếu (2/3) and never Đã áp dụng', () => {
    expect(reassignmentLabel('pending', 2)).toBe('Chưa đủ phiếu (2/3)');
    expect(reassignmentLabel('pending', 0)).toBe('Chưa đủ phiếu (0/3)');
    const out = cardHtml(reassign({ quorum: { needed: 3, have: 2 }, state: 'pending' }));
    expect(lineOf(out, 'quorum')).toBe('Chưa đủ phiếu (2/3)');
    expect(out).not.toContain('Đã áp dụng');
    expect(lineOf(out, 'applied')).toBe('Chưa áp dụng');
  });

  it('quorum met without receipt reads Đủ phiếu, chưa áp dụng', () => {
    expect(reassignmentLabel('quorum_met', 3)).toBe('Đủ phiếu, chưa áp dụng');
    const out = cardHtml(reassign({ quorum: { needed: 3, have: 3 }, state: 'quorum_met', appliedReceipt: null }));
    expect(lineOf(out, 'quorum')).toBe('Đủ phiếu, chưa áp dụng');
    expect(lineOf(out, 'applied')).toBe('Chưa áp dụng');
    expect(out).not.toContain('Đã áp dụng');
  });

  it('only a receipt makes a card read Đã áp dụng', () => {
    const none = cardHtml(reassign({ quorum: { needed: 3, have: 3 }, state: 'quorum_met' }));
    expect(none).not.toContain('Đã áp dụng');
    const withReceipt = cardHtml(reassign({ quorum: { needed: 3, have: 3 }, state: 'applied', appliedReceipt: RECEIPT, actorEligibility: { canVote: false, reason: 'CLOSED' } }));
    expect(lineOf(withReceipt, 'quorum')).toBe('Đã áp dụng');
    expect(lineOf(withReceipt, 'applied')).toMatch(/^Đã áp dụng · biên nhận/);
    // review card: the baseline line follows the receipt, nothing else
    expect(reviewLabels(review({ appliedReceipt: null })).baseline).toBe('Chưa áp dụng làm bản chuẩn');
    expect(reviewLabels(review({ state: 'approved', appliedReceipt: { decisionId: U(400), approvedRevisionId: U(300), at: '2026-11-14T03:00:00.000Z' } })).baseline).toBe('Đã áp dụng làm bản chuẩn');
  });

  it('the reassignment label never reads Đã áp dụng for any state without a receipt', () => {
    const wording: Record<ReassignmentCard['state'], string> = { pending: 'Chưa đủ phiếu (1/3)', quorum_met: 'Đủ phiếu, chưa áp dụng', applied: 'Đã áp dụng', rejected: 'Từ chối',
      revise: 'Yêu cầu sửa', cancelled: 'Đã hủy', expired: 'Hết hạn', reconcile: 'Cần đối soát' };
    for (const state of STATES) {
      expect(reassignmentLabel(state, 1)).toBe(wording[state]);
      for (const receipt of [null, RECEIPT]) {
        const out = cardHtml(reassign({ state, appliedReceipt: receipt, actorEligibility: { canVote: false, reason: 'CLOSED' } }));
        const second = lineOf(out, 'applied') ?? '';
        const label = JSON.stringify({ state, receipt: receipt !== null });
        if (receipt === null) { expect(out, label).not.toContain('Đã áp dụng'); expect(second, label).toBe('Chưa áp dụng'); }
        else expect(second, label).toMatch(/^Đã áp dụng/);
        expect(lineOf(out, 'quorum'), label).not.toBeNull();
      }
    }
  });

  it('a review card shows the vote and the baseline as two lines', () => {
    expect(reviewLabels(review()).vote).toBe('Chưa có quyết định');
    expect(reviewLabels(review({ state: 'approved', quorum: { needed: 1, have: 1 } })).vote).toBe('Đã chấp thuận');
    expect(reviewLabels(review({ state: 'changes_requested' })).vote).toBe('Yêu cầu sửa');
    const out = cardHtml(review({ state: 'approved', quorum: { needed: 1, have: 1 }, votes: [{ actorId: BOB, choice: 'approved', at: '2026-11-14T03:00:00.000Z' }] }));
    expect(lineOf(out, 'vote')).toBe('Đã chấp thuận');
    expect(lineOf(out, 'baseline')).toBe('Chưa áp dụng làm bản chuẩn');
    expect(out).toContain('Bình Duyệt');
    expect(out).toContain('href="/review/' + DOC + '"');
    expect(out).toContain('Mở để review');
  });

  it('a requested change on a review card reads Yêu cầu sửa with the baseline line unchanged', () => {
    const open = cardHtml(review());
    const changed = cardHtml(review({ state: 'changes_requested', quorum: { needed: 1, have: 0 }, votes: [{ actorId: BOB, choice: 'changes_requested', at: '2026-11-14T03:00:00.000Z' }] }));
    expect(lineOf(changed, 'vote')).toBe('Yêu cầu sửa');
    expect(lineOf(changed, 'baseline')).toBe('Chưa áp dụng làm bản chuẩn');
    expect(lineOf(changed, 'baseline')).toBe(lineOf(open, 'baseline'));
    expect(changed).not.toContain('Đã áp dụng');
    // approved but the pointer moved on: the vote is still approved, the baseline is not applied
    const moved = cardHtml(review({ state: 'approved', quorum: { needed: 1, have: 1 }, appliedReceipt: null }));
    expect(lineOf(moved, 'vote')).toBe('Đã chấp thuận');
    expect(lineOf(moved, 'baseline')).toBe('Chưa áp dụng làm bản chuẩn');
  });

  it('a card the viewer cannot act on shows the reason and no vote button', () => {
    const block: Record<string, string> = { ALREADY_VOTED: 'Anh/chị đã bỏ phiếu cho phiếu này.', CLOSED: 'Vòng xác nhận đã kết thúc.', EXPIRED: 'Phiếu đã hết hạn.' };
    for (const [reason, sentence] of Object.entries(block)) {
      expect(voteBlockCopy(reason as ReassignmentCard['actorEligibility']['reason'])).toBe(sentence);
      const out = cardHtml(reassign({ actorEligibility: { canVote: false, reason: reason as 'CLOSED' } }));
      expect(out).toContain(sentence);
      expect(buttonsOf(view(reassign({ actorEligibility: { canVote: false, reason: reason as 'CLOSED' } })))).toEqual([]);
    }
    expect(voteBlockCopy(null)).toBe('');
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
      const card = review({ actorEligibility: { canComment: false, canRequestChanges: false, canApprove: false, reason } });
      expect(cardHtml(card)).toContain(sentence);
      // a review card never has a decision button here: only the link
      expect(buttonsOf(view(card))).toEqual([]);
    }
    expect(buttonsOf(view(review()))).toEqual([]);
    expect(cardHtml(review())).not.toContain('Chấp thuận');
  });

  it('a seat outside the proposal\'s frozen seats sees no button and no sentence', () => {
    const card = reassign({ actorEligibility: { canVote: false, reason: null } });
    const out = cardHtml(card);
    expect(buttonsOf(view(card))).toEqual([]);
    expect(out).not.toContain('<textarea');
    expect(voteBlockCopy(null)).toBe('');
    for (const sentence of ['Anh/chị đã bỏ phiếu', 'Vòng xác nhận đã kết thúc', 'Phiếu đã hết hạn']) expect(out).not.toContain(sentence);
    expect(out).not.toContain('role="alert"');
    expect(out).not.toContain('class="decision-block"');
  });

  it('vote buttons follow canVote and nothing else', () => {
    for (const state of STATES) for (const receipt of [null, RECEIPT]) for (const have of [0, 2, 3]) {
      const on = buttonsOf(view(reassign({ state, appliedReceipt: receipt, quorum: { needed: 3, have }, actorEligibility: { canVote: true, reason: null } }))).sort();
      expect(on, JSON.stringify({ state, receipt: receipt !== null, have })).toEqual(['Yêu cầu sửa', 'Từ chối', 'Đồng ý'].sort());
      const off = buttonsOf(view(reassign({ state, appliedReceipt: receipt, quorum: { needed: 3, have }, actorEligibility: { canVote: false, reason: null } })));
      expect(off, JSON.stringify({ state, receipt: receipt !== null, have })).toEqual([]);
    }
    for (const reason of ['ALREADY_VOTED', 'CLOSED', 'EXPIRED'] as const) expect(buttonsOf(view(reassign({ actorEligibility: { canVote: false, reason } })))).toEqual([]);
    // every review card, whatever the eligibility flags, has no button at all
    for (const canApprove of [false, true]) for (const canRequestChanges of [false, true]) for (const canComment of [false, true])
      expect(buttonsOf(view(review({ actorEligibility: { canApprove, canRequestChanges, canComment, reason: null } })))).toEqual([]);
  });

  it('a vote sends the proposal, the choice and the note and nothing that names an actor, tenant or seat', () => {
    expect(voteBody(PROPOSAL, { choice: 'agree', note: 'Đồng ý với phân công' })).toEqual({ action: 'vote', proposalId: PROPOSAL, choice: 'agree', note: 'Đồng ý với phân công' });
    expect(Object.keys(voteBody(PROPOSAL, { choice: 'revise', note: 'Cần sửa phần hai' })).sort()).toEqual(['action', 'choice', 'note', 'proposalId']);
    expect(voteCommand('agree', '  Đồng ý rõ ràng  ')).toEqual({ ok: true, cmd: { choice: 'agree', note: 'Đồng ý rõ ràng' } });
    expect(voteCommand('reject', 'abc')).toEqual({ ok: false, error: 'Ghi chú cần từ 5 đến 2000 ký tự.' });
    expect(voteCommand('reject', 'x'.repeat(2001))).toEqual({ ok: false, error: 'Ghi chú cần từ 5 đến 2000 ký tự.' });
    expect(voteCommand('maybe', 'ghi chú đủ dài')).toEqual({ ok: false, error: 'Chọn Đồng ý, Từ chối hoặc Yêu cầu sửa.' });
    const clicked: string[] = [];
    const buttons = hosts(view(reassign(), { note: 'ghi chú đủ dài', onVote: c => { clicked.push(c); } })).filter(h => h.type === 'button');
    for (const b of buttons) (b.props.onClick as () => void)();
    expect(clicked.sort()).toEqual(['agree', 'reject', 'revise']);
  });

  it('Conflict: a card that changed shows Bản này đã thay đổi and a reload action, and keeps the typed note', () => {
    expect(CONFLICT_COPY).toBe('Bản này đã thay đổi. Mở bản mới để xem lại.');
    for (const code of ['PROPOSAL_CLOSED', 'VERSION_CONFLICT', 'REVISION_CONFLICT', 'REVIEW_ALREADY_DECIDED']) {
      const d = describeVoteError(new ApiError('Câu của máy chủ [' + code + ']', code, 409));
      expect(d, code).toEqual({ text: CONFLICT_COPY, reloadable: true, code });
    }
    expect(describeVoteError(new ApiError('Lựa chọn đã ghi. [VOTE_LOCKED]', 'VOTE_LOCKED', 409))).toMatchObject({ reloadable: false, code: 'VOTE_LOCKED', text: 'Lựa chọn đã ghi. [VOTE_LOCKED]' });
    expect(describeVoteError(new TypeError('fetch failed')).text).toBe('Không kết nối được máy chủ. Nội dung đang nhập vẫn được giữ.');
    for (const odd of [{ a: 1 }, null, undefined, 42]) { const t = describeVoteError(odd).text; expect(t).not.toContain('[object'); expect(t.length).toBeGreaterThan(5); }
    const out = cardHtml(reassign(), { note: 'Ghi chú đang gõ dở', error: CONFLICT_COPY, reloadable: true, onReload: () => {} });
    expect(out).toContain('Bản này đã thay đổi. Mở bản mới để xem lại.');
    expect(out).toContain('role="alert"');
    expect(out).toContain('Tải lại');
    expect(out).toContain('Ghi chú đang gõ dở');
    expect(cardHtml(reassign(), { error: '' })).not.toContain('Tải lại');
  });

  it('account approvals are a link to /approvals, not a card with buttons', () => {
    expect(ACCOUNTS_COPY).toBe('Phiếu duyệt tài khoản và phiếu đổi quyền, gồm cả quyền duyệt bản chuẩn, nằm ở trang Duyệt tài khoản.');
    for (const s of ['ready', 'empty'] as const) {
      const node = <DecisionsBody state={s} cards={s === 'ready' ? [review()] : []} error={null} people={people} />;
      const out = renderToStaticMarkup(node);
      expect(out).toContain(ACCOUNTS_COPY);
      expect(out).toMatch(/<a [^>]*href="\/approvals"/);
      const pointer = hosts(node).filter(h => h.type === 'a' && h.props.href === '/approvals');
      expect(pointer).toHaveLength(1);
      expect(buttonsOf(node)).toEqual([]);
      expect(out.split('class="decision-card"').length - 1).toBe(s === 'ready' ? 1 : 0);
    }
    expect(buttonsOf(<DecisionsBody state="ready" cards={[review(), review({ documentId: U(101), decisionId: U(301) })]} error={null} people={people} />)).toEqual([]);
  });

  it('names and titles with markup are rendered as text', () => {
    const evil = '<script>alert(1)</script><img src=x onerror=alert(2)>';
    const cards = [review({ title: evil, summary: evil, refCode: '<b>x</b>', votes: [{ actorId: BOB, choice: 'approved', at: '2026-11-14T03:00:00.000Z' }], state: 'approved' }),
      reassign({ title: evil, summary: evil, workCode: '<i>y</i>', votes: [{ actorId: ALICE, choice: 'agree', at: '2026-11-14T02:00:00.000Z' }] })];
    const named = [{ id: ALICE, name: evil }, { id: BOB, name: '<u>Bình</u>' }];
    const out = renderToStaticMarkup(<DecisionsBody state="ready" cards={cards} error={null} people={named} />);
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('<b>x</b>');
    expect(out).not.toContain('<i>y</i>');
    expect(out).not.toContain('<u>');
    for (const m of out.matchAll(/href="([^"]*)"/g)) expect(m[1]).toMatch(/^\/(review\/[0-9a-f-]{36}|approvals)$/);
    for (const el of hosts(<DecisionsBody state="ready" cards={cards} error={null} people={named} />)) expect(el.props).not.toHaveProperty('dangerouslySetInnerHTML');
    // a person id the list does not know is shown as a neutral label, never as the raw id
    const unknown = cardHtml(reassign({ votes: [{ actorId: GHOST, choice: 'agree', at: '2026-11-14T02:00:00.000Z' }] }));
    expect(unknown).toContain('Thành viên chưa rõ tên');
    expect(unknown).not.toContain(GHOST);
  });

  it('decision CSS wraps long strings and gives actions 44px', async () => {
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
    const decision = rules.filter(r => /\.decision-/.test(r.selector));
    expect(decision.length).toBeGreaterThan(5);
    // at exactly 700px only one of the min-width:700px / max-width blocks applies
    expect(decision.some(r => r.media.includes('min-width:700px'))).toBe(true);
    expect(decision.some(r => r.media.includes('max-width:699.98px'))).toBe(true);
    for (const r of decision) expect(r.media, r.selector).not.toMatch(/max-width:\s*700px/);
    for (const r of decision) for (const m of r.body.matchAll(/(?:^|;)\s*(?:min-|max-)?width\s*:\s*(\d+)px/g)) expect(Number(m[1]), r.selector).toBeLessThanOrEqual(328);
    const textual = ['decision-title', 'decision-text', 'decision-meta', 'decision-line', 'decision-notice', 'decision-problem', 'decision-vote'];
    for (const cls of textual) expect(decision.some(r => r.selector.split(',').map(x => x.trim()).includes('.' + cls) && /overflow-wrap\s*:\s*anywhere/.test(r.body)), cls).toBe(true);
    expect(decision.some(r => /\.decision-action/.test(r.selector) && /min-height\s*:\s*44px/.test(r.body) && /min-width\s*:\s*44px/.test(r.body))).toBe(true);
    // the new rules are the only ones this task adds: nothing outside decision-* is declared after the marker
    const marker = css.indexOf('/* Decisions (.decision-*)');
    expect(marker).toBeGreaterThan(0);
    const tail = css.slice(marker).replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '');
    for (const m of tail.matchAll(/(?:^|\})\s*([^{}]+)\{/g)) for (const s of m[1].split(',')) expect(s.trim(), s).toMatch(/^\.decision-/);
    // the two blocks do not mix: no decision-* rule inside the Review block, no review-* rule inside this one
    const reviewAt = css.indexOf('/* Review (.review-*)');
    expect(reviewAt).toBeGreaterThan(0);
    expect(reviewAt).toBeLessThan(marker);
    expect(css.slice(reviewAt, marker)).not.toMatch(/\.decision-/);
    expect(css.slice(marker)).not.toMatch(/\.review-/);
  });

  it('after a vote: recorded clears the note and reloads; a failure keeps it; a closed or changed proposal gives the Conflict sentence with a reload', async () => {
    expect(voteRecorded()).toEqual({ resetKey: true, clearNote: true, reload: true });
    for (const code of ['PROPOSAL_CLOSED', 'VERSION_CONFLICT']) {
      expect(voteFailure(new ApiError('Câu của máy chủ [' + code + ']', code, 409)), code).toEqual({ message: 'Bản này đã thay đổi. Mở bản mới để xem lại.', reloadable: true, code, keepNote: true });
    }
    expect(voteFailure(new ApiError('Lựa chọn đã ghi. [VOTE_LOCKED]', 'VOTE_LOCKED', 409))).toEqual({ message: 'Lựa chọn đã ghi. [VOTE_LOCKED]', reloadable: false, code: 'VOTE_LOCKED', keepNote: true });
    expect(voteFailure(new ApiError('Không có quyền. [SEAT_REQUIRED]', 'SEAT_REQUIRED', 403))).toMatchObject({ reloadable: false, keepNote: true });
    expect(voteFailure(new TypeError('fetch failed'))).toMatchObject({ message: 'Không kết nối được máy chủ. Nội dung đang nhập vẫn được giữ.', reloadable: false, code: 'NETWORK', keepNote: true });
    for (const odd of [{ a: 1 }, null, undefined, 42]) expect(voteFailure(odd).message).not.toContain('[object');
    const src = await readFile('src/components/decisions.tsx', 'utf8');
    expect(src).toContain('voteFailure(');
    expect(src).toContain('voteRecorded(');
  });

  it('W9 the list shows one fixed sentence only when the review cards were cut', () => {
    const SENTENCE = 'Danh sách dài hơn phần đang hiện.';
    const body = (truncated?: boolean) => renderToStaticMarkup(<DecisionsBody state="ready" cards={[review()]} error={null} people={people} truncated={truncated} />);
    expect(body(true)).toContain(SENTENCE);
    expect(body(false)).not.toContain(SENTENCE);
    expect(body()).not.toContain(SENTENCE);
    const screen = (t: boolean) => renderToStaticMarkup(<Decisions projects={[{ id: PROJECT, name: 'P' }]} projectId={PROJECT} initial={{ cards: [review()], reviewCardsTruncated: t }} denied={false} people={people} />);
    expect(screen(true)).toContain(SENTENCE);
    expect(screen(false)).not.toContain(SENTENCE);
  });

  it('W12 titles and summaries written by people carry dir="auto" on the Decisions screen', () => {
    const rtl = '\u202Eخطأ\u202C';
    const out = renderToStaticMarkup(<DecisionsBody state="ready" cards={[review({ title: 'Tiêu đề thẻ ' + rtl, summary: 'Tóm tắt thẻ ' + rtl }), reassign({ title: 'Việc ' + rtl, summary: 'Lý do ' + rtl })]} error={null} people={people} />);
    for (const text of ['Tiêu đề thẻ ', 'Tóm tắt thẻ ', 'Việc ', 'Lý do ']) expect(out, text).toMatch(new RegExp('dir="auto"[^>]*>[^<]*' + text));
  });
});

describe('decision card heading without a reference code', () => {
  it('shows the title with no leading separator', () => {
    const out = cardHtml(review({ refCode: '', title: 'Thiết kế mẫu' }));
    expect(out).toMatch(/dir="auto">Thiết kế mẫu</);
    expect(out).not.toContain('· Thiết kế mẫu');
  });
});
