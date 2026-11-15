'use client';
import { useRef, useState, type ReactNode } from 'react';
import type { ReviewItem, ReviewRevision, ReviewDetail, DiffEntry, CommentView } from '../server/document-review';
import type { DependencyView } from '../server/document-dependencies';
import type { ListedDelegation, ApproverView } from '../server/review-delegations';
import type { DocType } from '../server/types';
import { api } from './api';
import { formatTime } from './inbox-view';
import { roleLabel } from './grant-labels';
import { reviewPageState, eligibilityCopy, diffLabel, approverCopy, decisionStateLabel, hashLabel, fieldLabel, docTypeLabel, describeError, idempotencyKey, postReview, commandFailure, commandSuccess, panelFailure, panelSuccess, panelReloadFailure,
  decisionBody, commentBody, grantBody, revokeBody, decisionCommand, commentCommand, replyCommand, grantCommand, revokeCommand, selectableMembers, sameId,
  DOC_TYPES, EMPTY_PANEL_DRAFT, QUEUE_PAGE_SIZE, queueWindow, queueHref, EMPTY_COPY, DENIED_COPY, ERROR_COPY, NOT_FOUND_COPY, CONFLICT_COPY, NOT_COORDINATOR_COPY, APPROVAL_NOTE_COPY, REVOKED_NOTICE, DECIDED_COPY, TRUNCATED_COPY, NO_REVISION_COPY,
  type ReviewPageState, type ReviewForm, type DecisionDraft, type CommentDraft, type PanelDraft, type DecisionCmd } from './review-view';

// Review screens. Text from the database (titles, summaries, comments, bases, names) is rendered as React text only.
// Buttons follow the service's `eligibility`, `canDesignate` and the per-comment `canAddress` / `canResolve`; this file computes no permission of its own.
type Person = { id: string; name: string };
type KeyStore = { current: { fingerprint: string; key: string } | null };
const UNKNOWN_PERSON = 'Thành viên chưa rõ tên';
const nameOf = (people: Person[], id: string | null) => (id === null ? UNKNOWN_PERSON : people.find(p => sameId(p.id, id))?.name ?? UNKNOWN_PERSON);
const Skeleton = ({ label }: { label: string }) => <div className="doc-list doc-skeleton" aria-busy="true" aria-label={label}>{[0, 1, 2].map(i => <div key={i} className="doc-skel-row" aria-hidden="true" />)}</div>;
const TypeBadges = ({ types }: { types: readonly string[] }) => <span className="review-badges">{types.map(t => <span key={t} className="review-badge">{docTypeLabel(t)}</span>)}</span>;

// ---------- queue ----------
export function ReviewQueueBody({ state, items, total, error, projectLabel, onRetry, projectId, offset = 0 }: { state: ReviewPageState; items: ReviewItem[]; total: number; error: string | null; projectLabel: string; onRetry?: () => void; projectId?: string; offset?: number }) {
  if (state === 'loading') return <Skeleton label="Đang tải danh sách review" />;
  if (state === 'denied') return <div className="doc-state doc-denied" role="status"><h2>{DENIED_COPY}</h2><p>Trang này không hiện dữ liệu của dự án.</p></div>;
  if (state === 'error') return <div className="doc-state doc-error" role="alert"><h2>{ERROR_COPY}</h2>{error && error !== ERROR_COPY && <p className="review-text">{error}</p>}
    <button type="button" className="doc-action review-action" onClick={onRetry}>Thử lại</button></div>;
  if (state === 'empty') return <div className="doc-state doc-empty"><h2>{EMPTY_COPY}</h2></div>;
  const span = queueWindow(offset, items.length, total);
  return <div className="review-list" role="list" aria-label={'Tài liệu cần review của ' + projectLabel}>
    {items.map(it => <article key={it.documentId + ':' + it.revision.id} role="listitem" className="review-card" data-decision={it.decision?.result ?? 'none'}>
      <h3 className="review-title" dir="auto">{it.refCode} · {it.title}</h3>
      <p className="review-meta">{docTypeLabel(it.docType)} · bản r{it.revision.revisionNo} · hash {hashLabel(it.revision.hashVerification)}</p>
      <p className="review-badges"><span className="review-badge">{decisionStateLabel(it.decision)}</span><span className="review-badge">{approverCopy(it.approverState)}</span></p>
      {it.decision && <p className="review-notice">{DECIDED_COPY}</p>}
      <a className="doc-action review-action" href={'/review/' + it.documentId}>Mở để review</a>
    </article>)}
    <p className="doc-meta" role="status">{span.label} tài liệu</p>
    {projectId && (span.prevOffset !== null || span.nextOffset !== null) && <nav className="review-paging" aria-label="Phân trang">
      {span.prevOffset !== null && <a className="doc-action review-action review-secondary" href={queueHref(projectId, span.prevOffset)}>Trang trước</a>}
      {span.nextOffset !== null && <a className="doc-action review-action review-secondary" href={queueHref(projectId, span.nextOffset)}>Trang sau</a>}</nav>}</div>;
}

