'use client';
import { useState, type ReactNode } from 'react';
import type { CandidateCard, SourceAvailabilityRow, FailureRow, RevisionView, EventView, DeliveryView } from '../server/inbox';
import { api } from './api';
import { inboxState, statusLabel, failureLabel, variantOf, primaryAction, commandErrorMessage, formatTime, sizeLabel, chatTail,
  VARIANT_NAMES, STATE_NAMES, CONFLICT_COPY, NOT_MANAGER_COPY, POINTER_ONLY_COPY, type InboxPageState } from './inbox-view';

type Page = { items: CandidateCard[]; total: number };
type Detail = { card: CandidateCard; revisions: RevisionView[]; events: EventView[]; deliveries: DeliveryView[] };

/** A hash the gateway declared. Nothing here compares it with the original message, so it is never shown as checked. */
export function GatewayHash({ hash }: { hash: string | null }) {
  if (!hash) return <span className="doc-meta">Không có hash để hiển thị</span>;
  return <span className="doc-wrap inbox-hash">SHA-256 {hash} <em>· do gateway khai, chưa kiểm</em></span>;
}

export function SourceList({ sources }: { sources: SourceAvailabilityRow[] }) {
  return <section className="inbox-section" aria-label="Nguồn tin"><h2>Nguồn tin</h2>
    {sources.length === 0 ? <p className="doc-meta">Chưa có nhóm Telegram nào được đề xuất cho dự án này.</p> : <ul className="inbox-plain">
      {sources.map(s => <li key={s.chatId + ':' + s.topicId} className="inbox-source">
        <strong>Nhóm {chatTail(s.chatId)}{s.topicId ? ' · chủ đề ' + s.topicId : ''}</strong>
        <span className="doc-wrap">{s.label}</span>
        {s.coverageGaps.length > 0 && <small className="doc-meta">Có {s.coverageGaps.length} khoảng ghi chậm (tin vào spool rồi mới ghi): {s.coverageGaps.slice(0, 3).map(g => formatTime(g.from) + ' → ' + formatTime(g.to)).join('; ')}</small>}
      </li>)}</ul>}
  </section>;
}

export function FailureList({ failures }: { failures: FailureRow[] }) {
  return <section className="inbox-section" aria-label="Tin gửi cần xử lý"><h2>Tin gửi cần xử lý{failures.length ? ' · ' + failures.length : ''}</h2>
    {failures.length === 0 ? <p className="doc-meta">Không có tin gửi nào cần xử lý.</p> : <ul className="inbox-plain">
      {failures.map(f => <li key={f.outboxId} className="inbox-source">
        <strong>{failureLabel(f)}</strong>
        <span className="doc-wrap">Loại tin: {f.template}{f.lastErrorCode ? ' · mã lỗi: ' + f.lastErrorCode : ''}</span>
        <small className="doc-meta">{f.ownerId ? 'Đã có người nhận xử lý' : 'Chưa có người nhận xử lý'}</small>
      </li>)}</ul>}
  </section>;
}

function DetailView({ detail }: { detail: Detail }) {
  const showText = detail.card.contentMode !== 'pointer_only';
  return <div className="inbox-detail">
    <h4>Các bản của tin</h4>
    {detail.revisions.length === 0 ? <p className="doc-meta">Chưa có bản nào.</p> : <ul className="inbox-plain">{detail.revisions.map(r => <li key={r.revisionNo}>
      <span>r{r.revisionNo} · ghi lúc {formatTime(r.recordedAt)}{r.editedAt ? ' · sửa lúc ' + formatTime(r.editedAt) : ''}{r.textTruncated ? ' · chữ bị cắt' : ''}</span><br />
      <GatewayHash hash={r.contentHash} />
      {showText && r.excerpt && <p className="doc-wrap">{r.excerpt}</p>}</li>)}</ul>}
    <h4>Lịch sử thao tác</h4>
    {detail.events.length === 0 ? <p className="doc-meta">Chưa có thao tác.</p> : <ul className="inbox-plain">{detail.events.map(e => <li key={e.id} className="doc-wrap">
      {e.kind} · {formatTime(e.createdAt)}{typeof e.payload.note === 'string' && e.payload.note ? ' · Ảnh hưởng / khôi phục: ' + e.payload.note : ''}</li>)}</ul>}
    {detail.deliveries.length > 0 && <><h4>Biên nhận gửi</h4><ul className="inbox-plain">{detail.deliveries.map(d => <li key={d.outboxId}>
      {d.template} · {statusLabel({ receivedAt: '', persistedAt: '', projectedAt: null, deliveredAt: d.deliveredAt, acknowledgedAt: d.acknowledgedAt, outboxState: d.state })} · lượt {d.attemptNo}</li>)}</ul></>}
  </div>;
}

