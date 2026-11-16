'use client';
import { useState, type ReactNode } from 'react';
import type { DocApprovalProposal } from '../server/doc-approval-proposals';
import type { ApproverView } from '../server/review-delegations';
import type { DocType } from '../server/types';
import { formatTime } from './inbox-view';
import { roleLabel } from './grant-labels';
import { DOC_TYPES, docTypeLabel, sameId, selectableMembers } from './review-view';
import { EMPTY_PROPOSAL_DRAFT, heldTypes, proposeCommand, withdrawCommand, proposalStateLabel, PROPOSAL_PANEL_TITLE, PROPOSALS_LOADING_LABEL, PROPOSALS_ADMIN_COPY,
  PROPOSALS_LOAD_ERROR_COPY, PROPOSALS_DENIED_COPY, PROPOSALS_FORMER_COPY, PROPOSALS_EMPTY_COPY, PROPOSALS_COORDINATOR_COPY, PROPOSALS_WAIT_COPY, PROPOSALS_APPROVED_NOTE,
  PROPOSALS_CO_MANAGER_COPY, type ProposalDraft, type ProposalPanelState } from './doc-approval-view';

// Block «Trình phiếu cấp quyền duyệt bản chuẩn» of the Review screen (Task 7c, step 16b). It grants nothing: a proposal is an access-change ballot
// that one BoM member agrees to and only the account admin applies, on /team. The state, the rows and every refusal come from the service.
// Text written by people (names) is rendered as React text inside <bdi dir="auto">.
type Person = { id: string; name: string; role: string };
type ProposeCmd = { userId: string; docTypes: DocType[]; expectedTypes: DocType[]; reason: string };
type WithdrawCmd = { approvalId: string; reason: string };
const UNKNOWN_PERSON = 'Thành viên chưa rõ tên';
const nameOf = (people: Person[], id: string) => people.find(p => sameId(p.id, id))?.name ?? UNKNOWN_PERSON;

export type DocApprovalPanelViewProps = { state: ProposalPanelState; proposals: DocApprovalProposal[]; approvers: ApproverView[]; people: Person[]; viewerId: string; busy: boolean;
  error: string; notice: string; reloadable: boolean; localError: string; draft: ProposalDraft; onDraft: (p: Partial<ProposalDraft>) => void;
  onPropose: (c: ProposeCmd) => void; onWithdraw: (c: WithdrawCmd) => void; onInvalid: (m: string) => void; onReload?: () => void };