// ---------- reviewers panel ----------
export type PanelViewProps = { reviewers: ListedDelegation[]; approvers: ApproverView[]; people: { id: string; name: string; role: string }[]; viewerId: string; canDesignate: boolean; busy: boolean; truncated?: boolean;
  error: string; notice: string; reloadable: boolean; localError: string; draft: PanelDraft; onDraft: (p: Partial<PanelDraft>) => void;
  onGrant: (c: { delegateId: string; docTypes: DocType[]; basis: string }) => void; onRevoke: (c: { delegationId: string; expectedVersion: number; basis: string }) => void;
  onInvalid: (m: string) => void; onReload?: () => void };

/** Block «Người nhận xét của dự án», without state of its own. Nothing here touches document approval: that right is granted only through an access-change ballot. */
export function ReviewersPanelView(p: PanelViewProps) {
  const { reviewers, approvers, people, viewerId, canDesignate, busy, draft } = p;
  const live = reviewers.filter(r => r.revokedAt === null), gone = reviewers.filter(r => r.revokedAt !== null);
  const shownError = p.error || p.localError;
  const row = (r: ListedDelegation) => {
    const own = sameId(r.delegateId, viewerId);
    const mayRead = canDesignate || own;              // another person's basis is for the coordinator alone, whatever the component is handed
    const open = draft.revokeId === r.id;
    return <li key={r.id} className="review-person" data-own={own ? 'yes' : 'no'}>
      <strong className="review-person-name">{nameOf(people, r.delegateId)}{own ? ' (anh/chị)' : ''}</strong>
      <TypeBadges types={r.docTypes} />
      {canDesignate && r.designatorIsCoordinator === false && <span className="review-flag">người chỉ định không còn là điều phối</span>}
      {canDesignate && r.dormant === true && <span className="review-flag">đang ngủ</span>}
      {typeof r.createdAt === 'string' && <span className="review-meta">Chỉ định lúc {formatTime(r.createdAt)}</span>}
      {mayRead && typeof r.basis === 'string' && <span className="review-meta">Căn cứ: <bdi dir="auto">{r.basis}</bdi></span>}
      {typeof r.revokedAt === 'string' && <span className="review-meta">Đã thu hồi lúc {formatTime(r.revokedAt)}{r.revokedBy ? ' bởi ' + nameOf(people, r.revokedBy) : ''}</span>}
      {mayRead && typeof r.revokeBasis === 'string' && <span className="review-meta">Căn cứ thu hồi: <bdi dir="auto">{r.revokeBasis}</bdi></span>}
      {canDesignate && r.revokedAt === null && typeof r.version === 'number' && !open && <button type="button" className="doc-action review-action review-secondary" disabled={busy} onClick={() => p.onDraft({ revokeId: r.id, revokeBasis: '' })}>Thu hồi</button>}
      {canDesignate && open && <div className="review-inline">
        <label className="doc-field">Căn cứ thu hồi (5–500 ký tự)<textarea className="review-textarea" name="revokeBasis" value={draft.revokeBasis} onChange={e => p.onDraft({ revokeBasis: e.target.value })} /></label>
        <button type="button" className="doc-action review-action" disabled={busy} onClick={() => { const c = revokeCommand(r, draft.revokeBasis); if (c.ok) p.onRevoke(c.cmd); else p.onInvalid(c.error); }}>Xác nhận thu hồi</button>
        <button type="button" className="doc-action review-action review-secondary" disabled={busy} onClick={() => p.onDraft({ revokeId: null, revokeBasis: '' })}>Hủy</button>
      </div>}
    </li>;
  };
  const members = selectableMembers(people, viewerId);
  return <section className="review-panel" aria-label="Người nhận xét của dự án">
    <h2>Người nhận xét của dự án</h2>
    <p className="review-notice" role="status">{p.notice}</p>
    {shownError && <div role="alert" className="review-problem"><p className="review-text">{shownError}</p>
      {p.reloadable && p.onReload && <button type="button" className="doc-action review-action review-secondary" onClick={p.onReload}>Tải lại</button>}</div>}
    {live.length === 0 ? <p className="review-text">Chưa có người nhận xét nào được chỉ định.</p> : <ul className="review-plain">{live.map(row)}</ul>}
    {p.truncated && <p className="review-meta">{TRUNCATED_COPY}</p>}
    {gone.length > 0 && <><h3>Đã thu hồi</h3><ul className="review-plain">{gone.map(row)}</ul></>}
    {canDesignate && <p className="review-meta">Muốn đổi loại tài liệu của một người: thu hồi rồi chỉ định lại.</p>}
    <h3>Người giữ quyền duyệt bản chuẩn</h3>
    {approvers.length === 0 ? <p className="review-text">{approverCopy('unassigned')}</p> : <ul className="review-plain">
      {approvers.map(a => <li key={a.userId} className="review-person"><strong className="review-person-name">{nameOf(people, a.userId)}</strong><TypeBadges types={a.docTypes} /></li>)}</ul>}
    <p className="review-meta">{APPROVAL_NOTE_COPY}</p>
    {canDesignate ? <div className="review-form" role="group" aria-label="Chỉ định người nhận xét">
      <h3>Chỉ định người nhận xét</h3>
      <label className="doc-field">Thành viên<select name="delegateId" value={draft.delegateId} onChange={e => p.onDraft({ delegateId: e.target.value })}>
        <option value="">Chọn thành viên</option>{members.map(m => <option key={m.id} value={m.id}>{m.name} · {roleLabel(m.role)}</option>)}</select></label>
      <fieldset className="review-fieldset"><legend>Loại tài liệu được nhận xét (chọn ít nhất một)</legend>
        {DOC_TYPES.map(t => <label key={t} className="review-check"><input type="checkbox" name={'docType:' + t} value={t} checked={draft.docTypes.includes(t)}
          onChange={e => { const rest = draft.docTypes.filter(x => x !== t); p.onDraft({ docTypes: e.target.checked ? [...rest, t] : rest }); }} />{docTypeLabel(t)}</label>)}</fieldset>
      <label className="doc-field">Căn cứ (5–500 ký tự)<input type="text" name="basis" value={draft.basis} onChange={e => p.onDraft({ basis: e.target.value })} /></label>
      <button type="button" className="doc-action review-action" disabled={busy} onClick={() => { const c = grantCommand(draft); if (c.ok) p.onGrant(c.cmd); else p.onInvalid(c.error); }}>Chỉ định</button>
    </div> : <p className="review-text">{NOT_COORDINATOR_COPY}</p>}
  </section>;
}