function CardDetail({ candidateId }: { candidateId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  async function load() {
    if (detail || loading) return;
    setLoading(true); setError('');
    try { setDetail(await api<Detail>('/api/inbox/' + candidateId)); } catch (e) { setError(commandErrorMessage(e)); } finally { setLoading(false); }
  }
  return <details className="inbox-more" onToggle={e => { if ((e.currentTarget as HTMLDetailsElement).open) void load(); }}>
    <summary className="inbox-summary">Xem chi tiết</summary>
    {loading && <p className="doc-meta" aria-busy="true">Đang tải chi tiết…</p>}
    {error && <p role="alert" className="doc-problem">{error}</p>}
    {detail && <DetailView detail={detail} />}
  </details>;
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => <div className="inbox-variant"><h4>{title}</h4>{children}</div>;

export function IntakeCard({ card, canAct, onCommand }: { card: CandidateCard; canAct: boolean; onCommand: (cmd: unknown) => Promise<void> }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [note, setNote] = useState(''), [missing, setMissing] = useState(''), [reason, setReason] = useState(''), [dupOf, setDupOf] = useState('');
  const variant = variantOf(card), open = card.state === 'new' || card.state === 'needs_info', primary = primaryAction(card, canAct);
  async function run(cmd: Record<string, unknown>) {
    setBusy(true); setError('');
    try { await onCommand({ expectedVersion: card.version, ...cmd }); } catch (e) { setError(commandErrorMessage(e)); } finally { setBusy(false); }
  }
  const needReason = (cmd: Record<string, unknown>) => { if (!reason.trim()) { setError('Nhập căn cứ trước khi thực hiện thao tác này.'); return; } void run({ ...cmd, reason: reason.trim() }); };
  const lines = missing.split('\n').map(l => l.trim()).filter(Boolean);
  const onPrimary = () => {
    if (primary === 'Bổ sung thông tin') { if (!lines.length) { setError('Nhập ít nhất một thông tin còn thiếu, mỗi dòng một mục.'); return; } void run({ kind: 'need_info', missingFields: lines }); }
    else if (card.classification) void run({ kind: 'confirm', classification: card.classification, ...(card.classification === 'incident' && note.trim() ? { note: note.trim() } : {}) });
  };
  return <article className="inbox-card" aria-label={'Tin ' + card.ref} data-variant={variant} data-state={card.state}>
    <header className="inbox-head">
      <h3 className="doc-title">{card.ref}</h3>
      <p className="inbox-badges"><span className="inbox-badge">{VARIANT_NAMES[variant]}</span><span className="inbox-badge">{STATE_NAMES[card.state]}</span>
        {card.forwarded && <span className="inbox-badge">Tin chuyển tiếp</span>}</p>
    </header>
    <p className="doc-meta doc-wrap">Tin gốc: {card.sourceRef}{card.ticketRef ? ' · Mã việc ngoài: ' + card.ticketRef : ''}</p>
    {card.contentMode === 'pointer_only'
      ? <p className="inbox-pointer doc-wrap">{POINTER_ONLY_COPY}<br /><span className="doc-ref">{card.sourceRef}</span></p>
      : <p className="inbox-text doc-wrap">{card.excerpt ?? 'Tin không có chữ (chỉ có tệp).'}</p>}
    {card.attachments.length > 0 && <ul className="inbox-plain" aria-label="Tệp đính kèm">{card.attachments.map((a, i) => <li key={i} className="doc-wrap">
      {a.fileName || 'Tệp không tên'} · {a.mimeType} · {sizeLabel(a.sizeBytes)} · {a.state === 'stored' ? 'Đã ghi con trỏ' : a.state === 'too_large' ? 'Quá lớn, chỉ ghi thông tin' : a.state === 'unsupported_type' ? 'Loại tệp không nhận, chỉ ghi thông tin' : a.state}</li>)}</ul>}
    <dl className="inbox-life">
      <div><dt>Nhận lúc</dt><dd>{formatTime(card.status.receivedAt)}</dd></div>
      <div><dt>Ghi lúc</dt><dd>{formatTime(card.status.persistedAt)}</dd></div>
      <div><dt>Chiếu</dt><dd>Chưa chiếu</dd></div>
      <div><dt>Gửi</dt><dd>{statusLabel(card.status)}</dd></div>
    </dl>
    {card.duplicateCandidates.length > 0 && <Section title="Có thể trùng">
      <ul className="inbox-plain">{card.duplicateCandidates.map(d => <li key={d.candidateId} className="doc-wrap"><span className="doc-ref">{d.ref}</span> — {d.reason}</li>)}</ul></Section>}
    {variant === 'incident' && <Section title="Ảnh hưởng / khôi phục">
      {canAct && open ? <label className="doc-field">Ghi ảnh hưởng và cách khôi phục (tuỳ chọn)<textarea className="inbox-textarea" value={note} maxLength={1000} onChange={e => setNote(e.target.value)} /></label>
        : <p className="doc-meta">Ghi chú ảnh hưởng và khôi phục xem ở «Xem chi tiết» → Lịch sử thao tác.</p>}</Section>}
    {variant === 'request' && <Section title="Cần làm rõ">
      {card.missingFields.length > 0 ? <ul className="inbox-plain">{card.missingFields.map(f => <li key={f} className="doc-wrap">{f}</li>)}</ul> : <p className="doc-meta">Chưa ghi thông tin nào còn thiếu.</p>}
      {canAct && card.state === 'new' && <label className="doc-field">Thông tin còn thiếu (mỗi dòng một mục)<textarea className="inbox-textarea" value={missing} onChange={e => setMissing(e.target.value)} /></label>}</Section>}
    {variant === 'document' && <Section title="Đăng ký nguồn">
      <a className="doc-action inbox-secondary" href={'/documents?projectId=' + card.projectId}>Mở Tài liệu dự án để đăng ký nguồn</a></Section>}
    {error && <p role="alert" className="doc-problem">{error}</p>}
    {canAct ? <div className="inbox-actions">
      {variant === 'unclassified' && open && <div className="inbox-choices" role="group" aria-label="Chọn loại tin">
        <p className="doc-meta">Chọn tin này thuộc loại nào. Hệ thống không tự phân loại.</p>
        {(['incident', 'request', 'document'] as const).map(c => <button key={c} type="button" className="doc-action" disabled={busy} onClick={() => void run({ kind: 'confirm', classification: c })}>{VARIANT_NAMES[c]}</button>)}</div>}
      {primary && <button type="button" className="doc-action" disabled={busy} onClick={onPrimary}>{primary}</button>}
      {open && variant === 'request' && card.state === 'new' && <button type="button" className="doc-action inbox-secondary" disabled={busy} onClick={() => void run({ kind: 'confirm', classification: 'request' })}>Xác nhận đủ thông tin</button>}
      <label className="doc-field">Căn cứ (cần cho bỏ qua, trùng, mở lại)<input value={reason} maxLength={500} onChange={e => setReason(e.target.value)} /></label>
      {open && card.duplicateCandidates.length > 0 && <>
        <label className="doc-field">Trùng với<select value={dupOf} onChange={e => setDupOf(e.target.value)}><option value="">Chọn tin</option>
          {card.duplicateCandidates.map(d => <option key={d.candidateId} value={d.candidateId}>{d.ref}</option>)}</select></label>
        <button type="button" className="doc-action inbox-secondary" disabled={busy} onClick={() => dupOf ? needReason({ kind: 'mark_duplicate', duplicateOf: dupOf }) : setError('Chọn tin bị trùng trước.')}>Đánh dấu trùng</button></>}
      {open && <button type="button" className="doc-action inbox-secondary" disabled={busy} onClick={() => needReason({ kind: 'dismiss' })}>Bỏ qua tin này</button>}
      {!open && <button type="button" className="doc-action inbox-secondary" disabled={busy} onClick={() => needReason({ kind: 'reopen' })}>Mở lại</button>}
    </div> : <p className="doc-meta inbox-readonly">{NOT_MANAGER_COPY}</p>}
    <CardDetail candidateId={card.candidateId} />
  </article>;
}

export function InboxBody({ state, items, total, error, projectLabel, canAct, onRetry, onCommand }:
  { state: InboxPageState; items: CandidateCard[]; total: number; error: string | null; projectLabel: string; canAct: boolean; onRetry?: () => void; onCommand: (c: CandidateCard, cmd: unknown) => Promise<void> }) {
  if (state === 'loading') return <div className="doc-list doc-skeleton" aria-busy="true" aria-label="Đang tải Inbox">{[0, 1, 2].map(i => <div key={i} className="doc-skel-row" aria-hidden="true" />)}</div>;
  if (state === 'denied') return <div className="doc-state doc-denied" role="status"><h2>Anh/chị chưa có quyền xem Inbox của dự án này</h2>
    <p>Liên hệ người quản lý để được cấp quyền. Trang này không hiện dữ liệu của dự án.</p></div>;
  if (state === 'error') return <div className="doc-state doc-error" role="alert"><h2>Chưa tải được Inbox</h2>
    <p>{error ?? 'Không xử lý được yêu cầu.'}</p><button type="button" className="doc-action" onClick={onRetry}>Thử lại</button></div>;
  if (state === 'empty') return <div className="doc-state doc-empty"><h2>Chưa có tin nào được tiếp nhận cho dự án này</h2>
    <p>Tin chỉ vào Inbox khi gateway nhận được từ nhóm đã được cấu hình. Xem mục «Nguồn tin» ở trên để biết nhóm nào đã nhận.</p></div>;
  return <div className="doc-list" role="list" aria-label={'Tin của ' + projectLabel}>
    {items.map(c => <div role="listitem" key={c.candidateId + ':' + c.version}><IntakeCard card={c} canAct={canAct} onCommand={cmd => onCommand(c, cmd)} /></div>)}
    <p className="doc-meta" role="status">{items.length} / {total} tin</p></div>;
}

export function Inbox({ projects, projectId, initial, sources, failures, denied, canAct }:
  { projects: { id: string; name: string }[]; projectId: string | null; initial: Page | null; sources: SourceAvailabilityRow[]; failures: FailureRow[]; denied: boolean; canAct: boolean }) {
  const [page, setPage] = useState<Page | null>(initial), [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState(''), [stale, setStale] = useState(false);
  if (denied) return <main className="doc-page"><a className="doc-action doc-back" href="/">← Về không gian làm việc</a><h1>Inbox dự án</h1>
    <InboxBody state="denied" items={[]} total={0} error={null} projectLabel="" canAct={false} onCommand={async () => {}} /></main>;
  if (!projectId) return <main className="doc-page"><a className="doc-action doc-back" href="/">← Về không gian làm việc</a><h1>Inbox dự án</h1>
    <nav className="doc-picker" aria-label="Chọn dự án"><p className="doc-meta">Chọn dự án để xem Inbox.</p>
      {projects.length === 0 ? <p>Chưa có dự án nào anh/chị được xem Inbox.</p> : projects.map(p => <a key={p.id} className="doc-action" href={'/inbox?projectId=' + p.id}>{p.name}</a>)}</nav></main>;
  const projectLabel = projects.find(p => p.id === projectId)?.name ?? 'Dự án trong phạm vi';
  const state = inboxState({ loading, error, denied: false, count: page?.items.length ?? 0 });
  async function load() {
    setLoading(true); setError(null); setStale(false);
    try { setPage(await api<Page>('/api/inbox?' + new URLSearchParams({ projectId: projectId! }).toString())); }
    catch (e) { setError(commandErrorMessage(e)); } finally { setLoading(false); }
  }
  async function command(c: CandidateCard, cmd: unknown) {
    setNotice('');
    try { await api('/api/inbox/' + c.candidateId + '/commands', cmd); }
    catch (e) { if (commandErrorMessage(e) === CONFLICT_COPY) setStale(true); throw e; }
    setNotice('Đã ghi thao tác cho ' + c.ref + '. Chưa tạo, giao hay đóng việc nào.');
    await load();
  }
  return <main className="doc-page">
    <a className="doc-action doc-back" href="/">← Về không gian làm việc</a>
    <header className="doc-head"><h1>{projectLabel} / Inbox</h1>
      <a className="doc-action inbox-secondary" href={'/documents?projectId=' + projectId}>Tài liệu dự án</a></header>
    {notice && <p className="doc-notice" role="status">{notice}</p>}
    {stale && <p className="doc-meta"><button type="button" className="doc-action" onClick={() => void load()}>Tải lại danh sách</button></p>}
    <SourceList sources={sources} />
    <section className="inbox-section" aria-label="Tin đã tiếp nhận"><h2>Tin đã tiếp nhận</h2>
      <InboxBody state={state} items={page?.items ?? []} total={page?.total ?? 0} error={error} projectLabel={projectLabel} canAct={canAct} onRetry={() => void load()} onCommand={command} /></section>
    <FailureList failures={failures} />
  </main>;
}
