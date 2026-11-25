'use client';
import { useState } from 'react';
import { api } from './api';
import { projectRole } from '../server/types';
import type { Principal } from '../server/types';
import type { PublicRequest, WorkRequestItem } from '@/server/work-requests';
import type { ImportAnnotation } from '@/server/sheet-import';

// «Việc chờ BoM duyệt». The screen computes no permission: the buttons come from `can_decide` and every denial comes back from the service.
// Text from the database is rendered as React text only.
type Svc = { id: string; project_id: string; name: string };
export type RequestCard = PublicRequest<WorkRequestItem>;
type Page = { items: RequestCard[]; total: number };
const stateLabel = { pending: 'Chờ BoM duyệt', approved: 'Đã duyệt', rejected: 'Đã từ chối' } as const;
const when = (v: string | null) => v ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(v)) : '';
export const NO_SEAT_COPY = 'Dự án chưa có ghế BoM — chưa ai duyệt được.';
export const OWN_COPY = 'Bạn là người tạo — một ghế BoM khác của dự án sẽ duyệt.';
// the requester holds no grant in the project, so the screen cannot tell whether a seat exists: neutral copy
export const WAIT_COPY = 'Yêu cầu chờ ghế BoM của dự án.';
export const UNASSIGNED = 'Chưa giao';
export const SLOTS = [
  { field: 'assigneeId', proposed: 'assignee_id', role: 'engineer', label: 'Người thực hiện' },
  { field: 'technicalId', proposed: 'technical_id', role: 'technical', label: 'Nghiệm thu kỹ thuật' },
  { field: 'businessId', proposed: 'business_id', role: 'business', label: 'Nghiệm thu nghiệp vụ' },
] as const;
/** The name of a proposed person, or «Chưa giao». A person the reader's directory does not list is shown as a person, never as an id. */
export const nameOf = (people: Principal[], id: string | null) => !id ? UNASSIGNED : people.find(x => x.id === id)?.name ?? 'Người được giao';
/** People who may fill a slot: the ones holding that role in the project of the request. */
export const candidates = (people: Principal[], projectId: string, role: string) => people.filter(x => projectRole(x, projectId) === role);
/** What a pending card tells a reader who cannot decide it. */
export const waitingCopy = (item: Pick<RequestCard, 'seat_open'>, own: boolean) => item.seat_open === false ? NO_SEAT_COPY : item.seat_open === null ? WAIT_COPY : own ? OWN_COPY : WAIT_COPY;

/** The decision body: the seat names only the slots the request left empty (null for the others); a rejection names nobody. */
export const decisionBody = (item: RequestCard, mode: 'approve' | 'reject', get: (k: string) => string) => ({
  decision: mode, expectedVersion: item.version, serviceId: mode === 'approve' ? get('serviceId') : null, code: get('code') || null, note: get('note'),
  ...Object.fromEntries(SLOTS.map(slot => [slot.field, mode === 'approve' && !item[slot.proposed] ? get(slot.field) || null : null])),
});
/** The approval fields: the service, one select for each EMPTY slot (people holding that role in the project), and the optional code. */
export function ApproveFields({ item, services, people }: { item: RequestCard; services: Svc[]; people: Principal[] }) {
  const mine = services.filter(s => s.project_id === item.project_id);
  return <>
    <label className="doc-field">Hệ thống<select name="serviceId" required>{mine.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {SLOTS.filter(slot => !item[slot.proposed]).map(slot => <label key={slot.field} className="doc-field">{slot.label}<select name={slot.field} defaultValue="">
      <option value="">{UNASSIGNED}</option>{candidates(people, item.project_id, slot.role).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>)}
    <label className="doc-field">Mã việc (không bắt buộc)<input name="code" pattern="[A-Z0-9][A-Z0-9-]{2,39}" maxLength={40} defaultValue={item.code ?? ''} /></label>
  </>;
}

export function Decide({ item, services, people, onDone }: { item: RequestCard; services: Svc[]; people: Principal[]; onDone: () => Promise<void> }) {
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
    {mode === 'approve' && <ApproveFields item={item} services={services} people={people} />}
    <label className="doc-field">Ghi chú / căn cứ<textarea name="note" required minLength={5} maxLength={2000} rows={2} /></label>
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="doc-action" disabled={busy}>{busy ? 'Đang lưu…' : mode === 'approve' ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}</button>
    <button type="button" className="doc-action" onClick={() => setMode(null)}>Hủy</button>
  </form>;
}

export function WorkRequests({ initial, services, people = [], imports = {}, importEnabled = false }: { initial: Page; services: Svc[]; people?: Principal[]; imports?: Record<string, ImportAnnotation>; importEnabled?: boolean }) {
  const [page, setPage] = useState(initial), [error, setError] = useState('');
  async function reload() { try { setPage(await api<Page>('/api/v1/work-requests')); setError(''); } catch (e) { setError((e as Error).message); } }
  return <main className="doc-page"><h1>Việc chờ BoM duyệt</h1>
    <p className="muted">Việc mới do Team Tech tạo được ghi ở trạng thái chờ. Một ghế BoM của dự án, không phải người tạo, duyệt hoặc từ chối. Đổi người thực hiện của việc đã duyệt cần phiếu BoM 3/3.</p>
    {importEnabled && <p><a href="/work-import">Nhập bảng việc</a></p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {!page.items.length && <p className="muted">Chưa có yêu cầu nào trong phạm vi của bạn.</p>}
    {page.items.map(item => <article key={item.id} className="doc-card" data-state={item.state}>
      <div className="doc-main">
        <h2 dir="auto">{item.title}</h2>
        <p><strong>{stateLabel[item.state]}</strong> · {item.project_name ?? 'Dự án trong phạm vi'}{item.priority === 'high' ? ' · Ưu tiên cao' : ''}</p>
        {item.origin === 'intake' && item.source_ref && <p className="muted">Từ tin {item.source_ref.split(' · ')[0]}</p>}
        <p className="muted">Người tạo {item.requester_name} · {when(item.created_at)}</p>
        {item.criteria && <p dir="auto">{item.criteria}</p>}
        <ul className="muted" aria-label="Người đề xuất">{SLOTS.map(slot => <li key={slot.field}>{slot.label}: {nameOf(people, item[slot.proposed])}</li>)}</ul>
        {imports[item.id] && <ImportNote note={imports[item.id]} />}
        <p className="muted">Hạn: {item.due_at ? when(item.due_at) : 'Chưa đặt'}{item.spec_url && <> · <a href={item.spec_url} target="_blank" rel="noopener noreferrer">Tài liệu mô tả</a></>}</p>
        {item.state !== 'pending' && <p className="muted">{item.state === 'approved' ? 'Duyệt' : 'Từ chối'} bởi {item.decider_name} · {when(item.decided_at)}{item.decision_note ? ' · ' + item.decision_note : ''}{item.work_code ? ' · Việc ' + item.work_code : ''}</p>}
        {item.state === 'pending' && item.seat_open === false && <p className="notice neutral">{NO_SEAT_COPY}</p>}
        {item.state === 'pending' && !item.can_decide && item.seat_open !== false && <p className="muted">{waitingCopy(item, item.seat_open === true)}</p>}
      </div>
      {item.can_decide && <Decide item={item} services={services} people={people} onDone={reload} />}
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