export type PanelProps = { reviewers: ListedDelegation[]; approvers: ApproverView[]; people: { id: string; name: string; role: string }[]; viewerId: string; canDesignate: boolean; busy: boolean; truncated?: boolean; error: string;
  notice?: string; reloadable?: boolean; onReload?: () => void;
  onGrant?: (cmd: { delegateId: string; docTypes: DocType[]; basis: string }) => void | Promise<boolean | void>;
  onRevoke?: (cmd: { delegationId: string; expectedVersion: number; basis: string }) => void | Promise<boolean | void> };

/** Holds what the person is typing. The draft survives every error; it is cleared only when the command reports success (a result of `false` means it failed). */
export function ReviewersPanel(props: PanelProps) {
  const [draft, setDraft] = useState<PanelDraft>(EMPTY_PANEL_DRAFT), [localError, setLocalError] = useState('');
  const settle = async (run: Promise<boolean | void> | void) => { setLocalError(''); if ((await run) !== false) setDraft(EMPTY_PANEL_DRAFT); };
  return <ReviewersPanelView {...props} notice={props.notice ?? ''} reloadable={props.reloadable ?? false} localError={localError} draft={draft}
    onDraft={patch => { setLocalError(''); setDraft(d => ({ ...d, ...patch })); }} onInvalid={setLocalError}
    onGrant={cmd => { if (props.onGrant) void settle(props.onGrant(cmd)); }} onRevoke={cmd => { if (props.onRevoke) void settle(props.onRevoke(cmd)); }} />;
}

