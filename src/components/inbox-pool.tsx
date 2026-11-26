'use client';
import { useState } from 'react';
import type { PoolCard } from '../server/intake-pool';
import { api } from './api';
import { TrailStrip } from './inbox-trail';
import { LinkList } from './inbox-links';
import { formatTime } from './inbox-view';

// The pool of the shared group (GIAO VIỆC 5 B), for the Team Tech roster. A pool item carries no message text, no file name and no sender label: only the time, the
// sender's own account name, the IN code and the steps. Text from the database is rendered as React text only.
export type PoolProject = { id: string; name: string; bu: string };
type Page = { items: PoolCard[]; unassigned: number };
const KINDS = { incident: 'Sự cố', request: 'Yêu cầu', document: 'Tài liệu' } as const;
export const POOL_NOTE = 'Tin ở nhóm chung chỉ giữ con trỏ, không giữ chữ. Tìm tin trong nhóm bằng mã IN ở câu trả lời biên nhận của bot.';
export const POOL_RECEIPT: Record<string, string> = { delivered: 'Đã gửi biên nhận', pending: 'Biên nhận chưa gửi', leased: 'Đang gửi biên nhận', uncertain: 'Chưa rõ đã gửi biên nhận', dead: 'Chưa gửi được biên nhận', abandoned: 'Chưa gửi được biên nhận' };

/** One pool item. Hook-free, so markup tests render it; the forms call `onCommand`, which sends the command with the version the card was read at. */
export function PoolItemView({ card, projects, busy, error, onCommand }: { card: PoolCard; projects: PoolProject[]; busy?: boolean; error?: string; onCommand?: (cmd: Record<string, unknown>) => void }) {
  const open = card.state === 'unassigned';
  return <article className="inbox-card" aria-label={'Tin ' + card.ref} data-state={card.state}>
    <header className="inbox-head"><h3 className="doc-title">{card.ref}</h3>
      <p className="inbox-badges"><span className="inbox-badge">{card.projectLabel ?? 'Chưa gán dự án'}</span>
        {card.classification && <span className="inbox-badge">{KINDS[card.classification]}</span>}
        {card.state === 'dismissed' && <span className="inbox-badge">Đã bỏ qua</span>}{card.forwarded && <span className="inbox-badge">Tin chuyển tiếp</span>}</p></header>
    <p className="doc-meta">{POOL_NOTE}</p>
    <dl className="inbox-life">
      <div><dt>Nhận lúc</dt><dd>{formatTime(card.receivedAt)}</dd></div>
      <div><dt>Người gửi</dt><dd>{card.senderName ?? 'Thành viên Team Tech'}</dd></div>
      <div><dt>Biên nhận</dt><dd>{card.receipt.state ? POOL_RECEIPT[card.receipt.state] ?? card.receipt.state : 'Chưa có biên nhận'}</dd></div>
    </dl>
    <TrailStrip trail={card.trail} />
    <LinkList links={card.links} version={card.version} busy={busy} onCommand={onCommand} />
    {error && <p role="alert" className="doc-problem">{error}</p>}
    {onCommand && (open || card.state === 'assigned') && <form className="inbox-actions" onSubmit={e => {
      e.preventDefault();
      // new FormData(form) leaves out the submit button, so the button pressed comes from the event; Enter in a field submits as the first button (file)
      const pressed = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      const f = new FormData(e.currentTarget), get = (k: string) => String(f.get(k) ?? '');
      const project = card.projectId ?? get('projectId');
      if (pressed?.value === 'link') onCommand({ kind: 'link_work', expectedVersion: card.version, projectId: project, classification: get('classification') || 'request', workId: get('workId').trim() });
      else onCommand({ kind: 'file_request', expectedVersion: card.version, projectId: project, classification: get('classification') || 'request', requestKey: crypto.randomUUID(), code: null,
        title: get('title').trim(), priority: get('priority') || 'normal', dueAt: null, criteria: get('criteria'), specUrl: null, assigneeId: null, technicalId: null, businessId: null });
    }}>
      {open && <label className="doc-field">Dự án<select name="projectId" required>{projects.map(p => <option key={p.id} value={p.id}>{p.name} · {p.bu}</option>)}</select></label>}
      {open && <label className="doc-field">Loại<select name="classification" defaultValue="request">{(Object.keys(KINDS) as (keyof typeof KINDS)[]).map(k => <option key={k} value={k}>{KINDS[k]}</option>)}</select></label>}
      <label className="doc-field">Việc cần tạo (tiêu đề do anh/chị tự gõ)<input name="title" minLength={5} maxLength={200} /></label>
      <label className="doc-field">Tiêu chí (không bắt buộc)<textarea name="criteria" maxLength={3000} className="inbox-textarea" /></label>
      <label className="doc-field">Mức ưu tiên<select name="priority" defaultValue="normal"><option value="normal">Thường</option><option value="high">Cao</option></select></label>
      <label className="doc-field">Hoặc liên kết việc đã có: mã nội bộ của việc<input name="workId" /></label>
      <button type="submit" name="mode" value="file" className="doc-action" disabled={busy}>Tạo yêu cầu chờ BoM duyệt</button>
      <button type="submit" name="mode" value="link" className="doc-action inbox-secondary" disabled={busy}>Liên kết việc đã có</button>
    </form>}
    {onCommand && open && <div className="inbox-actions">{(['not_work', 'duplicate', 'wrong_group'] as const).map(code =>
      <button key={code} type="button" className="doc-action inbox-secondary" disabled={busy}
        onClick={() => onCommand({ kind: 'dismiss', expectedVersion: card.version, code })}>{{ not_work: 'Không phải việc', duplicate: 'Trùng', wrong_group: 'Nhầm nhóm' }[code]}</button>)}</div>}
    {onCommand && card.state !== 'unassigned' && <div className="inbox-actions"><button type="button" className="doc-action inbox-secondary" disabled={busy}
      onClick={() => onCommand({ kind: 'reopen', expectedVersion: card.version })}>Mở lại</button></div>}
  </article>;
}

export function PoolList({ initial, projects }: { initial: Page; projects: PoolProject[] }) {
  const [page, setPage] = useState(initial), [busy, setBusy] = useState(false), [errors, setErrors] = useState<Record<string, string>>({});
  async function reload() { setPage(await api<Page>('/api/inbox/pool')); }
  async function command(card: PoolCard, cmd: Record<string, unknown>) {
    setBusy(true); setErrors(e => ({ ...e, [card.itemId]: '' }));
    try { await api('/api/inbox/pool/' + card.itemId + '/commands', cmd); await reload(); }
    catch (e) { setErrors(x => ({ ...x, [card.itemId]: (e as Error).message })); } finally { setBusy(false); }
  }
  return <main className="doc-page"><a className="doc-action doc-back" href="/">← Về không gian làm việc</a><h1>Tin nhóm chung</h1>
    <p className="doc-meta">Chỉ thành viên Team Tech thấy trang này. Chọn dự án rồi tạo yêu cầu: yêu cầu chờ một ghế BoM của dự án duyệt, chưa phải việc đã có.</p>
    {page.items.length === 0 ? <div className="doc-state doc-empty"><h2>Chưa có tin nào ở nhóm chung</h2></div>
      : <div className="doc-list" role="list">{page.items.map(c => <div role="listitem" key={c.itemId + ':' + c.version}>
        <PoolItemView card={c} projects={projects} busy={busy} error={errors[c.itemId]} onCommand={cmd => void command(c, cmd)} /></div>)}
        <p className="doc-meta" role="status">{`${page.unassigned} tin chưa gán dự án`}</p></div>}
  </main>;
}
