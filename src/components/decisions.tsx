'use client';
import { useRef, useState, type ReactNode } from 'react';
import type { DecisionCard, ReassignmentCard, ReviewCard } from '../server/decisions';
import { api } from './api';
import { formatTime } from './inbox-view';
import { eligibilityCopy, idempotencyKey, postReview, sameId, TRUNCATED_COPY } from './review-view';
import { decisionsPageState, reassignmentLabel, reviewLabels, voteBlockCopy, voteBody, voteCommand, voteFailure, voteRecorded, choiceLabel,
  EMPTY_COPY, DENIED_COPY, ERROR_COPY, ACCOUNTS_COPY, UNKNOWN_PERSON, VOTE_CHOICES, type DecisionsPageState } from './decisions-view';

// Decisions screen. Text from the database (titles, summaries, names) is rendered as React text only; links go only to /review/<documentId> and /approvals.
// The screen computes no permission: vote buttons come from `actorEligibility.canVote` and every denial comes back from the service. Labels come from the card's fields,
// with one deliberate belt on state: a stored `applied` card with no receipt is drawn as `reconcile`, as the service already does (decisions.ts), never as applied.
type Person = { id: string; name: string };
type KeyStore = { current: { fingerprint: string; key: string } | null };
const nameOf = (people: Person[], id: string) => people.find(p => sameId(p.id, id))?.name ?? UNKNOWN_PERSON;
const Skeleton = ({ label }: { label: string }) => <div className="doc-list doc-skeleton" aria-busy="true" aria-label={label}>{[0, 1, 2].map(i => <div key={i} className="doc-skel-row" aria-hidden="true" />)}</div>;

export type CardProps = { card: DecisionCard; people: Person[]; busy: boolean; error: string; onVote?: (choice: string) => void;
  note?: string; onNote?: (v: string) => void; reloadable?: boolean; onReload?: () => void };

function ReviewBody({ card, people }: { card: ReviewCard; people: Person[] }) {
  const labels = reviewLabels(card);
  const copy = eligibilityCopy(card.actorEligibility.reason);
  return <>
    <h3 className="decision-title" dir="auto">{card.refCode} · {card.title}</h3>
    <p className="decision-meta">Tài liệu · bản r{card.revision.no}</p>
    {card.summary && <p className="decision-text" dir="auto">{card.summary}</p>}
    <p className="decision-line" data-line="vote">{labels.vote}</p>
    <p className="decision-line" data-line="baseline">{labels.baseline}</p>
    {card.votes.length > 0 && <ul className="decision-votes">{card.votes.map((v, i) => <li key={i} className="decision-vote">{nameOf(people, v.actorId)} · {choiceLabel(v.choice)} · {formatTime(v.at)}</li>)}</ul>}
    {card.appliedReceipt && <p className="decision-meta">Biên nhận lúc {formatTime(card.appliedReceipt.at)}</p>}
    {copy && <p className="decision-notice" data-block="eligibility">{copy}</p>}
    <a className="doc-action decision-action" href={'/review/' + card.documentId}>Mở để review</a>
  </>;
}