// ---------- diff and comments ----------
const ANCHORS: DiffEntry['field'][] = ['summary', 'present', 'missing', 'source_refs', 'source_revision', 'source_hash'];
const List = ({ items }: { items: string[] }) => items.length === 0 ? <span className="review-meta">Không có</span> : <ul className="review-plain">{items.map((s, i) => <li key={i} className="review-text" dir="auto">{s}</li>)}</ul>;

function ReplyActions({ comment, onReply }: { comment: CommentView; onReply: (cmd: { kind: 'addressed' | 'resolved'; parentId: string; body: string }) => Promise<boolean | void> }) {
  const [text, setText] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const send = async (kind: 'addressed' | 'resolved') => {
    const c = replyCommand(kind, comment.id, text);
    if (!c.ok) { setError(c.error); return; }
    setBusy(true); setError('');
    try { if ((await onReply(c.cmd)) !== false) setText(''); } catch (e) { setError(describeError(e).text); } finally { setBusy(false); }
  };
  return <div className="review-inline">
    <label className="doc-field">Ghi chú trả lời<textarea className="review-textarea" name="reply" value={text} onChange={e => { setError(''); setText(e.target.value); }} /></label>
    {error && <p role="alert" className="review-problem review-text">{error}</p>}
    {comment.canAddress && <button type="button" className="doc-action review-action review-secondary" disabled={busy} onClick={() => void send('addressed')}>Đã sửa</button>}
    {comment.canResolve && <button type="button" className="doc-action review-action review-secondary" disabled={busy} onClick={() => void send('resolved')}>Xác nhận đã xử lý</button>}
  </div>;
}

export type DiffProps = { base: ReviewRevision | null; candidate: ReviewRevision; diff: DiffEntry[]; affectedLinks: DependencyView[]; comments: CommentView[]; sourceChanged: boolean; changedOnly: boolean;
  onReload?: () => void; onMode?: (changedOnly: boolean) => void; documentId?: string; commentsTruncated?: boolean; people?: Person[];
  onReply?: (cmd: { kind: 'addressed' | 'resolved'; parentId: string; body: string }) => Promise<boolean | void> };

