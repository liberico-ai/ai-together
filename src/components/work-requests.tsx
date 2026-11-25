'use client';
import { useState } from 'react';
import { api } from './api';
import { projectRole } from '../server/types';
import type { Principal } from '../server/types';
import type { BulkResult, PublicRequest, WorkRequestItem } from '@/server/work-requests';
import type { ImportAnnotation } from '@/server/sheet-import';

// «Việc chờ BoM duyệt». The screen computes no permission: the buttons come from `can_decide` and every denial comes back from the service.
// Text from the database is rendered as React text only.
type Svc = { id: string; project_id: string; name: string };
export type Performer = { id: string; name: string };
export type RequestCard = PublicRequest<WorkRequestItem>;
type Page = { items: RequestCard[]; total: number };
const stateLabel = { pending: 'Chờ BoM duyệt', approved: 'Đã duyệt', rejected: 'Đã từ chối' } as const;
const when = (v: string | null) => v ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(v)) : '';
// one of the three BoM Tech decides in every project (0.9.2, M5): no request waits for a seat that does not exist
export const NO_SEAT_COPY = 'Dự án chưa có ghế BoM — một BoM Tech sẽ duyệt.';
export const OWN_COPY = 'Bạn là người tạo — một BoM Tech hoặc một ghế BoM khác của dự án sẽ duyệt.';
// the requester holds no grant in the project, so the screen cannot tell whether a seat exists: neutral copy
export const WAIT_COPY = 'Yêu cầu chờ BoM Tech hoặc ghế BoM của dự án duyệt.';
export const UNASSIGNED = 'Chưa giao';
export const SLOTS = [
  { field: 'assigneeId', proposed: 'assignee_id', role: 'engineer', label: 'Người thực hiện' },
  { field: 'technicalId', proposed: 'technical_id', role: 'technical', label: 'Nghiệm thu kỹ thuật' },
  { field: 'businessId', proposed: 'business_id', role: 'business', label: 'Nghiệm thu nghiệp vụ' },
] as const;
/** The name of a proposed person, or «Chưa giao». A person the reader's directory does not list is shown as a person, never as an id. */
export const nameOf = (people: (Principal | Performer)[], id: string | null) => !id ? UNASSIGNED : people.find(x => x.id === id)?.name ?? 'Người được giao';
/** People who may fill an acceptor slot: the ones holding that role in the project of the request. */
export const candidates = (people: Principal[], projectId: string, role: string) => people.filter(x => projectRole(x, projectId) === role);
/** People who may perform the work (M1, M2): engineers of the project, every Team Tech member, and the BoM seats of the project. Each listed once. */
export function performerCandidates(people: Principal[], performers: Performer[], seats: string[], projectId: string): Performer[] {
  const all = [...candidates(people, projectId, 'engineer'), ...performers, ...people.filter(x => seats.includes(x.id) && x.projectIds.includes(projectId))];
  return all.filter((x, i) => all.findIndex(y => y.id === x.id) === i).map(x => ({ id: x.id, name: x.name }));
}
/** What a pending card tells a reader who cannot decide it. */
export const waitingCopy = (item: Pick<RequestCard, 'seat_open'>, own: boolean) => item.seat_open === false ? NO_SEAT_COPY : item.seat_open === null ? WAIT_COPY : own ? OWN_COPY : WAIT_COPY;

