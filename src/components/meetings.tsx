'use client';
import { useState } from 'react';
import { api } from './api';
import type { ChangeView, SeriesView } from '../server/meetings';

// «Lịch họp BoM» (GIAO VIỆC 5 F). The screen computes no permission: it lists only the series the service answers, and every refusal comes back from the service.
// A change names the stored message that confirmed it by its IN code; the message itself is never shown or read here.
const WEEKDAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
export const dayText = (date: string) => date.split('-').reverse().join('/');
const sourceText = (ref: string | null) => ref ? 'theo ' + ref : 'lịch gốc';
const when = (v: string) => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(v));
const changeText = (c: ChangeView) => c.kind === 'one_off' ? `Chỉ buổi ${dayText(c.sessionDate!)}: ${c.newTime}`
  : c.kind === 'recurring' ? `Cả lịch từ buổi ${dayText(c.effectiveFrom!)}: ${c.newTime}` : 'Chưa rõ phạm vi' + (c.newTime ? ' (giờ nêu: ' + c.newTime + ')' : '');

/** Only what the kind needs goes to the server: a date for one session, no answered question on an unclear change. */
export function meetingBody(s: SeriesView, get: (k: string) => string, requestKey: string): Record<string, unknown> {
  const kind = get('kind');
  return { seriesId: s.id, requestKey, kind, sessionDate: kind === 'one_off' ? get('sessionDate') || null : null, newTime: get('newTime') || null,
    sourceRef: get('sourceRef').trim().toUpperCase(), resolvesChangeId: kind === 'unclear' ? null : get('resolvesChangeId') || null, expectedVersion: s.version };
}

export function MeetingsView({ series, busy, onCommand }: { series: SeriesView[]; busy?: boolean; onCommand: (body: Record<string, unknown>) => void }) {
  if (!series.length) return <p className="muted">Bạn chưa có lịch họp nào để ghi. Lịch họp do người vận hành khai; chỉ ghế BoM của dự án hoặc BoM Tech ghi được thay đổi.</p>;
  return <>{series.map(s => <section key={s.id} className="doc-card" aria-label={s.title}>
    <div className="doc-main">
      <h2 dir="auto">{s.projectName} — {s.title}</h2>
      <p>{WEEKDAYS[s.weekday - 1]} hằng tuần, giờ gốc {s.baseTime} (giờ Việt Nam){s.enabled ? '' : ' · đang tắt'}</p>
      {s.next && <p><strong>Buổi tới: {dayText(s.next.date)} lúc {s.next.time}</strong> · {sourceText(s.next.sourceRef)}</p>}
      {s.openQuestions.map(q => <p key={q.id} className="notice neutral">Tin {q.sourceRef} báo đổi giờ nhưng chưa rõ phạm vi. Lịch này tạm ngừng nhắc đến khi có thay đổi trả lời.</p>)}
      {s.changes.length > 0 && <ul className="inbox-plain" aria-label="Các thay đổi đã ghi">{s.changes.map(c => <li key={c.id} className="doc-wrap">{changeText(c)} · theo {c.sourceRef} · {c.recorderName} · {when(c.at)}</li>)}</ul>}
    </div>
    <form className="inbox-actions" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onCommand(meetingBody(s, k => String(f.get(k) ?? ''), crypto.randomUUID())); }}>
      <label className="doc-field">Áp dụng cho<select name="kind" defaultValue="one_off">
        <option value="one_off">Chỉ một buổi</option><option value="recurring">Cả lịch định kỳ, từ buổi kế tiếp</option><option value="unclear">Chưa rõ áp cho buổi nào (tạm ngừng nhắc, bot hỏi lại)</option>
      </select></label>
      <label className="doc-field">Ngày buổi (khi chỉ đổi một buổi)<input type="date" name="sessionDate" defaultValue={s.next?.date ?? ''} /></label>
      <label className="doc-field">Giờ mới<input type="time" name="newTime" /></label>
      <label className="doc-field">Mã tin xác nhận (IN-…)<input name="sourceRef" required pattern="\s*[Ii][Nn]-[0-9A-Fa-f]{8}\s*" maxLength={20} /></label>
      {s.openQuestions.length > 0 && <label className="doc-field">Câu hỏi đang mở<select name="resolvesChangeId" defaultValue={s.openQuestions[0].id}>
        <option value="">Không trả lời câu hỏi nào</option>{s.openQuestions.map(q => <option key={q.id} value={q.id}>Trả lời câu hỏi theo {q.sourceRef}</option>)}
      </select></label>}
      <button type="submit" className="doc-action" disabled={busy}>Ghi thay đổi</button>
    </form>
  </section>)}</>;
}

export function Meetings({ initial }: { initial: SeriesView[] }) {
  const [series, setSeries] = useState(initial), [error, setError] = useState(''), [done, setDone] = useState(''), [busy, setBusy] = useState(false);
  async function record(body: Record<string, unknown>) {
    setBusy(true); setError(''); setDone('');
    try {
      await api('/api/v1/meetings/changes', body);
      setDone('Đã ghi thay đổi.');
    } catch (e) { setError((e as Error).message); }
    try { setSeries((await api<{ series: SeriesView[] }>('/api/v1/meetings')).series); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }
  return <main className="doc-page"><a className="doc-action doc-back" href="/">← Về không gian làm việc</a><h1>Lịch họp BoM</h1>
    <p className="muted">Ghi thay đổi giờ họp theo tin xác nhận đã được bot ghi nhận (mã IN-…). Bot không tự đọc tin để đổi giờ.</p>
    {error && <p className="notice error" role="alert">{error}</p>}
    {done && <p className="notice neutral" role="status">{done}</p>}
    <MeetingsView series={series} busy={busy} onCommand={record} />
  </main>;
}