export function RevisionDiff({ base, candidate, diff, affectedLinks, comments, sourceChanged, changedOnly, onReload, onMode, documentId, commentsTruncated, people = [], onReply }: DiffProps) {
  const flagged = affectedLinks.filter(l => l.needsReview);
  const revisionNo = (id: string) => (id === candidate.id ? candidate.revisionNo : base && id === base.id ? base.revisionNo : null);
  const top = comments.filter(c => c.parentId === null);
  return <section className="review-section" aria-label="So sánh bản">
    {sourceChanged && <div className="review-problem" role="alert"><p className="review-text">{CONFLICT_COPY}</p>
      <button type="button" className="doc-action review-action" onClick={onReload}>Đọc bản mới</button></div>}
    <h2>Bản r{candidate.revisionNo}{base ? ' so với bản nền r' + base.revisionNo : ' · Chưa có bản nền'}</h2>
    <p className="review-meta">{candidate.frozen ? 'Nguồn đã đóng băng' : 'Nguồn chưa đóng băng'}{candidate.sourceRevision ? '' : ' · chưa ghi bản nguồn'}</p>
    <p className="review-meta">{candidate.sourceHash ? <>SHA-256 {candidate.sourceHash} · <em>{hashLabel(candidate.hashVerification)}</em></> : 'Chưa có hash'}</p>
    {onMode && <div className="review-modes" role="group" aria-label="Chế độ xem">
      <button type="button" className="doc-action review-action review-secondary" aria-pressed={changedOnly} onClick={() => onMode(true)}>Chỉ phần đổi</button>
      <button type="button" className="doc-action review-action review-secondary" aria-pressed={!changedOnly} onClick={() => onMode(false)}>Xem đầy đủ</button></div>}
    {diff.length === 0 ? <p className="review-text">Không có thay đổi so với bản nền.</p> : <ul className="review-plain">
      {diff.map((d, i) => <li key={i} className="review-change" data-change={d.change}>
        <p className="review-meta"><span className="review-badge">{diffLabel(d.change)}</span> {fieldLabel(d.field)}</p>
        <div className="review-diff">
          <div className="review-side"><h4>Trước</h4><p className="review-text" dir="auto">{d.before ?? 'Không có'}</p></div>
          <div className="review-side"><h4>Sau</h4><p className="review-text" dir="auto">{d.after ?? 'Không có'}</p></div></div></li>)}</ul>}
    {!changedOnly && <div className="review-full"><h3>Nội dung đầy đủ của bản r{candidate.revisionNo}</h3>
      <h4>Tóm tắt</h4><p className="review-text" dir="auto">{candidate.changes.summary || 'Không có'}</p>
      <h4>Đã có</h4><List items={candidate.changes.present} />
      <h4>Còn thiếu</h4><List items={candidate.changes.missing} />
      <h4>Nguồn tham chiếu</h4><List items={candidate.sourceRefs.map(r => r.kind + ' · ' + r.label + ' · ' + r.value)} />
      <h4>Bản nguồn</h4><p className="review-text">{candidate.sourceRevision ?? 'Không có'}</p></div>}
    {flagged.length > 0 && <div className="review-flagged"><h3>Tài liệu phụ thuộc cần xem lại</h3><ul className="review-plain">
      {flagged.map(l => <li key={l.id} className="review-text"><bdi dir="auto">{l.note || 'Không có ghi chú'}</bdi>{l.flaggedAt ? ' · đánh dấu lúc ' + formatTime(l.flaggedAt) : ''}
        <br /><a className="doc-action review-action review-secondary" href={'/review/' + (documentId && l.dependentDocumentId === documentId ? l.upstreamDocumentId : l.dependentDocumentId)}>Mở tài liệu liên quan</a></li>)}</ul></div>}
    <h3>Nhận xét</h3>
    {commentsTruncated && <p className="review-meta">{TRUNCATED_COPY}</p>}
    {top.length === 0 ? <p className="review-text">Chưa có nhận xét nào.</p> : <ul className="review-plain">
      {top.map(c => { const replies = comments.filter(r => r.parentId === c.id); const no = revisionNo(c.revisionId);
        return <li key={c.id} className="review-comment">
          <p className="review-meta">{nameOf(people, c.actorId)} · {no === null ? 'bản khác' : 'bản r' + no} · {c.anchor ? fieldLabel(c.anchor) || c.anchor : 'cả bản'} · {formatTime(c.createdAt)}</p>
          <p className="review-text review-comment-body" dir="auto">{c.body}</p>
          {replies.map(r => <p key={r.id} className="review-text review-reply">{r.kind === 'resolved' ? 'Đã xử lý' : 'Trả lời: đã sửa'} · {nameOf(people, r.actorId)}: <bdi dir="auto">{r.body}</bdi></p>)}
          {onReply && (c.canAddress || c.canResolve) && <ReplyActions comment={c} onReply={onReply} />}
        </li>; })}</ul>}
  </section>;
}

