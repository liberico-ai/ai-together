'use client';
import { useState, type FormEvent } from 'react';
import type { DocumentIndexRow, SourceState } from '@/server/types';
import type { DocumentIndexPage } from '@/server/document-index';
import { SOURCE_HOST_HINT } from '../server/source-hosts';
import { api } from './api';
import { TYPE_NAMES, SOURCE_STATE_VIEW, approvedLabel, draftLabel, hashLabel, freshnessLabel, pendingProjectionCopy, formatTime, pageState, noResultsCopy, emptyProjectionCopy, registerNotice, safeHttpsHost, type PageState } from './documents-view';


export function SourceAvailability({ state, lastSuccessAt }: { state: SourceState; lastSuccessAt: string | null }) {
  const v = SOURCE_STATE_VIEW[state];
  return <div className={'doc-source doc-source-' + v.tone} data-state={state}>
    <strong>{v.label}</strong>
    <small>{v.nextStep}</small>
    {state !== 'denied' && lastSuccessAt && <small>Kiểm lúc {formatTime(lastSuccessAt)}</small>}
  </div>;
}

export function SourceLink({ uri }: { uri: string }) {
  const host = safeHttpsHost(uri);
  if (!host) return <p role="alert" className="doc-problem">Nguồn không có liên kết https hợp lệ nên không thể mở.</p>;
  return <div className="doc-link" role="status"><span className="doc-meta">Máy chủ: {host}</span>
    <a className="doc-action" href={uri} target="_blank" rel="noreferrer noopener">Mở liên kết tại {host}</a></div>;
}

/** Two-step source open shared by the list card and the detail page: fetch the checked URI, then show host + https link. */
export function SourceOpener({ documentId, sourceState, canOpen }: { documentId: string; sourceState: SourceState; canOpen: boolean }) {
  const [busy, setBusy] = useState(false), [problem, setProblem] = useState(''), [uri, setUri] = useState<string | null>(null);
  async function openSource() {
    setBusy(true); setProblem(''); setUri(null);
    try {
      const s = await api<{ uri: string; host?: string }>('/api/documents/' + documentId + '/source');
      setUri(s.uri);
    } catch (e) { setProblem((e as Error).message); } finally { setBusy(false); }
  }
  const showOpen = canOpen && sourceState !== 'denied' && sourceState !== 'unavailable';
  return <>
    {showOpen && <button type="button" className="doc-action" disabled={busy} onClick={openSource}>Mở nguồn</button>}
    {uri && <SourceLink uri={uri} />}
    {problem && <p role="alert" className="doc-problem">{problem}</p>}
  </>;
}

export function DocumentCard({ row, projectLabel, canOpen }: { row: DocumentIndexRow; projectLabel: string; canOpen: boolean }) {
  return <article className="doc-card" aria-label={row.title}>
    <div className="doc-main">
      <h3 className="doc-title">{row.title}</h3>
      <p className="doc-meta"><span className="doc-ref">{row.ref_code || 'Chưa có mã'}</span> · {TYPE_NAMES[row.doc_type] ?? row.doc_type} · {projectLabel}</p>
      <p className="doc-meta">Chủ nội dung: {row.owner_label.trim() || 'Chưa có'}</p>
      <p className={row.stale ? 'doc-meta doc-stale' : 'doc-meta'} role={row.stale ? 'status' : undefined}>{freshnessLabel(row.projected_at, row.stale)}</p>
    </div>
    <div className="doc-revs">
      <span className="doc-tag-neutral">Bản chuẩn: {approvedLabel(row.approved_revision_no)}</span>
      <span className="doc-rev">Bản đang soạn: {draftLabel(row.latest_revision_no, row.missing_count)}</span>
      <span className="doc-hash">{hashLabel(row.hash_verification)}</span>
    </div>
    <SourceAvailability state={row.source_state} lastSuccessAt={null} />
    <div className="doc-actions">
      <a className="doc-action" href={'/documents/' + row.document_id}>Xem chi tiết</a>
      <SourceOpener documentId={row.document_id} sourceState={row.source_state} canOpen={canOpen} />
    </div>
  </article>;
}

