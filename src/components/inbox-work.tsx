'use client';
import { useState } from 'react';
import type { CandidateCard } from '../server/inbox';
import { commandErrorMessage } from './inbox-view';
import { LinkList } from './inbox-links';

// GIAO VIỆC 5 B: the two actions of a confirmed candidate. «Lập yêu cầu việc» files a request (it waits for a BoM seat); «Nối với việc có sẵn» links the message to a work item of
// the candidate's own project. Both send the existing candidate commands (file_request, link_work); the server decides who may do either and answers with its own code.
// The page hands over only what the reader already reads: the work items and the people of the candidate's project. Nothing here reads another project.
export type WorkOption = { id: string; projectId: string; code: string; title: string };
export type PersonOption = { id: string; name: string; role: 'engineer' | 'technical' | 'business' | 'manager' | 'viewer' };
export type WorkContext = { works: WorkOption[]; people: PersonOption[]; onCommand: (cmd: Record<string, unknown>) => Promise<void> };
export type RequestForm = { title: string; priority: string; dueAt: string; criteria: string; specUrl: string; assigneeId: string; technicalId: string; businessId: string };

/** The commands the card offers: both only on a confirmed candidate, as the server enforces (CANDIDATE_NOT_CONFIRMED otherwise). */
export const workCommands = (c: Pick<CandidateCard, 'state'>): ('file_request' | 'link_work')[] => c.state === 'confirmed' ? ['file_request', 'link_work'] : [];

/** The title starts empty. Only text the reader already sees on the card (an excerpt shown under the current configuration) may prefill it. */
export const requestFormFromData = (c: Pick<CandidateCard, 'contentMode' | 'excerpt'>): RequestForm =>
  ({ title: c.contentMode === 'excerpt' && c.excerpt ? c.excerpt.trim().slice(0, 200) : '', priority: 'normal', dueAt: '', criteria: '', specUrl: '', assigneeId: '', technicalId: '', businessId: '' });

/** The body of file_request: the card's version, a request key and the filer's own words. No tenant, requester, origin or project: the server takes those from the session and the candidate. */
export function fileRequestBody(c: Pick<CandidateCard, 'version'>, f: RequestForm, requestKey: string): Record<string, unknown> {
  return { kind: 'file_request', expectedVersion: c.version, requestKey, code: null, title: f.title.trim(), priority: f.priority === 'high' ? 'high' : 'normal',
    dueAt: f.dueAt ? new Date(f.dueAt + 'T00:00:00.000Z').toISOString() : null, criteria: f.criteria, specUrl: f.specUrl.trim() || null,
    assigneeId: f.assigneeId || null, technicalId: f.technicalId || null, businessId: f.businessId || null };
}
export const linkWorkBody = (c: Pick<CandidateCard, 'version'>, workId: string): Record<string, unknown> => ({ kind: 'link_work', expectedVersion: c.version, workId });
/** Only the work of the candidate's own project, whatever the page handed over. */
export const pickableWorks = (c: Pick<CandidateCard, 'projectId'>, works: WorkOption[]): WorkOption[] => works.filter(w => w.projectId === c.projectId);

const ROLE_FIELDS = [['assigneeId', 'Người thực hiện đề xuất', 'engineer'], ['technicalId', 'Người duyệt kỹ thuật đề xuất', 'technical'], ['businessId', 'Người nghiệm thu nghiệp vụ đề xuất', 'business']] as const;