// ---------- decision and comment forms ----------
export type DecisionFormProps = { item: ReviewItem; draft: DecisionDraft; busy: boolean; error: string; onDraft: (p: Partial<DecisionDraft>) => void; onSubmit: (c: DecisionCmd) => void; onInvalid: (m: string) => void };
/** The decision part of the actions, without state. Its buttons are exactly the ones `item.eligibility` allows; the sentence is the service's reason. */
export function DecisionFormView({ item, draft, busy, error, onDraft, onSubmit, onInvalid }: DecisionFormProps) {
  const e = item.eligibility, can = e.canApprove || e.canRequestChanges, copy = eligibilityCopy(e.reason);
  const press = (result: DecisionCmd['result']) => { const c = decisionCommand(result, draft); if (c.ok) onSubmit(c.cmd); else onInvalid(c.error); };
  return <section className="review-form" aria-label="Quyết định">
    {copy && <p className="review-notice">{copy}</p>}
    {can && <>
      <label className="doc-field">Ghi chú phạm vi (5–1000 ký tự)<textarea className="review-textarea" name="scopeNote" value={draft.scopeNote} onChange={ev => onDraft({ scopeNote: ev.target.value })} /></label>
      <label className="doc-field">Ngoại lệ (mỗi dòng một mục, tối đa 10)<textarea className="review-textarea" name="exceptions" value={draft.exceptions} onChange={ev => onDraft({ exceptions: ev.target.value })} /></label></>}
    {error && <p role="alert" className="review-problem review-text">{error}</p>}
    {e.canApprove && <button type="button" className="doc-action review-action" disabled={busy} onClick={() => press('approved')}>Chấp thuận</button>}
    {e.canRequestChanges && <button type="button" className="doc-action review-action review-secondary" disabled={busy} onClick={() => press('changes_requested')}>Yêu cầu sửa</button>}
  </section>;
}

export function ReviewDecisionForm({ item, busy, error, onSubmit }: { item: ReviewItem; busy: boolean; error: string; onSubmit: (cmd: DecisionCmd) => void }) {
  const [draft, setDraft] = useState<DecisionDraft>({ scopeNote: '', exceptions: '' }), [local, setLocal] = useState('');
  return <DecisionFormView item={item} draft={draft} busy={busy} error={error || local} onDraft={p => { setLocal(''); setDraft(d => ({ ...d, ...p })); }} onSubmit={onSubmit} onInvalid={setLocal} />;
}

export type CommentFormProps = { item: ReviewItem; draft: CommentDraft; busy: boolean; error: string; onDraft: (p: Partial<CommentDraft>) => void; onSubmit: (c: CommentDraft) => void; onInvalid: (m: string) => void };
export function CommentFormView({ item, draft, busy, error, onDraft, onSubmit, onInvalid }: CommentFormProps) {
  if (!item.eligibility.canComment) return null;
  return <section className="review-form" aria-label="Nhận xét mới">
    <label className="doc-field">Mục nhận xét<select name="anchor" value={draft.anchor} onChange={e => onDraft({ anchor: e.target.value })}>
      <option value="">Cả bản</option>{ANCHORS.map(a => <option key={a} value={a}>{fieldLabel(a)}</option>)}</select></label>
    <label className="doc-field">Nhận xét (1–2000 ký tự)<textarea className="review-textarea" name="body" value={draft.body} onChange={e => onDraft({ body: e.target.value })} /></label>
    {error && <p role="alert" className="review-problem review-text">{error}</p>}
    <button type="button" className="doc-action review-action" disabled={busy} onClick={() => { const c = commentCommand(draft); if (c.ok) onSubmit(c.cmd); else onInvalid(c.error); }}>Gửi nhận xét</button>
  </section>;
}

// ---------- screens ----------
export function ReviewDetailDenied() {
  return <main className="doc-page"><a className="doc-action review-action doc-back" href="/review">← Về danh sách review</a>
    <div className="doc-state doc-denied" role="status"><h2>{NOT_FOUND_COPY}</h2><p>Trang này không hiện dữ liệu ngoài phạm vi được cấp.</p></div></main>;
}
export function ReviewDetailNoRevision() {
  return <main className="doc-page"><a className="doc-action review-action doc-back" href="/review">← Về danh sách review</a>
    <div className="doc-state doc-empty" role="status"><h2>{NO_REVISION_COPY}</h2></div></main>;
}
export function ReviewDetailNotice({ state, onRetry }: { state: 'loading' | 'error'; onRetry?: () => void }) {
  return <main className="doc-page"><h1>Review tài liệu</h1>
    {state === 'loading' ? <Skeleton label="Đang tải review" /> : <div className="doc-state doc-error" role="alert"><h2>Không tải được tài liệu để review. Dữ liệu đã lưu không bị thay đổi.</h2>
      <button type="button" className="doc-action review-action" onClick={onRetry}>Thử lại</button></div>}</main>;
}