export function DocumentsBody({ state, rows, projectedAt, pendingProjection = 0, canRegister, error, projectLabel, term, onRetry, onRegister, onClearSearch }:
  { state: PageState; term?: string; onClearSearch?: () => void; rows: DocumentIndexRow[]; projectedAt: string | null; pendingProjection?: number; canRegister: boolean; error: string | null; projectLabel: string; onRetry?: () => void; onRegister?: () => void }) {
  if (state === 'loading') return <div className="doc-list doc-skeleton" aria-busy="true" aria-label="Đang tải danh sách tài liệu">
    {[0, 1, 2].map(i => <div key={i} className="doc-skel-row" aria-hidden="true" />)}</div>;
  if (state === 'denied') return <div className="doc-state doc-denied" role="status"><h2>Tài khoản chưa được cấp dự án này</h2>
    <p>Liên hệ người quản lý để được cấp quyền. Trang này không hiện dữ liệu của dự án.</p></div>;
  if (state === 'error') return <div className="doc-state doc-error" role="alert"><h2>Chưa tải được danh sách</h2>
    <p>{error ?? 'Không xử lý được yêu cầu.'}</p><button type="button" className="doc-action" onClick={onRetry}>Thử lại</button></div>;
  if (state === 'no-results') return <div className="doc-state doc-empty"><h2>{noResultsCopy(term ?? '')}</h2>
    <button type="button" className="doc-action" onClick={onClearSearch}>Xoá tìm kiếm</button></div>;
  if (state === 'empty') return <div className="doc-state doc-empty"><h2>Chưa có tài liệu đã đăng ký</h2>
    <p>{emptyProjectionCopy(projectedAt)}</p>
    {pendingProjection > 0 && <p className="doc-notice" role="status">{pendingProjectionCopy(pendingProjection)}</p>}
    {canRegister ? <button type="button" className="doc-action" onClick={onRegister}>Đăng ký tài liệu</button> : <p>Cần quyền thành viên dự án để đăng ký</p>}</div>;
  return <div className="doc-list" role="list">
    {pendingProjection > 0 && <p className="doc-notice" role="status">{pendingProjectionCopy(pendingProjection)}</p>}
    {projectedAt && <p className="doc-meta doc-projected">Chỉ mục cập nhật lúc {formatTime(projectedAt)}</p>}
    {rows.map(r => <div role="listitem" key={r.document_id}><DocumentCard row={r} projectLabel={projectLabel} canOpen /></div>)}</div>;
}

const input = (name: string, label: string, extra: Record<string, unknown> = {}) =>
  <label className="doc-field">{label}<input name={name} required {...extra} /></label>;