function ReassignmentBody({ card, people, busy, error, onVote, note = '', onNote, reloadable, onReload }: CardProps & { card: ReassignmentCard }) {
  // «đủ phiếu» and «đã áp dụng» are two facts. A stored `applied` with no receipt can never be shown as applied: it reads like the service's own fail-closed state.
  const shown = card.state === 'applied' && card.appliedReceipt === null ? 'reconcile' : card.state;
  const block = voteBlockCopy(card.actorEligibility.reason);
  return <>
    <h3 className="decision-title" dir="auto">{card.workCode} · {card.title}</h3>
    <p className="decision-meta">Phiếu chia lại việc 3/3 · dựa trên phiên bản việc {card.revision.workVersion} · hết hạn {formatTime(card.expiresAt)}</p>
    {card.summary && <p className="decision-text" dir="auto">{card.summary}</p>}
    <p className="decision-line" data-line="quorum">{reassignmentLabel(shown, card.quorum.have)}</p>
    <p className="decision-line" data-line="applied">{card.appliedReceipt ? 'Đã áp dụng · biên nhận lúc ' + formatTime(card.appliedReceipt.at) + ' · phiên bản việc ' + card.appliedReceipt.workVersion : 'Chưa áp dụng'}</p>
    {card.votes.length > 0 && <ul className="decision-votes">{card.votes.map((v, i) => <li key={i} className="decision-vote">{nameOf(people, v.actorId)} · {choiceLabel(v.choice)} · {formatTime(v.at)}</li>)}</ul>}
    {!card.actorEligibility.canVote && block && <p className="decision-notice" data-block="vote">{block}</p>}
    {error && <div className="decision-problem" role="alert"><p className="decision-text">{error}</p>
      {reloadable && <button type="button" className="doc-action decision-action decision-secondary" onClick={onReload}>Tải lại</button>}</div>}
    {card.actorEligibility.canVote && <div className="decision-form" role="group" aria-label="Bỏ phiếu">
      <label className="doc-field">Ghi chú (5–2000 ký tự, bắt buộc)<textarea className="decision-textarea" name="note" value={note} onChange={e => onNote?.(e.target.value)} /></label>
      <div className="decision-actions">{VOTE_CHOICES.map(([value, label]) =>
        <button key={value} type="button" className={'doc-action decision-action' + (value === 'agree' ? '' : ' decision-secondary')} disabled={busy} onClick={() => onVote?.(value)}>{label}</button>)}</div>
    </div>}
  </>;
}

/** One card, without state of its own: the buttons are exactly the ones `actorEligibility.canVote` allows. */
export function DecisionCardView(props: CardProps) {
  const { card } = props;
  return <article className="decision-card" role="listitem" data-kind={card.kind}>
    {card.kind === 'document_review' ? <ReviewBody card={card} people={props.people} /> : <ReassignmentBody {...props} card={card} />}
  </article>;
}

// ---------- list ----------
export type BodyProps = { state: DecisionsPageState; cards: DecisionCard[]; error: string | null; people: Person[]; truncated?: boolean; onRetry?: () => void; renderCard?: (c: DecisionCard) => ReactNode };

export function DecisionsBody({ state, cards, error, people, truncated, onRetry, renderCard }: BodyProps) {
  if (state === 'loading') return <Skeleton label="Đang tải danh sách quyết định" />;
  if (state === 'denied') return <div className="doc-state doc-denied" role="status"><h2>{DENIED_COPY}</h2><p>Trang này không hiện dữ liệu của dự án.</p></div>;
  if (state === 'error') return <div className="doc-state doc-error" role="alert"><h2>{ERROR_COPY}</h2>{error && error !== ERROR_COPY && <p className="decision-text">{error}</p>}
    <button type="button" className="doc-action decision-action" onClick={onRetry}>Thử lại</button></div>;
  const pointer = <p className="decision-accounts decision-text">{ACCOUNTS_COPY} <a className="doc-action decision-action decision-secondary" href="/approvals">Mở trang Duyệt tài khoản</a></p>;
  if (state === 'empty') return <><div className="doc-state doc-empty"><h2>{EMPTY_COPY}</h2></div>{pointer}</>;
  return <>
    <div className="decision-list" role="list" aria-label="Thẻ quyết định của dự án">
      {cards.map(c => renderCard ? renderCard(c) : <DecisionCardView key={c.kind + ':' + c.decisionId} card={c} people={people} busy={false} error="" />)}
    </div>
    <p className="doc-meta" role="status">{cards.length} thẻ</p>
    {truncated && <p className="decision-meta">{TRUNCATED_COPY}</p>}
    {pointer}
  </>;
}