export function ReviewDetailScreen({ detail: initial, affectedLinks, people }: { detail: ReviewDetail; affectedLinks: DependencyView[]; people: Person[] }) {
  const [detail, setDetail] = useState(initial), [changedOnly, setChangedOnly] = useState(true), [stale, setStale] = useState(false),
    [busy, setBusy] = useState(false), [error, setError] = useState(''), [reloadable, setReloadable] = useState(false), [notice, setNotice] = useState(''), [decisionError, setDecisionError] = useState(''),
    [commentError, setCommentError] = useState(''), [commentDraft, setCommentDraft] = useState<CommentDraft>({ body: '', anchor: '' }), [commentLocal, setCommentLocal] = useState('');
  const keys = useRef<KeyStore>({ current: null });
  const { item } = detail, path = '/api/reviews/' + item.documentId;
  async function reload() {
    setBusy(true); setError(''); setReloadable(false);
    try { setDetail(await api<ReviewDetail>(path)); setStale(false); } catch (e) { const d = describeError(e); setError(d.text); setReloadable(d.reloadable); } finally { setBusy(false); }
  }
  /** One command: a fresh key per action (the same one on a retry of the same body). Returns false on failure; drafts are never cleared on failure. What each outcome means is decided in review-view.ts. */
  async function send(suffix: string, body: unknown, done: string, form: ReviewForm): Promise<boolean> {
    setBusy(true); setError(''); setReloadable(false); setNotice(''); setDecisionError(''); setCommentError('');
    try {
      setDetail(await postReview<ReviewDetail>(path + suffix, body, idempotencyKey(keys.current, body)));
      const ok = commandSuccess(form);
      if (ok.resetKey) keys.current.current = null;
      setStale(ok.stale); setNotice(done);
      if (ok.clearDraft === 'comment') setCommentDraft({ body: '', anchor: '' });
      return true;
    } catch (e) {
      const f = commandFailure(e, form);
      if (f.stale) setStale(true);                                // the banner says it; the typed draft stays
      else if (f.target === 'reply') throw e;                     // the reply box under the comment shows its own error
      else if (f.target === 'decision') setDecisionError(f.message);
      else setCommentError(f.message);
      return false;
    } finally { setBusy(false); }
  }
  const nameFor = (id: string) => nameOf(people, id);
  return <main className="doc-page">
    <a className="doc-action review-action doc-back" href={'/review?projectId=' + item.projectId}>← Về danh sách review</a>
    <header className="review-head"><h1 className="review-title" dir="auto">{item.refCode} · {item.title}</h1>
      <p className="review-meta">{docTypeLabel(item.docType)} · bản r{item.revision.revisionNo} · {decisionStateLabel(item.decision)} · {approverCopy(item.approverState)}</p></header>
    <p className="review-notice" role="status">{notice}</p>
    {error && <div role="alert" className="review-problem"><p className="review-text">{error}</p>{reloadable && <button type="button" className="doc-action review-action review-secondary" onClick={() => void reload()}>Tải lại</button>}</div>}
    <RevisionDiff base={detail.base} candidate={item.revision} diff={detail.diff} affectedLinks={affectedLinks} comments={detail.comments} sourceChanged={stale} changedOnly={changedOnly}
      onReload={() => void reload()} onMode={setChangedOnly} documentId={item.documentId} commentsTruncated={detail.commentsTruncated} people={people}
      onReply={cmd => send('/comments', cmd, 'Đã ghi trả lời.', 'reply')} />
    {item.decision && <section className="review-section" aria-label="Quyết định đã ghi"><h2>{decisionStateLabel(item.decision)}</h2>
      <p className="review-meta">{nameFor(item.decision.decidedBy)} · {formatTime(item.decision.decidedAt)} · bản r{item.decision.revisionNo}</p>
      <p className="review-text" dir="auto">{item.decision.scopeNote}</p>
      {item.decision.exceptions.length > 0 && <><h3>Ngoại lệ</h3><List items={item.decision.exceptions} /></>}</section>}
    <CommentFormView item={item} draft={commentDraft} busy={busy} error={commentLocal || commentError} onDraft={p => { setCommentLocal(''); setCommentError(''); setCommentDraft(d => ({ ...d, ...p })); }}
      onSubmit={c => { void send('/comments', commentBody(item, c), 'Đã ghi nhận xét.', 'comment'); }} onInvalid={setCommentLocal} />
    <ReviewDecisionForm item={item} busy={busy} error={decisionError} onSubmit={c => { void send('/decisions', decisionBody(item, c), 'Đã ghi quyết định.', 'decision'); }} />
  </main>;
}