export function Documents({ projects, projectId, initial, denied, canRegister, templates }:
  { projects: { id: string; name: string }[]; projectId: string | null; initial: DocumentIndexPage | null; denied: boolean; canRegister: boolean; templates: { code: string; title: string }[] }) {
  const [page, setPage] = useState<DocumentIndexPage | null>(initial), [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(null),
    [q, setQ] = useState(''), [applied, setApplied] = useState(''), [notice, setNotice] = useState(''), [form, setForm] = useState(false), [saving, setSaving] = useState(false), [formError, setFormError] = useState('');
  if (!projectId && !denied) return <main className="doc-page"><a className="doc-action doc-back" href="/">← Về không gian làm việc</a><h1>Tài liệu dự án</h1>
    <nav className="doc-picker" aria-label="Chọn dự án"><p className="doc-meta">Chọn dự án để xem tài liệu.</p>
      {projects.length === 0 ? <p>Chưa có dự án được cấp.</p> : projects.map(p => <a key={p.id} className="doc-action" href={'/documents?projectId=' + p.id}>{p.name}</a>)}</nav></main>;
  const projectLabel = projects.find(p => p.id === projectId)?.name ?? 'Dự án trong phạm vi';
  const state = pageState({ loading, error, denied, rows: page?.rows.length ?? 0, term: applied });
  async function load(term: string): Promise<DocumentIndexPage | null> {
    setLoading(true); setError(null); setApplied(term.trim());
    try {
      const qs = new URLSearchParams({ projectId: projectId! }); if (term.trim()) qs.set('q', term.trim());
      const fresh = await api<DocumentIndexPage>('/api/documents' + (term.trim() ? '/search' : '') + '?' + qs.toString());
      setPage(fresh); return fresh;
    } catch (e) { setError((e as Error).message); return null; } finally { setLoading(false); }
  }
  async function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setFormError(''); setNotice('');
    const f = new FormData(e.currentTarget), get = (k: string) => String(f.get(k) ?? '').trim();
    try {
      const title = get('title');
      await api('/api/documents/register', { projectId, refCode: get('refCode'), docType: get('docType'), title: get('title'), ...(get('templateCode') ? { templateCode: get('templateCode') } : {}),
        sourceType: get('sourceType'), canonicalUri: get('canonicalUri'), ownerLabel: get('ownerLabel'), reviewDueAt: null, metadata: { missingFields: [] }, sourceLinks: [] });
      setForm(false); const fresh = await load(q); setNotice(registerNotice(title, fresh?.projectedAt ?? null));
    } catch (err) { setFormError((err as Error).message); } finally { setSaving(false); }
  }
  return <main className="doc-page">
    <a className="doc-action doc-back" href="/">← Về không gian làm việc</a>
    <header className="doc-head"><h1>{denied ? 'Tài liệu dự án' : projectLabel + ' / Tài liệu'}</h1>
      {!denied && canRegister && <button type="button" className="doc-action" onClick={() => setForm(v => !v)} aria-expanded={form}>Đăng ký tài liệu</button>}</header>
    {!denied && <form className="doc-filters" role="search" onSubmit={e => { e.preventDefault(); void load(q); }}>
      <label className="doc-field">Tìm trong dự án<input value={q} onChange={e => setQ(e.target.value)} maxLength={100} /></label>
      <button type="submit" className="doc-action">Tìm</button></form>}
    {form && !denied && <form className="doc-form" onSubmit={register}><h2>Đăng ký tài liệu</h2>
      {input('title', 'Tiêu đề', { minLength: 5, maxLength: 200 })}{input('refCode', 'Mã tham chiếu (có thể để trống)', { required: false, pattern: '[A-Z0-9][A-Z0-9-]{1,39}' })}
      <label className="doc-field">Loại<select name="docType" defaultValue="other">{Object.entries(TYPE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="doc-field">Mẫu<select name="templateCode" defaultValue=""><option value="">Không dùng mẫu</option>{templates.map(t => <option key={t.code} value={t.code}>{t.code} · {t.title}</option>)}</select></label>
      <label className="doc-field">Loại nguồn<select name="sourceType" defaultValue="drive"><option value="drive">Drive</option><option value="git">Git</option><option value="vault" disabled>Vault (chưa nhận liên kết https)</option></select></label>
      {input('canonicalUri', 'Liên kết nguồn (https)', { type: 'url' })}<p className="doc-meta">{SOURCE_HOST_HINT}</p>{input('ownerLabel', 'Chủ nội dung', { required: false, maxLength: 120 })}
      {formError && <p role="alert" className="doc-problem">{formError}</p>}
      <button type="submit" className="doc-action" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu đăng ký'}</button></form>}
    {notice && <p className="doc-notice" role="status">{notice}</p>}
    <DocumentsBody state={state} term={applied} onClearSearch={() => { setQ(''); void load(''); }} rows={page?.rows ?? []} projectedAt={page?.projectedAt ?? null} pendingProjection={page?.pendingProjection ?? 0} canRegister={canRegister} error={error} projectLabel={projectLabel}
      onRetry={() => void load(q)} onRegister={() => setForm(true)} />
    {state === 'ready' && page && <p className="doc-meta" role="status">{page.rows.length} / {page.total} tài liệu</p>}
  </main>;
}