// ---------- stateful screen ----------
type VoteItemProps = { card: ReassignmentCard; people: Person[]; onDone: () => Promise<void> };
/** Holds the typed note and the send state of one 3/3 card. The note survives every error; it is cleared only when the vote was recorded. */
function VoteItem({ card, people, onDone }: VoteItemProps) {
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [reloadable, setReloadable] = useState(false);
  const keys = useRef<KeyStore>({ current: null });
  async function vote(choice: string) {
    const c = voteCommand(choice, note);
    if (!c.ok) { setError(c.error); setReloadable(false); return; }
    setBusy(true); setError(''); setReloadable(false);
    const body = voteBody(card.decisionId, c.cmd);
    try {
      await postReview('/api/team/bom', body, idempotencyKey(keys.current, body));
      const ok = voteRecorded();
      if (ok.resetKey) keys.current.current = null;
      if (ok.clearNote) setNote('');
      if (ok.reload) await onDone();
    }
    catch (e) { const f = voteFailure(e); setError(f.message); setReloadable(f.reloadable); }
    finally { setBusy(false); }
  }
  return <DecisionCardView card={card} people={people} busy={busy} error={error} note={note} onNote={v => { setError(''); setNote(v); }} onVote={choice => void vote(choice)}
    reloadable={reloadable} onReload={() => void onDone()} />;
}

export type DecisionsProps = { projects: { id: string; name: string }[]; projectId: string | null; initial: { cards: DecisionCard[]; reviewCardsTruncated?: boolean } | null; denied: boolean; people: Person[] };

export function Decisions({ projects, projectId, initial, denied, people }: DecisionsProps) {
  const [page, setPage] = useState(initial), [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(null), [stale, setStale] = useState('');
  const shell = (children: ReactNode) => <main className="doc-page"><a className="doc-action decision-action doc-back" href="/">← Về không gian làm việc</a><h1>Quyết định</h1>{children}</main>;
  if (denied) return shell(<DecisionsBody state="denied" cards={[]} error={null} people={[]} />);
  if (!projectId) return shell(<nav className="doc-picker" aria-label="Chọn dự án"><p className="doc-meta">Chọn dự án để xem các quyết định.</p>
    {projects.length === 0 ? <p>Chưa có dự án nào anh/chị được xem các quyết định.</p> : projects.map(p => <a key={p.id} className="doc-action decision-action" href={'/decisions?projectId=' + p.id}>{p.name}</a>)}</nav>);
  const projectLabel = projects.find(p => p.id === projectId)?.name ?? 'Dự án trong phạm vi';
  const state = decisionsPageState({ loading, error, denied: false, rows: page?.cards.length ?? 0 });
  async function reload() {
    setLoading(true); setError(null); setStale('');
    try { setPage(await api<{ cards: DecisionCard[]; reviewCardsTruncated?: boolean }>('/api/decisions?projectId=' + projectId)); } catch { setError(ERROR_COPY); } finally { setLoading(false); }
  }
  /** Refresh after a vote or from a card's own «Tải lại»: the cards stay mounted (a typed note is not lost) and a failed refresh is a sentence, not an empty screen. */
  async function refresh() {
    setStale('');
    try { setPage(await api<{ cards: DecisionCard[]; reviewCardsTruncated?: boolean }>('/api/decisions?projectId=' + projectId)); } catch { setStale(ERROR_COPY); }
  }
  return shell(<>
    <p className="decision-meta">{projectLabel}</p>
    {stale && <p className="decision-problem" role="alert">{stale}</p>}
    <DecisionsBody state={state} cards={page?.cards ?? []} error={error} people={people} truncated={page?.reviewCardsTruncated} onRetry={() => void reload()}
      renderCard={c => c.kind === 'reassignment' ? <VoteItem key={'r:' + c.decisionId} card={c} people={people} onDone={refresh} />
        : <DecisionCardView key={'d:' + c.decisionId} card={c} people={people} busy={false} error="" />} />
  </>);
}