export type QueueProps = { projects: { id: string; name: string }[]; projectId: string | null; initial: { items: ReviewItem[]; total: number } | null; denied: boolean;
  delegations: { reviewers: ListedDelegation[]; reviewersTruncated?: boolean; approvers: ApproverView[]; canDesignate: boolean } | null; people: { id: string; name: string; role: string }[]; viewerId: string; offset?: number };

export function ReviewQueue({ projects, projectId, initial, denied, delegations: initialDelegations, people, viewerId, offset = 0 }: QueueProps) {
  const [page, setPage] = useState(initial), [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(null),
    [delegations, setDelegations] = useState(initialDelegations), [busy, setBusy] = useState(false), [panelError, setPanelError] = useState(''), [reloadable, setReloadable] = useState(false), [notice, setNotice] = useState('');
  const keys = useRef<KeyStore>({ current: null });
  const shell = (children: ReactNode) => <main className="doc-page"><a className="doc-action review-action doc-back" href="/">← Về không gian làm việc</a><h1>Review tài liệu</h1>{children}</main>;
  if (denied) return shell(<ReviewQueueBody state="denied" items={[]} total={0} error={null} projectLabel="" />);
  if (!projectId) return shell(<nav className="doc-picker" aria-label="Chọn dự án"><p className="doc-meta">Chọn dự án để xem phần review.</p>
    {projects.length === 0 ? <p>Chưa có dự án nào anh/chị được xem phần review.</p> : projects.map(p => <a key={p.id} className="doc-action review-action" href={'/review?projectId=' + p.id}>{p.name}</a>)}</nav>);
  const projectLabel = projects.find(p => p.id === projectId)?.name ?? 'Dự án trong phạm vi';
  const state = reviewPageState({ loading, error, denied: false, rows: page?.items.length ?? 0 });
  async function reloadQueue() {
    setLoading(true); setError(null);
    try { setPage(await api<{ items: ReviewItem[]; total: number }>('/api/reviews?projectId=' + projectId + '&limit=' + QUEUE_PAGE_SIZE + '&offset=' + offset)); } catch { setError(ERROR_COPY); } finally { setLoading(false); }
  }
  async function reloadDelegations() { setDelegations(await api('/api/reviews/delegations?projectId=' + projectId)); }
  async function reloadAll() { setPanelError(''); setReloadable(false); await reloadQueue(); try { await reloadDelegations(); } catch (e) { setPanelError(describeError(e).text); } }
  async function command(path: string, body: unknown, done: string): Promise<boolean> {
    setBusy(true); setPanelError(''); setReloadable(false); setNotice('');
    try { await postReview(path, body, idempotencyKey(keys.current, body)); } catch (e) {
      const f = panelFailure(e); setPanelError(f.message); setReloadable(f.reloadable); setBusy(false); return false;
    }
    const ok = panelSuccess();
    if (ok.resetKey) keys.current.current = null;
    try { if (ok.reload) await reloadDelegations(); setNotice(done); } catch (e) { const f = panelReloadFailure(e); setPanelError(f.message); setReloadable(f.reloadable); }
    setBusy(false); return true;
  }
  return shell(<>
    <p className="review-meta">{projectLabel}</p>
    <ReviewQueueBody state={state} items={page?.items ?? []} total={page?.total ?? 0} error={error} projectLabel={projectLabel} onRetry={() => void reloadQueue()} projectId={projectId} offset={offset} />
    {delegations && <ReviewersPanel reviewers={delegations.reviewers} approvers={delegations.approvers} people={people} viewerId={viewerId} canDesignate={delegations.canDesignate} truncated={delegations.reviewersTruncated}
      busy={busy} error={panelError} notice={notice} reloadable={reloadable} onReload={() => void reloadAll()}
      onGrant={cmd => command('/api/reviews/delegations', grantBody(projectId, cmd), 'Đã chỉ định người nhận xét.')}
      onRevoke={cmd => command('/api/reviews/delegations/' + cmd.delegationId + '/revoke', revokeBody(cmd), REVOKED_NOTICE)} />}
  </>);
}