/** The decision body: the person chosen for each slot (it may differ from the proposed one, M3); a rejection names nobody. */
export const decisionBody = (item: RequestCard, mode: 'approve' | 'reject', get: (k: string) => string) => ({
  decision: mode, expectedVersion: item.version, serviceId: mode === 'approve' ? get('serviceId') : null, code: get('code') || null, note: get('note'),
  ...Object.fromEntries(SLOTS.map(slot => [slot.field, mode === 'approve' ? get(slot.field) || null : null])),
});
type Pick3 = { people: Principal[]; performers?: Performer[]; seats?: Record<string, string[]> };
/** The approval fields: the service, one select per slot (the proposed person chosen first; the decider may change it), and the optional code. */
export function ApproveFields({ item, services, people, performers = [], seats = {} }: { item: RequestCard; services: Svc[] } & Pick3) {
  const mine = services.filter(s => s.project_id === item.project_id);
  const options = (slot: typeof SLOTS[number]) => {
    const list = slot.role === 'engineer' ? performerCandidates(people, performers, seats[item.project_id] ?? [], item.project_id) : candidates(people, item.project_id, slot.role);
    const proposed = item[slot.proposed];
    return proposed && !list.some(x => x.id === proposed) ? [{ id: proposed, name: nameOf([...people, ...performers], proposed) }, ...list] : list;
  };
  return <>
    <label className="doc-field">Hệ thống<select name="serviceId" required>{mine.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {SLOTS.map(slot => <label key={slot.field} className="doc-field">{slot.label}{item[slot.proposed] ? ' (đã đề xuất, có thể đổi)' : ''}<select name={slot.field} defaultValue={item[slot.proposed] ?? ''}>
      <option value="">{item[slot.proposed] ? 'Giữ người đã đề xuất' : UNASSIGNED}</option>{options(slot).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>)}
    <label className="doc-field">Mã việc (không bắt buộc)<input name="code" pattern="[A-Z0-9][A-Z0-9-]{2,39}" maxLength={40} defaultValue={item.code ?? ''} /></label>
  </>;
}

export function Decide({ item, services, people, performers, seats, onDone }: { item: RequestCard; services: Svc[]; onDone: () => Promise<void> } & Pick3) {
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    const f = new FormData(e.currentTarget), get = (k: string) => String(f.get(k) ?? '');
    try {
      await api('/api/v1/work-requests/' + item.id + '/decision', decisionBody(item, mode!, get));
      await onDone();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  if (!mode) return <div className="doc-actions"><button className="doc-action" onClick={() => setMode('approve')}>Duyệt</button><button className="doc-action" onClick={() => setMode('reject')}>Từ chối</button></div>;
  return <form className="doc-actions" onSubmit={submit}>
    {mode === 'approve' && <ApproveFields item={item} services={services} people={people} performers={performers} seats={seats} />}
    <label className="doc-field">Ghi chú / căn cứ<textarea name="note" required minLength={5} maxLength={2000} rows={2} /></label>
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="doc-action" disabled={busy}>{busy ? 'Đang lưu…' : mode === 'approve' ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}</button>
    <button type="button" className="doc-action" onClick={() => setMode(null)}>Hủy</button>
  </form>;
}

/** The body of a batch approval (M7): the chosen requests, or one import batch; a service for each project that has more than one. */
export const bulkBody = (selection: { requestIds?: string[]; batchId?: string }, note: string, services: Record<string, string>) => ({
  ...selection, note, services: Object.entries(services).filter(([, s]) => s).map(([projectId, serviceId]) => ({ projectId, serviceId })),
});
/** Approve many at once: each request is decided on its own; the answer lists every request with its result. */
export function BulkDecide({ items, services, imports, onDone }: { items: RequestCard[]; services: Svc[]; imports: Record<string, ImportAnnotation>; onDone: () => Promise<void> }) {
  const open = items.filter(i => i.can_decide && i.state === 'pending');
  const [chosen, setChosen] = useState<string[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [results, setResults] = useState<BulkResult[]>([]);
  if (!open.length && !results.length) return null;
  const batches = [...new Set(open.map(i => imports[i.id]?.batchId).filter((b): b is string => !!b))];
  const projects = [...new Set(open.map(i => i.project_id))].filter(p => services.filter(s => s.project_id === p).length > 1);
  const title = (id: string) => items.find(i => i.id === id)?.title ?? 'Yêu cầu';
  async function send(selection: { requestIds?: string[]; batchId?: string }, form: HTMLFormElement) {
    const f = new FormData(form);
    setBusy(true); setError('');
    try {
      const picked = Object.fromEntries(projects.map(p => [p, String(f.get('service-' + p) ?? '')]));
      const out = await api<{ results: BulkResult[] }>('/api/v1/work-requests/decide-many', bulkBody(selection, String(f.get('note') ?? ''), picked));
      setResults(out.results); setChosen([]);
      await onDone();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <section className="doc-card" aria-label="Duyệt nhiều yêu cầu">
    <form className="doc-main" onSubmit={e => { e.preventDefault(); void send({ requestIds: chosen }, e.currentTarget); }}>
      <h2>Duyệt nhiều yêu cầu</h2>
      <p className="muted">Mỗi yêu cầu được duyệt riêng, ghi sự kiện riêng. Yêu cầu nào không duyệt được sẽ báo lý do ngay dòng đó, không chặn các yêu cầu khác. Người đề xuất giữ nguyên; yêu cầu chưa có người thực hiện cần duyệt riêng.</p>
      {open.map(i => <label key={i.id} className="doc-field"><input type="checkbox" checked={chosen.includes(i.id)} onChange={e => setChosen(e.target.checked ? [...chosen, i.id] : chosen.filter(x => x !== i.id))} /> <span dir="auto">{i.title}</span></label>)}
      {projects.map(p => <label key={p} className="doc-field">Hệ thống cho {items.find(i => i.project_id === p)?.project_name ?? 'dự án'}<select name={'service-' + p} defaultValue="">
        <option value="">Chọn hệ thống</option>{services.filter(s => s.project_id === p).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>)}
      <label className="doc-field">Ghi chú / căn cứ<textarea name="note" required minLength={5} maxLength={2000} rows={2} /></label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <div className="doc-actions">
        <button className="doc-action" disabled={busy || !chosen.length}>{busy ? 'Đang duyệt…' : `Duyệt ${chosen.length} yêu cầu đã chọn`}</button>
        {batches.map(b => <button key={b} type="button" className="doc-action" disabled={busy} onClick={e => { const form = e.currentTarget.form; if (form?.reportValidity()) void send({ batchId: b }, form); }}>Duyệt cả lô nhập ({open.filter(i => imports[i.id]?.batchId === b).length} yêu cầu)</button>)}
      </div>
      {results.length > 0 && <ul aria-label="Kết quả duyệt">{results.map(r => <li key={r.id}><span dir="auto">{title(r.id)}</span>: {r.ok ? 'đã duyệt' : r.message}</li>)}</ul>}
    </form>
  </section>;
}

export function WorkRequests({ initial, services, people = [], performers = [], seats = {}, imports = {}, importEnabled = false }: { initial: Page; services: Svc[]; people?: Principal[]; performers?: Performer[]; seats?: Record<string, string[]>; imports?: Record<string, ImportAnnotation>; importEnabled?: boolean }) {
  const [page, setPage] = useState(initial), [error, setError] = useState('');
  async function reload() { try { setPage(await api<Page>('/api/v1/work-requests')); setError(''); } catch (e) { setError((e as Error).message); } }
  const everyone = [...people, ...performers];
  return <main className="doc-page"><h1>Việc chờ BoM duyệt</h1>
    <p className="muted">Việc mới do Team Tech tạo được ghi ở trạng thái chờ. Một BoM Tech hoặc một ghế BoM của dự án, không phải người tạo, duyệt hoặc từ chối; khi duyệt có thể đổi người được đề xuất. Đổi người thực hiện của việc đã duyệt cần phiếu BoM 3/3.</p>
    {importEnabled && <p><a href="/work-import">Nhập bảng việc</a></p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {!page.items.length && <p className="muted">Chưa có yêu cầu nào trong phạm vi của bạn.</p>}
    <BulkDecide items={page.items} services={services} imports={imports} onDone={reload} />
    {page.items.map(item => <article key={item.id} className="doc-card" data-state={item.state}>
      <div className="doc-main">
        <h2 dir="auto">{item.title}</h2>
        <p><strong>{stateLabel[item.state]}</strong> · {item.project_name ?? 'Dự án trong phạm vi'}{item.priority === 'high' ? ' · Ưu tiên cao' : ''}</p>
        {item.origin === 'intake' && item.source_ref && <p className="muted">Từ tin {item.source_ref.split(' · ')[0]}</p>}
        <p className="muted">Người tạo {item.requester_name} · {when(item.created_at)}</p>
        {item.criteria && <p dir="auto">{item.criteria}</p>}
        <ul className="muted" aria-label="Người đề xuất">{SLOTS.map(slot => <li key={slot.field}>{slot.label}: {nameOf(everyone, item[slot.proposed])}</li>)}</ul>
        {imports[item.id] && <ImportNote note={imports[item.id]} />}
        <p className="muted">Hạn: {item.due_at ? when(item.due_at) : 'Chưa đặt'}{item.spec_url && <> · <a href={item.spec_url} target="_blank" rel="noopener noreferrer">Tài liệu mô tả</a></>}</p>
        {item.state !== 'pending' && <p className="muted">{item.state === 'approved' ? 'Duyệt' : 'Từ chối'} bởi {item.decider_name} · {when(item.decided_at)}{item.decision_note ? ' · ' + item.decision_note : ''}{item.work_code ? ' · Việc ' + item.work_code : ''}</p>}
        {item.state === 'pending' && item.seat_open === false && <p className="notice neutral">{NO_SEAT_COPY}</p>}
        {item.state === 'pending' && !item.can_decide && item.seat_open !== false && <p className="muted">{waitingCopy(item, item.seat_open === true)}</p>}
      </div>
      {item.can_decide && <Decide item={item} services={services} people={people} performers={performers} seats={seats} onDone={reload} />}
    </article>)}
  </main>;
}

// Imported from the team work list (migration 027): what the sheet said, as written. The status is the sheet's report, never an acceptance.
function ImportNote({ note }: { note: ImportAnnotation }) {
  return <div className="muted">
    <p>Nhập từ bảng nguồn · dòng STT <span dir="auto">{note.stt}</span> · <span dir="auto">{note.sourceRef}</span></p>
    <p>Trạng thái theo bảng nguồn: <span dir="auto">{note.sourceStatus || '(trống)'}</span> · Hạn theo bảng nguồn: <span dir="auto">{note.dueRaw || '(trống)'}</span> · Người phụ trách theo bảng: <span dir="auto">{note.ownerRaw || '(trống)'}</span></p>
    {note.flags.length > 0 && <p>Cờ: {note.flags.join(', ')}</p>}
  </div>;
}