/** The block without state of its own. Its buttons are «Trình phiếu» and, on a pending row of the viewer's own, «Rút phiếu»; nothing else. */
export function DocApprovalPanelView(p: DocApprovalPanelViewProps): ReactNode {
  const { state, proposals, approvers, people, viewerId, busy, draft } = p;
  const shownError = p.error || p.localError;
  const section = (children: ReactNode) => <section className="review-panel" aria-label={PROPOSAL_PANEL_TITLE}>
    <h2>{PROPOSAL_PANEL_TITLE}</h2>
    <p className="review-notice" role="status">{p.notice}</p>
    {shownError && <div role="alert" className="review-problem"><p className="review-text">{shownError}</p>
      {p.reloadable && p.onReload && <button type="button" className="doc-action review-action review-secondary" onClick={p.onReload}>Tải lại</button>}</div>}
    {children}
  </section>;

  if (state === 'loading') return section(<div className="doc-list doc-skeleton" aria-busy="true" aria-label={PROPOSALS_LOADING_LABEL}>
    {[0, 1, 2].map(i => <div key={i} className="doc-skel-row" aria-hidden="true" />)}</div>);
  // T7C-4: the account admin proposes on the admin's own page; no form here
  if (state === 'admin') return section(<><p className="review-text">{PROPOSALS_ADMIN_COPY}</p>
    <a className="doc-action review-action" href="/team">Mở trang Quản trị tài khoản</a></>);
  if (state === 'error') return section(<div role="alert" className="review-problem"><p className="review-text">{PROPOSALS_LOAD_ERROR_COPY}</p>
    <button type="button" className="doc-action review-action" onClick={p.onReload}>Thử lại</button></div>);
  if (state === 'denied') return section(<p className="review-text">{PROPOSALS_DENIED_COPY}</p>);

  const row = (r: DocApprovalProposal) => {
    const open = r.state === 'pending' && draft.withdrawId !== null && sameId(draft.withdrawId, r.approvalId);
    return <li key={r.approvalId} className="review-person" data-state={r.state}>
      <strong className="review-person-name"><bdi dir="auto">{nameOf(people, r.userId)}</bdi></strong>
      <span className="review-badges">{r.addedTypes.map(t => <span key={t} className="review-badge">{docTypeLabel(t)}</span>)}</span>
      <span className="review-meta">Hết hạn lúc {formatTime(r.expiresAt)}</span>
      <p className="review-text">{proposalStateLabel(r.state)}</p>
      {/* decision OQ-51 (b): a ballot a BoM member agreed to is not withdrawn here */}
      {r.state === 'approved' && <p className="review-meta">{PROPOSALS_APPROVED_NOTE}</p>}
      {r.state === 'pending' && !open && <button type="button" className="doc-action review-action review-secondary" disabled={busy}
        onClick={() => p.onDraft({ withdrawId: r.approvalId, withdrawBasis: '' })}>Rút phiếu</button>}
      {open && <div className="review-inline">
        <label className="doc-field">Căn cứ rút phiếu (5–500 ký tự)<input type="text" name="withdrawBasis" value={draft.withdrawBasis} onChange={e => p.onDraft({ withdrawBasis: e.target.value })} /></label>
        <button type="button" className="doc-action review-action" disabled={busy}
          onClick={() => { const c = withdrawCommand(r, draft.withdrawBasis); if (c.ok) p.onWithdraw(c.cmd); else p.onInvalid(c.error); }}>Xác nhận rút</button>
        <button type="button" className="doc-action review-action review-secondary" disabled={busy} onClick={() => p.onDraft({ withdrawId: null, withdrawBasis: '' })}>Hủy</button>
      </div>}
    </li>;
  };
  const list = <><h3>Phiếu anh/chị đã trình</h3>
    {proposals.length === 0 ? <p className="review-text">{PROPOSALS_EMPTY_COPY}</p> : <ul className="review-plain">{proposals.map(row)}</ul>}</>;
  // decision OQ-50 (c): no longer a coordinator, still a member: the own ballots and «Rút phiếu», no form
  if (state === 'former') return section(<><p className="review-text">{PROPOSALS_FORMER_COPY}</p>{list}</>);

  const members = selectableMembers(people, viewerId);
  const chosen = draft.userId ? members.find(m => sameId(m.id, draft.userId)) : undefined;
  const held = draft.userId ? heldTypes(approvers, draft.userId) : [];
  return section(<>
    <p className="review-text">{PROPOSALS_COORDINATOR_COPY}</p>
    {list}
    <p className="review-meta">{PROPOSALS_WAIT_COPY}</p>
    <div className="review-form" role="group" aria-label="Trình phiếu mới">
      <h3>Trình phiếu mới</h3>
      <label className="doc-field">Thành viên<select name="proposalUserId" value={draft.userId} onChange={e => p.onDraft({ userId: e.target.value })}>
        <option value="">Chọn thành viên</option>{members.map(m => <option key={m.id} value={m.id}>{m.name} · {roleLabel(m.role)}</option>)}</select></label>
      {chosen?.role === 'manager' && <p className="review-text">{PROPOSALS_CO_MANAGER_COPY}</p>}
      <fieldset className="review-fieldset"><legend>Loại tài liệu được duyệt bản chuẩn (chọn thêm ít nhất một)</legend>
        {DOC_TYPES.map(t => {
          const isHeld = held.includes(t);
          return <label key={t} className="review-check"><input type="checkbox" name={'proposalType:' + t} value={t} checked={isHeld || draft.docTypes.includes(t)} disabled={isHeld}
            onChange={e => { const rest = draft.docTypes.filter(x => x !== t); p.onDraft({ docTypes: e.target.checked ? [...rest, t] : rest }); }} />{docTypeLabel(t)}{isHeld ? ' — đang giữ' : ''}</label>;
        })}</fieldset>
      <label className="doc-field">Căn cứ (5–300 ký tự, một dòng)<input type="text" name="proposalBasis" value={draft.basis} onChange={e => p.onDraft({ basis: e.target.value })} /></label>
      <button type="button" className="doc-action review-action" disabled={busy}
        onClick={() => { const c = proposeCommand(draft, held); if (c.ok) p.onPropose(c.cmd); else p.onInvalid(c.error); }}>Trình phiếu</button>
    </div>
  </>);
}

export type DocApprovalPanelProps = { state: ProposalPanelState; proposals: DocApprovalProposal[]; approvers: ApproverView[]; people: Person[]; viewerId: string; busy: boolean;
  error: string; notice?: string; reloadable?: boolean; onReload?: () => void;
  onPropose?: (c: ProposeCmd) => void | Promise<boolean | void>;
  onWithdraw?: (c: WithdrawCmd) => void | Promise<boolean | void> };

/** Holds what the person is typing. The draft survives every error; a command that does not answer `false` clears only its own part of it
 *  (a proposal the form, a withdrawal the withdrawal box), so a proposal half typed survives withdrawing another ballot. */
export function DocApprovalPanel(props: DocApprovalPanelProps): ReactNode {
  const [draft, setDraft] = useState<ProposalDraft>(EMPTY_PROPOSAL_DRAFT), [localError, setLocalError] = useState('');
  const settle = async (run: Promise<boolean | void> | void, cleared: Partial<ProposalDraft>) => { setLocalError(''); if ((await run) !== false) setDraft(d => ({ ...d, ...cleared })); };
  return <DocApprovalPanelView {...props} notice={props.notice ?? ''} reloadable={props.reloadable ?? false} localError={localError} draft={draft}
    onDraft={patch => { setLocalError(''); setDraft(d => ({ ...d, ...patch })); }} onInvalid={setLocalError}
    onPropose={cmd => { if (props.onPropose) void settle(props.onPropose(cmd), { userId: '', docTypes: [], basis: '' }); }}
    onWithdraw={cmd => { if (props.onWithdraw) void settle(props.onWithdraw(cmd), { withdrawId: null, withdrawBasis: '' }); }} />;
}