export function WorkRequestForm({ card, people, busy, error, onSubmit }: { card: CandidateCard; people: PersonOption[]; busy: boolean; error: string; onSubmit: (body: Record<string, unknown>) => void | Promise<void> }) {
  const start = requestFormFromData(card);
  return <form className="inbox-actions" aria-label="Lập yêu cầu việc" onSubmit={e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget), get = (k: string) => String(f.get(k) ?? '');
    void onSubmit(fileRequestBody(card, { title: get('title'), priority: get('priority'), dueAt: get('dueAt'), criteria: get('criteria'), specUrl: get('specUrl'),
      assigneeId: get('assigneeId'), technicalId: get('technicalId'), businessId: get('businessId') }, crypto.randomUUID()));
  }}>
    <p className="doc-meta">Yêu cầu thuộc dự án của tin này và chờ một ghế BoM của dự án duyệt; chưa phải việc đã có.</p>
    <label className="doc-field">Tiêu đề (tự gõ)<input name="title" defaultValue={start.title} minLength={5} maxLength={200} required /></label>
    <label className="doc-field">Mức ưu tiên<select name="priority" defaultValue="normal"><option value="normal">Thường</option><option value="high">Cao</option></select></label>
    <label className="doc-field">Hạn (không bắt buộc)<input name="dueAt" type="date" /></label>
    <label className="doc-field">Tiêu chí (không bắt buộc)<textarea name="criteria" maxLength={3000} className="inbox-textarea" /></label>
    <label className="doc-field">Liên kết đặc tả (https, không bắt buộc)<input name="specUrl" type="url" maxLength={1000} /></label>
    {ROLE_FIELDS.map(([name, label, role]) => {
      const options = people.filter(p => p.role === role);
      return options.length === 0 ? null : <label key={name} className="doc-field">{label}<select name={name} defaultValue=""><option value="">Chưa đề xuất</option>
        {options.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>;
    })}
    {error && <p role="alert" className="doc-problem">{error}</p>}
    <button type="submit" className="doc-action" disabled={busy}>Gửi yêu cầu chờ BoM duyệt</button>
  </form>;
}

export function WorkPicker({ card, works, busy, error, onSubmit }: { card: CandidateCard; works: WorkOption[]; busy: boolean; error: string; onSubmit: (body: Record<string, unknown>) => void | Promise<void> }) {
  const list = pickableWorks(card, works);
  if (list.length === 0) return <p className="doc-meta">Dự án chưa có việc nào bạn đọc được để nối.</p>;
  return <form className="inbox-actions" aria-label="Nối với việc có sẵn" onSubmit={e => { e.preventDefault(); void onSubmit(linkWorkBody(card, String(new FormData(e.currentTarget).get('workId') ?? ''))); }}>
    <label className="doc-field">Việc của dự án<select name="workId" required>{list.map(w => <option key={w.id} value={w.id}>{w.code} · {w.title}</option>)}</select></label>
    {error && <p role="alert" className="doc-problem">{error}</p>}
    <button type="submit" className="doc-action" disabled={busy}>Nối tin với việc này</button>
  </form>;
}

/** The two buttons of a confirmed card and the form each opens. The answer codes (403 WORK_REQUEST_DENIED, 403 LINK_DENIED, …) are shown as the server returns them. */
export function CandidateWork({ card, work }: { card: CandidateCard; work: WorkContext }) {
  const [mode, setMode] = useState<'file' | 'link' | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const offered = workCommands(card);
  const links = card.links ?? [];
  if (offered.length === 0 && links.length === 0) return null;
  async function send(body: Record<string, unknown>) {
    setBusy(true); setError('');
    try { await work.onCommand(body); setMode(null); } catch (e) { setError(commandErrorMessage(e)); } finally { setBusy(false); }
  }
  return <div className="inbox-work" aria-label="Từ tin thành việc">
    <LinkList links={links} version={card.version} busy={busy} onCommand={body => void send(body)} />
    {error && mode === null && <p role="alert" className="doc-problem">{error}</p>}
    <div className="inbox-actions">
      {offered.includes('file_request') && <button type="button" className="doc-action" disabled={busy} onClick={() => { setError(''); setMode(mode === 'file' ? null : 'file'); }}>Lập yêu cầu việc</button>}
      {offered.includes('link_work') && <button type="button" className="doc-action inbox-secondary" disabled={busy} onClick={() => { setError(''); setMode(mode === 'link' ? null : 'link'); }}>Nối với việc có sẵn</button>}
    </div>
    {mode === 'file' && <WorkRequestForm card={card} people={work.people} busy={busy} error={error} onSubmit={send} />}
    {mode === 'link' && <WorkPicker card={card} works={work.works} busy={busy} error={error} onSubmit={send} />}
  </div>;
}
