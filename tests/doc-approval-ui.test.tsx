import { describe, it, expect, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { proposalPanelState, canProposeFrom, reloadProposals, settledDraft, heldTypes, proposeCommand, withdrawCommand, proposeBody, withdrawBody, proposalStateLabel, proposalFailure, EMPTY_PROPOSAL_DRAFT,
  PROPOSED_NOTICE, WITHDRAWN_NOTICE, type ProposalDraft, type ProposalPanelState } from '../src/components/doc-approval-view';
import { DocApprovalPanelView, type DocApprovalPanelViewProps } from '../src/components/doc-approval-proposals';
import { ReviewQueue } from '../src/components/review';
import { APPROVAL_NOTE_COPY, APPROVAL_NOTE_WITH_PROPOSALS_COPY, GENERIC_COPY, NETWORK_COPY, checkBasis } from '../src/components/review-view';
import { ApiError } from '../src/components/api';
import { formatTime } from '../src/components/inbox-view';
import { loadOwnProposals } from '../src/server/review-page';
import { AppError } from '../src/server/errors';
import type { DocApprovalProposal } from '../src/server/doc-approval-proposals';
import type { ApproverView } from '../src/server/review-delegations';
import { standingAfterReread } from '../src/components/doc-approval-view';
import type { ProposalsInitial } from '../src/server/review-page';

// Task 4 of Task 7c (step 16b): the coordinator's proposal block on the Review screen. Every id, name and text below is synthetic.
// This file keeps its own minimal hosts/textOf/buttonsOf and its own driver (T7C-32); it imports nothing from another test file.
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PROJECT = U(200), VIEWER = U(1), CO = U(2), ENGINEER = U(3), BUSINESS = U(4), READONLY = U(5), STRANGER = U(9);
const people = [{ id: VIEWER, name: 'Điều phối mẫu', role: 'manager' }, { id: CO, name: 'Đồng điều phối mẫu', role: 'manager' }, { id: ENGINEER, name: 'Kỹ sư mẫu', role: 'engineer' },
  { id: BUSINESS, name: 'Nghiệp vụ mẫu', role: 'business' }, { id: READONLY, name: 'Chỉ đọc mẫu', role: 'viewer' }];
const ballot = (o: Partial<DocApprovalProposal> = {}): DocApprovalProposal => ({ approvalId: U(800), projectId: PROJECT, userId: ENGINEER, addedTypes: ['design'], state: 'pending',
  expiresAt: '2026-11-18T01:00:00.000Z', replayed: false, ...o });
const delegations = (approvers: ApproverView[] = []) => ({ reviewers: [], approvers, canDesignate: true });

// The wording of the brief, character for character.
const PANEL = 'Trình phiếu cấp quyền duyệt bản chuẩn';
const ADMIN_COPY = 'Quản trị tài khoản trình phiếu cấp quyền duyệt bản chuẩn ở trang Quản trị tài khoản.';
const LOAD_ERROR_COPY = 'Không tải được phiếu anh/chị đã trình. Dữ liệu đã lưu không bị thay đổi.';
const DENIED_PANEL_COPY = 'Chỉ điều phối của dự án này trình được phiếu cấp quyền duyệt bản chuẩn.';
const FORMER_COPY = 'Anh/chị không còn là điều phối của dự án này nên không trình được phiếu mới. Phiếu đã trình còn chờ thì vẫn rút được ở đây.';
const EMPTY_LIST_COPY = 'Anh/chị chưa có phiếu nào đang mở.';
const PENDING_LABEL = 'Đang chờ một thành viên BoM';
const APPROVED_LABEL = 'Đã đủ phiếu, chờ quản trị tài khoản áp';
const APPROVED_NOTE = 'Phiếu đã đủ xác nhận nên không rút được ở đây; muốn dừng thì nhờ quản trị tài khoản huỷ.';
const COORDINATOR_NOTE = 'Phiếu cần một thành viên BoM đồng ý. Quyền chỉ có hiệu lực sau khi quản trị tài khoản áp.';
const WAIT_LAST = 'Phiếu hết dùng được vì tài khoản của người được cấp vừa đổi thì có thể phải chờ tới 24 giờ sau hạn của phiếu.';
const WAIT_NOTE = 'Phiếu tự rút thì anh/chị trình lại được ngay. Phiếu bị quản trị tài khoản huỷ, bị từ chối hoặc hết hạn thì phải qua 24 giờ kể từ lúc phiếu đóng mới trình lại được cho cùng người; cần sớm hơn thì nhờ quản trị tài khoản trình. ' + WAIT_LAST;
const CO_NOTE = 'Người này cũng là điều phối của dự án. Phiếu sẽ nêu rõ điều đó cho người bỏ phiếu.';
const PICK_MEMBER = 'Chọn một thành viên.';
const PICK_TYPE = 'Chọn thêm ít nhất một loại tài liệu.';
const LENGTH_300 = 'Căn cứ cần từ 5 đến 300 ký tự.';
const LENGTH_500 = 'Căn cứ cần từ 5 đến 500 ký tự.';
const FORBIDDEN_COPY = 'Căn cứ không được chứa ký tự điều khiển hoặc ký tự định dạng ẩn.';
const APPROVED_REFUSAL = 'Phiếu đã đủ xác nhận, không rút được ở đây.';
const WITH_PROPOSALS_NOTE = 'Quyền duyệt bản chuẩn cấp qua phiếu đổi quyền: điều phối dự án hoặc quản trị tài khoản trình, một thành viên BoM đồng ý, quản trị tài khoản áp.';
const PAIR_WAIT = 'Anh/chị chưa trình lại được cho người này: phiếu trước của anh/chị cho họ không được áp, và khoảng chờ 24 giờ sau phiếu đó chưa hết. Thử lại sau, hoặc nhờ quản trị tài khoản trình.';

// Drives the hook-free view like a browser would: render, find a control, call its handler, render again.
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

type ViewOver = Partial<DocApprovalPanelViewProps>;
function driveProposals(over: ViewOver = {}) {
  const { draft: start, ...rest } = over;
  let draft: ProposalDraft = { ...EMPTY_PROPOSAL_DRAFT, ...start };
  const proposed: unknown[] = [], withdrawn: unknown[] = [], errors: string[] = [];
  const view = () => <DocApprovalPanelView state="ready" proposals={[]} approvers={[]} people={people} viewerId={VIEWER} busy={false} error="" notice="" reloadable={false} localError=""
    onReload={() => {}} {...rest} draft={draft} onDraft={p => { draft = { ...draft, ...p }; }} onPropose={c => { proposed.push(c); }} onWithdraw={c => { withdrawn.push(c); }}
    onInvalid={m => { errors.push(m); }} />;
  const field = (name: string): Host => { const f = hosts(view()).find(h => h.props.name === name); expect(f, 'no field ' + name).toBeDefined(); return f as Host; };
  return { html: () => renderToStaticMarkup(view()), buttons: () => buttonsOf(view()), all: () => hosts(view()), proposed, withdrawn, errors, draft: () => draft, field,
    options: () => hosts(field('proposalUserId').props.children).filter(h => h.type === 'option').map(h => ({ value: String(h.props.value), text: textOf(h.props.children) })),
    set: (name: string, value: string, checked = true) => (field(name).props.onChange as (e: unknown) => void)({ target: { value, checked }, currentTarget: { value, checked } }),
    click: (label: string, nth = 0) => {
      const bs = hosts(view()).filter(h => h.type === 'button' && textOf(h.props.children) === label);
      expect(bs.length, 'no button ' + label).toBeGreaterThan(nth);
      (bs[nth].props.onClick as () => void)();
    } };
}
const rowsOf = (all: Host[], state: 'pending' | 'approved') => all.filter(h => h.type === 'li' && h.props['data-state'] === state);
const queue = (proposals?: Parameters<typeof ReviewQueue>[0]['proposals'], approvers: ApproverView[] = []) => renderToStaticMarkup(<ReviewQueue projects={[{ id: PROJECT, name: 'Dự án mẫu' }]}
  projectId={PROJECT} initial={{ items: [], total: 0 }} denied={false} delegations={delegations(approvers)} people={people} viewerId={VIEWER} proposals={proposals} />);

describe('the proposal block on the Review screen', () => {
  it('P1 renders seven states with different wording: loading, admin, error, denied, former, empty and ready', () => {
    const at = (state: ProposalPanelState, proposals: DocApprovalProposal[] = []) => driveProposals({ state, proposals });
    const two = [ballot(), ballot({ approvalId: U(801), userId: BUSINESS, state: 'approved' })];
    const out: Record<ProposalPanelState, string> = { loading: at('loading').html(), admin: at('admin').html(), error: at('error').html(), denied: at('denied').html(),
      former: at('former', two).html(), empty: at('empty').html(), ready: at('ready', two).html() };
    for (const s of Object.keys(out) as ProposalPanelState[]) expect(out[s], s).toContain('aria-label="' + PANEL + '"');
    expect(out.loading).toContain('aria-busy="true"');
    expect(out.loading).toContain('aria-label="Đang tải phiếu đã trình"');
    expect(out.loading).not.toContain('>0<');
    expect(out.loading).not.toContain('<select');
    // admin: one link to /team, no form, no button
    const admin = at('admin');
    expect(admin.all().filter(h => h.type === 'a').map(h => h.props.href)).toEqual(['/team']);
    expect(out.admin.split('href="/team"').length - 1).toBe(1);
    expect(out.admin).toContain('Mở trang Quản trị tài khoản');
    expect(out.admin).not.toContain('<select');
    expect(out.admin).not.toContain('<input');
    expect(admin.buttons()).toEqual([]);
    // error: an alert with Thử lại and no form
    expect(out.error).toContain('role="alert"');
    expect(at('error').buttons()).toEqual(['Thử lại']);
    expect(out.error).not.toContain('<select');
    // each state's own sentence, and no other state shows it
    const own: Partial<Record<ProposalPanelState, string>> = { admin: ADMIN_COPY, error: LOAD_ERROR_COPY, denied: DENIED_PANEL_COPY, former: FORMER_COPY, empty: EMPTY_LIST_COPY };
    expect(new Set(Object.values(own)).size).toBe(5);
    for (const [s, copy] of Object.entries(own) as [ProposalPanelState, string][]) {
      expect(out[s], s).toContain(copy);
      for (const t of Object.keys(out) as ProposalPanelState[]) if (t !== s) expect(out[t], t + ' shows the sentence of ' + s).not.toContain(copy);
    }
    expect(out.ready).toContain('name="proposalUserId"');
    expect(out.empty).toContain('name="proposalUserId"');
    // the order of precedence
    const base = { loading: false, admin: false, failed: false, denied: false, canPropose: true, count: 2 };
    expect(proposalPanelState({ ...base, loading: true, admin: true, failed: true, denied: true })).toBe('loading');
    expect(proposalPanelState({ ...base, admin: true, failed: true, denied: true })).toBe('admin');
    expect(proposalPanelState({ ...base, failed: true, denied: true })).toBe('error');
    expect(proposalPanelState({ ...base, denied: true })).toBe('denied');
    expect(proposalPanelState({ ...base, canPropose: false, count: 0 })).toBe('denied');
    expect(proposalPanelState({ ...base, canPropose: false, count: 2 })).toBe('former');
    expect(proposalPanelState({ ...base, canPropose: true, count: 0 })).toBe('empty');
    expect(proposalPanelState({ ...base, canPropose: true, count: 2 })).toBe('ready');
  });

  it('P2 the denied state has no form, no button and names nobody', () => {
    // even when it is handed rows, the denied block shows none of them
    const p = driveProposals({ state: 'denied', proposals: [ballot()] });
    const out = p.html();
    expect(out).toContain(DENIED_PANEL_COPY);
    expect(out).not.toContain('<select');
    expect(out).not.toContain('<input');
    expect(p.buttons()).toEqual([]);
    for (const person of people) expect(out).not.toContain(person.name);
    expect(out).not.toContain('Phiếu anh/chị đã trình');
  });

  it('P3 OQ-33 the form offers members who read in the project, never the viewer and never a read-only member; a co-manager is offered and flagged', () => {
    for (const viewerId of [VIEWER, VIEWER.toUpperCase()]) {
      const p = driveProposals({ viewerId });
      const ids = p.options().map(o => o.value).filter(Boolean);
      expect(ids).not.toContain(VIEWER);
      expect(ids.map(id => id.toLowerCase())).not.toContain(VIEWER);
      expect(ids).not.toContain(READONLY);
      expect(ids).toEqual([CO, ENGINEER, BUSINESS]);
    }
    const p = driveProposals();
    expect(p.options()[0]).toEqual({ value: '', text: 'Chọn thành viên' });
    expect(p.options().find(o => o.value === CO)?.text).toBe('Đồng điều phối mẫu · Điều phối');
    expect(p.options().find(o => o.value === ENGINEER)?.text).toBe('Kỹ sư mẫu · Thực hiện');
    expect(p.html()).not.toContain(CO_NOTE);
    p.set('proposalUserId', CO);
    expect(p.html()).toContain(CO_NOTE);
    p.set('proposalUserId', ENGINEER);
    expect(p.html()).not.toContain(CO_NOTE);
  });

  it('P4 types already held are shown ticked and locked, go to expectedTypes and never to docTypes; a proposal needs one new type', () => {
    const approvers: ApproverView[] = [{ userId: ENGINEER.toUpperCase(), docTypes: ['design'] }];
    expect(heldTypes(approvers, ENGINEER)).toEqual(['design']);
    expect(heldTypes([{ userId: ENGINEER, docTypes: ['plan', 'design'] }], ENGINEER.toUpperCase())).toEqual(['design', 'plan']);
    expect(heldTypes(approvers, BUSINESS)).toEqual([]);
    const p = driveProposals({ approvers });
    p.set('proposalUserId', ENGINEER);
    const design = p.field('proposalType:design'), plan = p.field('proposalType:plan');
    expect([design.props.checked, design.props.disabled]).toEqual([true, true]);
    expect([plan.props.checked, Boolean(plan.props.disabled)]).toEqual([false, false]);
    const label = (t: string) => textOf(p.all().find(h => h.type === 'label' && hosts(h.props.children).some(c => c.props.name === 'proposalType:' + t))?.props.children);
    expect(label('design')).toBe('Thiết kế — đang giữ');
    expect(label('plan')).toBe('Kế hoạch');
    p.set('proposalBasis', 'Căn cứ trình phiếu hợp lệ');
    p.click('Trình phiếu');
    expect(p.proposed).toEqual([]);
    expect(p.errors).toEqual([PICK_TYPE]);
    // ticking the held box by hand changes nothing: it is never sent as new
    p.set('proposalType:design', 'design');
    p.click('Trình phiếu');
    expect(p.proposed).toEqual([]);
    expect(p.errors.at(-1)).toBe(PICK_TYPE);
    p.set('proposalType:plan', 'plan');
    p.click('Trình phiếu');
    expect(p.proposed).toEqual([{ userId: ENGINEER, docTypes: ['plan'], expectedTypes: ['design'], reason: 'Căn cứ trình phiếu hợp lệ' }]);
    // no member chosen
    const none = proposeCommand({ ...EMPTY_PROPOSAL_DRAFT, docTypes: ['plan'], basis: 'Căn cứ trình phiếu hợp lệ' }, []);
    expect(none).toEqual({ ok: false, error: PICK_MEMBER });
    // the types follow the order of DOC_TYPES, whatever order they were ticked in
    expect(proposeCommand({ ...EMPTY_PROPOSAL_DRAFT, userId: ENGINEER, docTypes: ['guide', 'plan', 'design'], basis: 'Căn cứ trình phiếu hợp lệ' }, ['plan', 'design']))
      .toEqual({ ok: true, cmd: { userId: ENGINEER, docTypes: ['guide'], expectedTypes: ['design', 'plan'], reason: 'Căn cứ trình phiếu hợp lệ' } });
    expect(PROPOSED_NOTICE).toBe('Đã trình phiếu. Quyền chưa đổi cho tới khi một thành viên BoM đồng ý và quản trị tài khoản áp.');
    expect(driveProposals({ notice: PROPOSED_NOTICE }).html()).toMatch(/role="status"[^>]*>Đã trình phiếu\. Quyền chưa đổi/);
  });

  it('P5 the basis is 5 to 300 visible characters on one line, checked on the raw text', () => {
    const p = driveProposals();
    const input = p.field('proposalBasis');
    expect([input.type, input.props.type]).toEqual(['input', 'text']);
    p.set('proposalUserId', ENGINEER);
    p.set('proposalType:plan', 'plan');
    const refused = (max: number, copy: string): [string, string][] => [
      ['  abcd  ', copy],                                              // 4 code points once the spaces are gone
      ['x'.repeat(max + 1), copy],                                     // one over the cap
      [' ' + 'x'.repeat(max - 1) + ' ', copy],                         // the cap is on the raw text, before the spaces go
      ['Căn cứ\ncó xuống dòng', FORBIDDEN_COPY],
      ['Căn cứ hợp lệ đủ dài\n', FORBIDDEN_COPY],                     // a forbidden character at the end is refused, never trimmed away
      ['\tCăn cứ hợp lệ đủ dài', FORBIDDEN_COPY],
      ['Căn cứ\u2028tách dòng', FORBIDDEN_COPY],
      ['Căn cứ \u202Eđảo chiều', FORBIDDEN_COPY],
      ['Căn cứ có nối\u200Dký tự', FORBIDDEN_COPY],
    ];
    for (const [raw, copy] of refused(300, LENGTH_300)) {
      p.set('proposalBasis', raw);
      p.click('Trình phiếu');
      expect(p.errors.at(-1), JSON.stringify(raw)).toBe(copy);
    }
    expect(p.proposed).toEqual([]);
    const vietnamese = (n: number) => Array.from('Căn cứ trình phiếu hợp lệ '.repeat(40)).slice(0, n).join('');
    const full = vietnamese(300);
    expect(Array.from(full).length).toBe(300);
    expect(full.endsWith(' ')).toBe(false);
    p.set('proposalBasis', full);
    p.click('Trình phiếu');
    expect(p.proposed).toEqual([{ userId: ENGINEER, docTypes: ['plan'], expectedTypes: [], reason: full }]);
    const spaced = ' ' + vietnamese(298) + ' ';
    expect(Array.from(spaced).length).toBe(300);
    p.set('proposalBasis', spaced);
    p.click('Trình phiếu');
    expect(p.proposed.at(-1)).toEqual({ userId: ENGINEER, docTypes: ['plan'], expectedTypes: [], reason: vietnamese(298) });
    // the withdrawal box: the same rule with a cap of 500
    const w = driveProposals({ proposals: [ballot()] });
    w.click('Rút phiếu');
    const box = w.field('withdrawBasis');
    expect([box.type, box.props.type]).toEqual(['input', 'text']);
    for (const [raw, copy] of refused(500, LENGTH_500)) {
      w.set('withdrawBasis', raw);
      w.click('Xác nhận rút');
      expect(w.errors.at(-1), JSON.stringify(raw)).toBe(copy);
    }
    expect(w.withdrawn).toEqual([]);
    const long = vietnamese(500);
    expect(Array.from(long).length).toBe(500);
    w.set('withdrawBasis', long);
    w.click('Xác nhận rút');
    expect(w.withdrawn).toEqual([{ approvalId: U(800), reason: long.replace(/^ +| +$/g, '') }]);
    w.set('withdrawBasis', ' ' + vietnamese(498) + ' ');
    w.click('Xác nhận rút');
    expect(w.withdrawn.at(-1)).toEqual({ approvalId: U(800), reason: vietnamese(498).replace(/^ +| +$/g, '') });
    // checkBasis is the one rule both boxes use (T7C-33): forbidden on the raw text, then the cap on the raw text, then the floor after trimming
    const rule = { max: 10, forbidden: /[#]/, forbiddenCopy: 'F', lengthCopy: 'L' };
    expect(checkBasis(' abcde ', rule)).toEqual({ ok: true, cmd: 'abcde' });
    expect(checkBasis('#bcdefghijklmn', rule)).toEqual({ ok: false, error: 'F' });
    expect(checkBasis(' abcdefghij ', rule)).toEqual({ ok: false, error: 'L' });
    expect(checkBasis('  abc  ', rule)).toEqual({ ok: false, error: 'L' });
  });

  it('P6 the request bodies carry only the fields the service takes', () => {
    const cmd = { userId: ENGINEER, docTypes: ['plan' as const], expectedTypes: ['design' as const], reason: 'Căn cứ trình phiếu hợp lệ' };
    const body = proposeBody(PROJECT, cmd);
    expect(Object.keys(body).sort()).toEqual(['docTypes', 'expectedTypes', 'projectId', 'reason', 'userId']);
    expect(body).toEqual({ projectId: PROJECT, ...cmd });
    // whatever else a caller hands in is dropped
    const smuggled = { ...cmd, proposerId: VIEWER, tenantId: U(7), grants: [], role: 'manager', reportPermissions: ['doc_approve:plan'], projectIds: [PROJECT], state: 'approved', approvalId: U(800) };
    expect(Object.keys(proposeBody(PROJECT, smuggled)).sort()).toEqual(['docTypes', 'expectedTypes', 'projectId', 'reason', 'userId']);
    expect(Object.keys(withdrawBody({ reason: 'Căn cứ rút phiếu' }))).toEqual(['reason']);
    expect(Object.keys(withdrawBody({ ...smuggled, reason: 'Căn cứ rút phiếu' }))).toEqual(['reason']);   // the ballot id is in the path only (T7C-31)
    for (const key of ['proposerId', 'actorId', 'tenantId', 'grants', 'role', 'reportPermissions', 'projectIds', 'state', 'approvalId']) {
      expect(Object.keys(proposeBody(PROJECT, smuggled))).not.toContain(key);
      expect(Object.keys(withdrawBody({ ...smuggled, reason: 'Căn cứ rút phiếu' }))).not.toContain(key);
    }
  });

  it('P7 OQ-51 (b): only a pending ballot offers Rút phiếu; a withdrawal needs a basis', () => {
    const pending = ballot(), approved = ballot({ approvalId: U(801), userId: BUSINESS, addedTypes: ['plan', 'guide'], state: 'approved' });
    const p = driveProposals({ proposals: [pending, approved] });
    expect(proposalStateLabel('pending')).toBe(PENDING_LABEL);
    expect(proposalStateLabel('approved')).toBe(APPROVED_LABEL);
    const out = p.html();
    expect(out).toContain(PENDING_LABEL);
    expect(out).toContain(APPROVED_LABEL);
    expect(out).toContain('Hết hạn lúc ' + formatTime(pending.expiresAt));
    expect(out).toContain('Kế hoạch');
    expect(out).toContain('Hướng dẫn');
    expect(p.buttons().filter(b => b === 'Rút phiếu')).toHaveLength(1);
    const [pendingRow] = rowsOf(p.all(), 'pending'), [approvedRow] = rowsOf(p.all(), 'approved');
    expect(buttonsOf(pendingRow.props.children)).toEqual(['Rút phiếu']);
    expect(buttonsOf(approvedRow.props.children)).toEqual([]);
    expect(textOf(approvedRow.props.children)).toContain(APPROVED_NOTE);
    expect(textOf(pendingRow.props.children)).not.toContain(APPROVED_NOTE);
    p.click('Rút phiếu');
    expect(p.draft().withdrawId).toBe(pending.approvalId);
    expect(p.html()).toContain('Căn cứ rút phiếu (5–500 ký tự)');
    expect(p.buttons()).toEqual(expect.arrayContaining(['Xác nhận rút', 'Hủy']));
    expect(p.buttons()).not.toContain('Rút phiếu');
    p.set('withdrawBasis', 'abcd');
    p.click('Xác nhận rút');
    expect(p.withdrawn).toEqual([]);
    expect(p.errors).toEqual([LENGTH_500]);
    p.set('withdrawBasis', 'Căn cứ rút phiếu hợp lệ');
    p.click('Xác nhận rút');
    expect(p.withdrawn).toEqual([{ approvalId: pending.approvalId, reason: 'Căn cứ rút phiếu hợp lệ' }]);
    p.click('Hủy');
    expect(p.draft().withdrawId).toBeNull();
    expect(p.all().some(h => h.props.name === 'withdrawBasis')).toBe(false);
    expect(p.buttons()).toContain('Rút phiếu');
    expect(withdrawCommand(approved, 'Căn cứ rút phiếu hợp lệ')).toEqual({ ok: false, error: APPROVED_REFUSAL });
    expect(withdrawCommand(pending, 'Căn cứ rút phiếu hợp lệ')).toEqual({ ok: true, cmd: { approvalId: pending.approvalId, reason: 'Căn cứ rút phiếu hợp lệ' } });
    expect(WITHDRAWN_NOTICE).toBe('Đã rút phiếu. Quyền của người này không đổi.');
    expect(driveProposals({ notice: WITHDRAWN_NOTICE }).html()).toMatch(/role="status"[^>]*>Đã rút phiếu\./);
  });

  it('P8 each refusal has its sentence, the draft survives every error, and a reload is offered where the list is stale', () => {
    const fixed: [string, number, string, boolean][] = [
      ['APPROVAL_PENDING', 409, 'Người này đang có một phiếu đổi quyền chưa xong.', false],
      ['MANAGER_REQUIRED', 403, 'Chỉ điều phối của dự án này trình được phiếu.', true],
      ['SCOPE_DENIED', 404, 'Không tìm thấy mục trong phạm vi được cấp.', true],
      ['APPROVAL_CLOSED', 409, 'Phiếu đã kết thúc hoặc hết hạn.', true],
      ['BALLOT_ALREADY_APPROVED', 409, 'Phiếu đã đủ xác nhận, không còn rút được ở đây. Nhờ quản trị tài khoản huỷ nếu cần.', true],
    ];
    const server: Record<string, string> = { APPROVAL_PENDING: 'Người này đang có một phiếu đổi quyền chưa xong.', MANAGER_REQUIRED: 'Chỉ điều phối dự án được thực hiện thao tác này.',
      SCOPE_DENIED: 'Không tìm thấy mục trong phạm vi được cấp.', APPROVAL_CLOSED: 'Phiếu đã kết thúc hoặc hết hạn.',
      BALLOT_ALREADY_APPROVED: 'Phiếu đã đủ xác nhận, không còn rút được ở đây. Nhờ quản trị tài khoản huỷ nếu cần.' };
    for (const [code, status, sentence, reloadable] of fixed) {
      expect(proposalFailure(new ApiError(server[code] + ' [' + code + ']', code, status)), code).toEqual({ message: sentence, reloadable, keepDraft: true });
    }
    const passed: [string, number, string, boolean][] = [
      ['DOC_APPROVAL_PROPOSAL_INVALID', 422, 'Người được đề xuất phải là thành viên đang hoạt động của dự án. [DOC_APPROVAL_PROPOSAL_INVALID]', false],
      ['DOC_APPROVAL_PROPOSAL_INVALID', 422, 'Không tự trình phiếu cấp quyền duyệt cho chính mình. [DOC_APPROVAL_PROPOSAL_INVALID]', false],
      ['RATE_LIMITED', 429, PAIR_WAIT + ' [RATE_LIMITED]', false],
      ['RATE_LIMITED', 429, 'Thử lại sau ít phút. [RATE_LIMITED]', false],
      ['VERSION_CONFLICT', 409, 'Quyền duyệt của người này đã đổi. Tải lại trước khi trình. [VERSION_CONFLICT]', true],
      ['APPROVERS_NOT_READY', 409, 'Chưa đủ người bỏ phiếu khi không tính người trình. Nhờ quản trị tài khoản kiểm tra danh sách người duyệt hoặc trình thay. [APPROVERS_NOT_READY]', false],
      ['ACCESS_CHANGE_NOT_NEEDED', 409, 'Người này đã giữ quyền duyệt các loại tài liệu đã chọn. [ACCESS_CHANGE_NOT_NEEDED]', false],
      ['SOMETHING_NEW', 500, 'Một câu lạ của máy chủ. [SOMETHING_NEW]', false],
      ['toString', 400, 'Mã trùng tên thuộc tính của Object. [toString]', false],
      ['__proto__', 400, 'Mã trùng tên thuộc tính của Object. [__proto__]', false],
    ];
    for (const [code, status, message, reloadable] of passed) {
      expect(proposalFailure(new ApiError(message, code, status)), code + ' ' + message).toEqual({ message, reloadable, keepDraft: true });
    }
    expect(proposalFailure(new ApiError('', 'SOMETHING_NEW', 500))).toEqual({ message: GENERIC_COPY, reloadable: false, keepDraft: true });
    expect(proposalFailure(new TypeError('Failed to fetch'))).toEqual({ message: NETWORK_COPY, reloadable: false, keepDraft: true });
    for (const other of [{ code: 'SCOPE_DENIED', message: 'x' }, new Error('boom'), 'text', null, undefined]) {
      expect(proposalFailure(other), String(other)).toEqual({ message: GENERIC_COPY, reloadable: false, keepDraft: true });
    }
    // the refusal is shown with the typed draft still in place, and a reload where it belongs
    const typed = { userId: ENGINEER, docTypes: ['plan' as const], basis: 'Căn cứ đang gõ dở', withdrawId: U(800), withdrawBasis: 'Căn cứ rút đang gõ dở' };
    const stale = driveProposals({ proposals: [ballot()], draft: typed, error: 'Quyền duyệt của người này đã đổi. Tải lại trước khi trình. [VERSION_CONFLICT]', reloadable: true });
    const out = stale.html();
    expect(out).toMatch(/role="alert"[^>]*><p[^>]*>Quyền duyệt của người này đã đổi\. Tải lại trước khi trình\. \[VERSION_CONFLICT\]/);
    expect(out).toContain('value="Căn cứ đang gõ dở"');
    expect(out).toContain('value="Căn cứ rút đang gõ dở"');
    expect(stale.buttons()).toContain('Tải lại');
    expect(stale.field('proposalType:plan').props.checked).toBe(true);
    expect(driveProposals({ error: 'Người này đang có một phiếu đổi quyền chưa xong.', reloadable: false }).buttons()).not.toContain('Tải lại');
    // a local refusal is shown in the same place
    expect(driveProposals({ localError: PICK_MEMBER }).html()).toMatch(/role="alert"[^>]*><p[^>]*>Chọn một thành viên\./);
  });

  it('P9 no control in the panel grants anything by itself', () => {
    const p = driveProposals({ proposals: [ballot(), ballot({ approvalId: U(801), userId: BUSINESS })], approvers: [{ userId: ENGINEER, docTypes: ['design'] }] });
    const allowed = ['Trình phiếu', 'Rút phiếu', 'Xác nhận rút', 'Hủy'];
    expect([...p.buttons()].sort()).toEqual(['Rút phiếu', 'Rút phiếu', 'Trình phiếu']);
    p.click('Rút phiếu');
    expect([...p.buttons()].sort()).toEqual(['Hủy', 'Rút phiếu', 'Trình phiếu', 'Xác nhận rút']);
    for (const b of p.buttons()) {
      expect(allowed).toContain(b);
      for (const word of ['Lưu', 'Cấp', 'Áp', 'Chấp thuận']) expect(b).not.toContain(word);
    }
    p.set('proposalUserId', ENGINEER);
    for (const h of p.all()) {
      expect(String(h.props.value ?? '').startsWith('doc_approve:')).toBe(false);
      expect(String(h.props.name ?? '')).not.toContain('doc_approve');
    }
    const out = p.html();
    expect(out).toContain(COORDINATOR_NOTE);
    expect(out).toContain(WAIT_NOTE);
    expect(out).toContain(WAIT_LAST);
    const empty = driveProposals({ state: 'empty' }).html();
    expect(empty).toContain(COORDINATOR_NOTE);
    expect(empty).toContain(WAIT_NOTE);
  });

  it('P10 text written by people is rendered as text inside bdi', () => {
    const odd = people.map(x => x.id === ENGINEER ? { ...x, name: '<b>Tên đậm</b>' } : x);
    const p = driveProposals({ people: odd, proposals: [ballot(), ballot({ approvalId: U(801), userId: STRANGER })], draft: { ...EMPTY_PROPOSAL_DRAFT, basis: '<script>alert(1)</script> căn cứ' } });
    const out = p.html();
    expect(out).not.toContain('<b>');
    expect(out).not.toContain('<script');
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt; căn cứ');
    expect(out).toMatch(/<bdi dir="auto">&lt;b&gt;Tên đậm&lt;\/b&gt;<\/bdi>/);
    expect(out).toMatch(/<bdi dir="auto">Thành viên chưa rõ tên<\/bdi>/);
    expect(out).not.toMatch(/null|undefined|NaN|Invalid Date/);
  });

  it('P11 the queue screen shows the panel only when it is handed proposals, and nothing else changes without them', async () => {
    expect(APPROVAL_NOTE_WITH_PROPOSALS_COPY).toBe(WITH_PROPOSALS_NOTE);
    const without = queue(undefined);
    expect(without).not.toContain('Trình phiếu');
    expect(without).not.toContain('name="proposalUserId"');
    expect(without).toContain(APPROVAL_NOTE_COPY);
    expect(without).not.toContain(WITH_PROPOSALS_NOTE);
    const ready = queue({ state: 'ready', items: [], canPropose: true });
    expect(ready).toContain('aria-label="' + PANEL + '"');
    expect(ready).toContain('name="proposalUserId"');
    expect(ready).toContain(WITH_PROPOSALS_NOTE);
    expect(ready).not.toContain(APPROVAL_NOTE_COPY);
    expect(ready).toContain(EMPTY_LIST_COPY);
    // the panel sits right under the reviewers panel
    expect(ready.indexOf('aria-label="Người nhận xét của dự án"')).toBeLessThan(ready.indexOf('aria-label="' + PANEL + '"'));
    const denied = queue({ state: 'denied' });
    expect(denied).toContain(DENIED_PANEL_COPY);
    expect(denied).not.toContain('name="proposalUserId"');
    expect(denied).toContain(WITH_PROPOSALS_NOTE);
    const admin = queue({ state: 'admin' });
    expect(admin).toContain(ADMIN_COPY);
    expect(admin).toContain('href="/team"');
    expect(admin).not.toContain('name="proposalUserId"');
    const error = queue({ state: 'error' });
    expect(error).toContain(LOAD_ERROR_COPY);
    expect(error).not.toContain('name="proposalUserId"');
    // the held types of the form come from the approvers the reviewers panel was handed
    expect(queue({ state: 'ready', items: [], canPropose: true }, [{ userId: ENGINEER, docTypes: ['design'] }])).toContain('name="proposalUserId"');
    // the three operations go through api(), with the bodies and the decision of a failure kept in doc-approval-view.ts
    const src = await readFile('src/components/review.tsx', 'utf8');
    for (const name of ['proposeBody(', 'withdrawBody(', 'proposalFailure(', 'proposalPanelState(', "'/api/team/doc-approvals'", "'/withdraw'", "'/api/team/doc-approvals?projectId='"]) expect(src, name).toContain(name);
    // a list the page read carries the service's answer; a list it could not read carries none, so a successful «Thử lại» falls back on
    // canDesignate instead of turning a coordinator into «denied» or «former»
    expect(canProposeFrom({ state: 'ready', items: [], canPropose: false }, true)).toBe(false);
    expect(canProposeFrom({ state: 'ready', items: [], canPropose: true }, false)).toBe(true);
    expect(canProposeFrom({ state: 'error' }, true)).toBe(true);
    expect(canProposeFrom({ state: 'error' }, false)).toBe(false);
    expect(canProposeFrom({ state: 'denied' }, true)).toBe(true);
    expect(canProposeFrom({ state: 'denied' }, false)).toBe(false);
    expect(src).toContain('canProposeFrom(proposals, delegations?.canDesignate === true)');
  });

  it('P12 loadOwnProposals: the account admin is answered without a read; everyone else is read; a scope refusal is denied; any other failure is the error state, never a throw', async () => {
    expect(typeof loadOwnProposals).toBe('function');
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let calls = 0;
      const one = [ballot()];
      const counting = (run: () => Promise<DocApprovalProposal[]>) => () => { calls++; return run(); };
      expect(await loadOwnProposals({ coordinator: true, accountAdmin: true }, counting(async () => one))).toEqual({ state: 'admin' });
      expect(await loadOwnProposals({ coordinator: false, accountAdmin: true }, counting(async () => one))).toEqual({ state: 'admin' });
      expect(calls).toBe(0);
      expect(await loadOwnProposals({ coordinator: false, accountAdmin: false }, counting(async () => one))).toEqual({ state: 'ready', items: one, canPropose: false });
      expect(calls).toBe(1);
      expect(await loadOwnProposals({ coordinator: true, accountAdmin: false }, counting(async () => []))).toEqual({ state: 'ready', items: [], canPropose: true });
      expect(calls).toBe(2);
      expect(await loadOwnProposals({ coordinator: true, accountAdmin: false }, counting(async () => { throw new AppError('SCOPE_DENIED', 'Không tìm thấy mục trong phạm vi được cấp.', 404); })))
        .toEqual({ state: 'denied' });
      expect(logged).not.toHaveBeenCalled();
      const failures: unknown[] = [new AppError('IDENTITY_UNAVAILABLE', 'Đăng nhập chưa được cấu hình.', 503), new Error('connection terminated'), 'text', new AppError('SCOPE_DENIED_NOT', 'x')];
      for (const f of failures) expect(await loadOwnProposals({ coordinator: false, accountAdmin: false }, async () => { throw f; }), String(f)).toEqual({ state: 'error' });
      // a synchronous throw of the read (identityService() before any promise) is the error state too
      expect(await loadOwnProposals({ coordinator: true, accountAdmin: false }, () => { throw new AppError('IDENTITY_UNAVAILABLE', 'Đăng nhập chưa được cấu hình.', 503); })).toEqual({ state: 'error' });
      expect(logged).toHaveBeenCalledTimes(failures.length + 1);
      for (const [line] of logged.mock.calls) {
        const entry = JSON.parse(String(line));
        expect(Object.keys(entry).sort()).toEqual(['errorType', 'event', 'level']);
        expect(entry).toMatchObject({ level: 'error', event: 'doc_approval_proposals_unavailable' });
        expect(String(line)).not.toMatch(/connection terminated|Đăng nhập|text/);
      }
    } finally { logged.mockRestore(); }
  });

  it('P13 the panel uses existing review classes only', async () => {
    const src = await readFile('src/components/doc-approval-proposals.tsx', 'utf8');
    const allowed = new Set(('review-panel review-form review-notice review-problem review-text review-meta review-plain review-person review-person-name review-badges review-badge review-inline '
      + 'review-textarea review-fieldset review-check doc-field doc-action review-action review-secondary doc-list doc-skeleton doc-skel-row').split(' '));
    const used = [...src.matchAll(/className="([^"]*)"/g)].flatMap(m => m[1].split(/\s+/).filter(Boolean));
    expect(used.length).toBeGreaterThan(10);
    expect(used.filter(c => !allowed.has(c))).toEqual([]);
    expect(src).not.toMatch(/className=\{/);
    expect(src).not.toContain('style=');
    expect(src).not.toContain('dangerouslySetInnerHTML');
  });

  it('P14 the review page hands the panel data only, and reads the list for every reader of the project', async () => {
    const src = await readFile('src/app/review/page.tsx', 'utf8');
    expect(src).toContain('loadOwnProposals(');
    expect(src).toContain('listOwn(');
    expect(src).not.toContain('.catch(');
    expect(src).toContain('coordinator: delegations.canDesignate');
    expect(src).toContain('accountAdmin: principal.accountAdmin === true');
    // the read is not behind the coordinator flag (OQ-50 c)
    expect(src).not.toMatch(/if\s*\([^)]*canDesignate/);
    expect(src).not.toMatch(/canDesignate\s*(?:&&|\?)[^;]*loadOwnProposals/);
    expect(src).toContain('proposals={');
  });

  it('P15 OQ-50 a former coordinator who is still a member sees the own ballots and Rút phiếu, and no proposal form', () => {
    const pending = ballot(), approved = ballot({ approvalId: U(801), userId: BUSINESS, state: 'approved' });
    const p = driveProposals({ state: 'former', proposals: [pending, approved] });
    const out = p.html();
    expect(out).toContain(FORMER_COPY);
    expect(out).toContain('Phiếu anh/chị đã trình');
    expect(rowsOf(p.all(), 'pending')).toHaveLength(1);
    expect(rowsOf(p.all(), 'approved')).toHaveLength(1);
    expect(p.buttons()).toEqual(['Rút phiếu']);
    expect(out).not.toContain('name="proposalUserId"');
    expect(out).not.toContain('Trình phiếu mới');
    expect(p.buttons()).not.toContain('Trình phiếu');
    expect(out).not.toContain('24 giờ');
    expect(out).not.toContain(COORDINATOR_NOTE);
    p.click('Rút phiếu');
    p.set('withdrawBasis', 'Không còn là điều phối');
    p.click('Xác nhận rút');
    expect(p.withdrawn).toEqual([{ approvalId: pending.approvalId, reason: 'Không còn là điều phối' }]);
    const screen = queue({ state: 'ready', items: [pending], canPropose: false });
    expect(screen).toContain(FORMER_COPY);
    expect(screen).toContain('Rút phiếu');
    expect(screen).not.toContain('name="proposalUserId"');
    expect(screen).not.toContain('24 giờ');
  });

  // ---- fix round 1 (code review Important 1 and minors 2, 3; UI review I-1, I-2) ----
  it('P16 after a reloadable refusal «Tải lại» rereads the approvers before the list, so the held types and expectedTypes the form sends are fresh', async () => {
    const conflict = proposalFailure(new ApiError('Quyền duyệt của người này đã đổi. Tải lại trước khi trình. [VERSION_CONFLICT]', 'VERSION_CONFLICT', 409));
    expect(conflict.reloadable).toBe(true);
    // the page's snapshot says the engineer holds design; the service already holds design and plan
    let approvers: ApproverView[] = [{ userId: ENGINEER, docTypes: ['design'] }];
    const calls: string[] = [];
    const io = { readDelegations: async () => { calls.push('delegations'); approvers = [{ userId: ENGINEER, docTypes: ['design', 'plan'] }]; },
      readOwn: async () => { calls.push('own'); return [ballot()]; } };
    const draft: ProposalDraft = { ...EMPTY_PROPOSAL_DRAFT, userId: ENGINEER, docTypes: ['verification'], basis: 'Cần duyệt bản kiểm thử' };
    const stale = proposeCommand(draft, heldTypes(approvers, ENGINEER));
    expect(stale.ok && stale.cmd.expectedTypes).toEqual(['design']);
    expect(await reloadProposals(io, conflict.reloadable)).toEqual({ own: { kind: 'ok', items: [ballot()] }, delegationsError: '' });
    expect(calls).toEqual(['delegations', 'own']);
    const fresh = proposeCommand(draft, heldTypes(approvers, ENGINEER));
    expect(fresh.ok && fresh.cmd.expectedTypes).toEqual(['design', 'plan']);
    expect(fresh.ok && fresh.cmd.docTypes).toEqual(['verification']);
    // the form drawn with the fresh approvers shows plan as held
    const after = driveProposals({ approvers, draft });
    expect(after.field('proposalType:plan').props.disabled).toBe(true);
    expect(after.html()).toContain('Kế hoạch — đang giữ');
    // «Thử lại» of the error state, with no refusal shown, reads the list only
    calls.length = 0;
    await reloadProposals(io, false);
    expect(calls).toEqual(['own']);
    // a failed reread of the approvers is said, the list is still read, and nothing throws
    const network = await reloadProposals({ readDelegations: async () => { throw new TypeError('fetch failed'); }, readOwn: async () => [] }, true);
    expect(network).toEqual({ own: { kind: 'ok', items: [] }, delegationsError: NETWORK_COPY });
    expect(await reloadProposals({ readDelegations: async () => {}, readOwn: async () => { throw new ApiError('Không tìm thấy mục trong phạm vi được cấp. [SCOPE_DENIED]', 'SCOPE_DENIED', 404); } }, true))
      .toEqual({ own: { kind: 'denied' }, delegationsError: '' });
    expect(await reloadProposals({ readDelegations: async () => {}, readOwn: async () => { throw new Error('boom'); } }, false)).toEqual({ own: { kind: 'failed' }, delegationsError: '' });
    // the queue screen passes the refusal's reloadable flag and applies the outcome of reloadProposals
    const src = await readFile('src/components/review.tsx', 'utf8');
    expect(src).toContain('reloadProposals(');
    expect(src).toContain('onReload={() => void reloadOwn(proposalReloadable)}');
  });

  it('P17 a command clears only its own fields, and only while they still hold what was sent; false keeps the whole draft', async () => {
    const sent: ProposalDraft = { ...EMPTY_PROPOSAL_DRAFT, userId: ENGINEER, docTypes: ['plan'], basis: 'Căn cứ đã gửi', withdrawId: U(800), withdrawBasis: 'Đang gõ dở' };
    const PROPOSE_CLEAR = { userId: '', docTypes: [], basis: '' }, WITHDRAW_CLEAR = { withdrawId: null, withdrawBasis: '' };
    expect(settledDraft(sent, sent, PROPOSE_CLEAR, false)).toBe(sent);
    expect(settledDraft(sent, sent, PROPOSE_CLEAR, true)).toEqual({ ...sent, ...PROPOSE_CLEAR });
    expect(settledDraft(sent, sent, PROPOSE_CLEAR, undefined)).toEqual({ ...sent, ...PROPOSE_CLEAR });
    // a proposal typed while the command was in flight is kept whole
    const retyped = { ...sent, basis: 'Căn cứ mới đang gõ' };
    expect(settledDraft(retyped, sent, PROPOSE_CLEAR, true)).toBe(retyped);
    const otherTypes = { ...sent, docTypes: ['plan', 'guide'] as ProposalDraft['docTypes'] };
    expect(settledDraft(otherTypes, sent, PROPOSE_CLEAR, true)).toBe(otherTypes);
    // a withdrawal clears the withdrawal box and leaves a proposal typed meanwhile
    const typedMeanwhile = { ...sent, userId: BUSINESS, basis: 'Một phiếu khác' };
    expect(settledDraft(typedMeanwhile, sent, WITHDRAW_CLEAR, true)).toEqual({ ...typedMeanwhile, ...WITHDRAW_CLEAR });
    expect(settledDraft({ ...sent, withdrawBasis: 'Căn cứ rút đã sửa' }, sent, WITHDRAW_CLEAR, true).withdrawBasis).toBe('Căn cứ rút đã sửa');
    const src = await readFile('src/components/doc-approval-proposals.tsx', 'utf8');
    expect(src).toContain('settledDraft(');
  });

  it('P18 focus: the withdrawal box takes focus when it opens; «Hủy» and a successful withdrawal hand it back', async () => {
    const closed = driveProposals({ proposals: [ballot()] });
    expect(closed.html()).not.toContain('autofocus');
    closed.click('Rút phiếu');
    const open = closed.html();
    expect(open.match(/<input[^>]*name="withdrawBasis"[^>]*>/)?.[0]).toContain('autofocus=""');
    expect(open.split('autofocus').length - 1).toBe(1);
    // the list heading can take focus from the script and is not a tab stop
    expect(open).toContain('<h3 tabindex="-1">Phiếu anh/chị đã trình</h3>');
    expect(open).toContain('<h3>Trình phiếu mới</h3>');
    expect(driveProposals({ state: 'former', proposals: [ballot()] }).html()).toContain('<h3 tabindex="-1">Phiếu anh/chị đã trình</h3>');
    // a browser moves focus; static markup cannot, so the two moves are pinned in the source (the manual check is in the spec's «Kiểm tay»)
    const src = await readFile('src/components/doc-approval-proposals.tsx', 'utf8');
    for (const name of ['heading.current?.focus()', 'withdrawButtons.current.get(', "setFocus({ to: 'withdraw'", "{ to: 'list' }", 'listHeadingRef={heading}', 'withdrawButtonRef={']) expect(src, name).toContain(name);
  });

  it('P19 an error is echoed, hidden from screen readers, right above the button that sends; «Tải lại» waits while a command runs', () => {
    const local = driveProposals({ localError: PICK_MEMBER }).html();
    expect(local).toMatch(/role="alert"[^>]*><p[^>]*>Chọn một thành viên\./);
    expect(local).toMatch(/<div class="review-problem" aria-hidden="true"><p class="review-text">Chọn một thành viên\.<\/p><\/div><button type="button" class="doc-action review-action">Trình phiếu<\/button>/);
    expect(local.indexOf('aria-hidden="true"><p class="review-text">Chọn một thành viên.')).toBeGreaterThan(local.indexOf('name="proposalBasis"'));
    expect(local.split('Chọn một thành viên.').length - 1).toBe(2);
    // a command's refusal is echoed the same way
    expect(driveProposals({ error: 'Người này đang có một phiếu đổi quyền chưa xong.' }).html())
      .toMatch(/aria-hidden="true"><p class="review-text">Người này đang có một phiếu đổi quyền chưa xong\.<\/p><\/div><button type="button" class="doc-action review-action">Trình phiếu<\/button>/);
    // with a withdrawal box open, the echo also stands right above «Xác nhận rút»
    const withdrawing = driveProposals({ proposals: [ballot()], draft: { ...EMPTY_PROPOSAL_DRAFT, withdrawId: U(800), withdrawBasis: 'abc' }, localError: LENGTH_500 }).html();
    expect(withdrawing).toMatch(/<div class="review-problem" aria-hidden="true"><p class="review-text">Căn cứ cần từ 5 đến 500 ký tự\.<\/p><\/div><button type="button" class="doc-action review-action">Xác nhận rút<\/button>/);
    const former = driveProposals({ state: 'former', proposals: [ballot()], draft: { ...EMPTY_PROPOSAL_DRAFT, withdrawId: U(800), withdrawBasis: 'abc' }, localError: LENGTH_500 }).html();
    expect(former).toMatch(/aria-hidden="true"><p class="review-text">Căn cứ cần từ 5 đến 500 ký tự\.<\/p><\/div><button type="button" class="doc-action review-action">Xác nhận rút<\/button>/);
    // no error, no echo
    expect(driveProposals({ proposals: [ballot()] }).html()).not.toContain('review-problem');
    // «Tải lại» is disabled while a command is busy
    const reload = (busy: boolean) => driveProposals({ error: 'Quyền duyệt của người này đã đổi. Tải lại trước khi trình. [VERSION_CONFLICT]', reloadable: true, busy })
      .all().find(h => h.type === 'button' && textOf(h.props.children) === 'Tải lại');
    expect(reload(true)?.props.disabled).toBe(true);
    expect(reload(false)?.props.disabled).toBe(false);
  });

  // ---- Codex gate round 1, P2 (OQ-50 c; docs/UI-HANDOFF-3-doc-approval.md §4) ----
  it('P20 after the reviewers panel is read again the block follows the fresh canDesignate, not the standing the page read: a demoted coordinator gets former or denied, a promoted member the form', async () => {
    expect(typeof standingAfterReread, 'standingAfterReread is exported by doc-approval-view.ts').toBe('function');
    const read = (canPropose: boolean, items: DocApprovalProposal[]): ProposalsInitial => ({ state: 'ready', items, canPropose });
    /** The block's state once a reread of the reviewers panel brought `fresh` as canDesignate, the own list holding `count` ballots. */
    const afterReread = (initial: ProposalsInitial, fresh: boolean, count: number) => proposalPanelState({ loading: false, admin: false, failed: false, denied: false,
      canPropose: canProposeFrom(standingAfterReread(initial, fresh), fresh), count });
    // a coordinator demoted while the page is open: «Trình phiếu» answers MANAGER_REQUIRED, which is reloadable; «Tải lại» brings canDesignate=false
    expect(proposalFailure(new ApiError('Chỉ điều phối dự án được thực hiện thao tác này. [MANAGER_REQUIRED]', 'MANAGER_REQUIRED', 403)).reloadable).toBe(true);
    expect(afterReread(read(true, [ballot()]), false, 1)).toBe('former');
    expect(afterReread(read(true, []), false, 0)).toBe('denied');
    // a member promoted while the page is open gets the form
    expect(afterReread(read(false, []), true, 0)).toBe('empty');
    expect(afterReread(read(false, [ballot()]), true, 1)).toBe('ready');
    // an unchanged standing changes nothing; the list the page read is kept as it is
    expect(standingAfterReread(read(true, [ballot()]), true)).toEqual(read(true, [ballot()]));
    expect(standingAfterReread(read(true, [ballot()]), false)).toEqual(read(false, [ballot()]));
    // the states without a standing of their own are returned as they are: canProposeFrom already reads canDesignate for them
    for (const s of [{ state: 'error' }, { state: 'denied' }, { state: 'admin' }] as ProposalsInitial[]) expect(standingAfterReread(s, true)).toBe(s);
    expect(standingAfterReread(undefined, true)).toBeUndefined();
    // wiring: every reread of the reviewers panel (the block's «Tải lại», the panel's «Tải lại», after a grant or revoke) goes through
    // reloadDelegations, which hands the fresh canDesignate to the block's standing; the first render reads canProposeFrom as before
    const src = await readFile('src/components/review.tsx', 'utf8');
    expect(src).toMatch(/async function reloadDelegations\(\) \{[^}]*setDelegations\(fresh\);[^}]*setProposals\(p => standingAfterReread\(p, fresh\.canDesignate === true\)\);/);
    expect(src).toContain('const [proposals, setProposals] = useState(pageProposals)');
    expect(src).toContain('canProposeFrom(proposals, delegations?.canDesignate === true)');
  });
});
