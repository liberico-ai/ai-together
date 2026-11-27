'use client';
import { useRef, useState } from 'react';
import { api } from './api';
import type { ImportPreview, ImportReceipt, Group } from '@/server/sheet-import';

// the import calls give up after a minute with CLIENT_TIMEOUT rather than leaving the screen busy
const IMPORT_WAIT = { timeoutMs: 60_000 };

// «Nhập bảng việc»: choose the exported file → preview (nothing is written) → confirm the mapping → write. There is no path that writes without a preview.
// Text from the file is rendered as React text only. The note column of the sheet is never shown here.
export const SOURCE_STATUS_LABEL = 'Trạng thái theo bảng nguồn';
export const SOURCE_DUE_LABEL = 'Hạn theo bảng nguồn';
export const PM_STEPS = [
  'Mở bảng nguồn, chọn trang «Đầu việc Tech». Không sửa gì.',
  'Tệp → Tải xuống → «Giá trị được phân tách bằng dấu phẩy (.csv)». Google Sheets chỉ xuất trang đang mở, mã UTF-8.',
  'Không mở lại tệp bằng Excel rồi lưu (Excel có thể đổi mã ký tự và đổi dạng ngày).',
  'Ở đây: chọn tệp, dán liên kết của bảng, gõ tên trang, bấm «Xem trước».',
];
const verdictLabel = { valid: 'Hợp lệ', duplicate: 'Bỏ qua (trùng)', needs_reconciliation: 'Cần đối soát', imported: 'Đã nhập' } as const;

function toBase64(bytes: Uint8Array) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}
/** The name of the chosen file as the server stores it (OQ-62 câu 6): no path separator or control character, at most 255 UTF-16 units, whole characters only. */
export function bareFileName(name: string): string | undefined {
  let out = '';
  for (const ch of name.replace(/[\/\\\p{Cc}]/gu, '').trim()) { if (out.length + ch.length > 255) break; out += ch; }
  return out.trim() || undefined;
}
/** The body the preview and the write both send: the file, the source the importer names, and the name of the file when it has one. */
export function importEnvelope(name: string, bytes: Uint8Array, sourceUrl: string, sheet: string): { fileBase64: string; sourceUrl: string; sheet: string; fileName?: string } {
  const fileName = bareFileName(name);
  return { fileBase64: toBase64(bytes), sourceUrl, sheet, ...(fileName ? { fileName } : {}) };
}
function Groups({ title, groups }: { title: string; groups: Group[] }) {
  return <section><h3>{title}</h3>
    <div className="table-scroll"><table><thead><tr><th>Nhóm</th><th>Số dòng</th><th>Hợp lệ</th><th>Cần đối soát</th><th>Trùng</th></tr></thead>
      <tbody>{groups.map(g => <tr key={g.label}><td dir="auto">{g.label}</td><td>{g.rows}</td><td>{g.valid}</td><td>{g.needsReconciliation}</td><td>{g.duplicate}</td></tr>)}</tbody></table></div>
  </section>;
}
function Counts({ counts }: { counts: ImportPreview['counts'] }) {
  return <>
    <Groups title="Theo nhãn BU của bảng nguồn — chưa phải miền báo cáo" groups={counts.byBuLabel} />
    <Groups title="Theo miền báo cáo đã xác nhận của dự án đích" groups={counts.byReportingDomain} />
    <p className="muted">Mỗi nhóm đếm riêng; không có số tổng gộp các nhóm.</p>
  </>;
}

/** A BU label that cannot be mapped: blank, or longer than the 100 characters the server accepts. */
export const labelProblem = (label: string) => label.trim() === '' ? 'Nhãn BU trống' : [...label].length > 100 ? 'Nhãn BU dài quá 100 ký tự' : '';
/** The projects an owner text may be confirmed for: those the labels of its own rows are mapped to. */
export function ownerProjects(preview: ImportPreview, projects: Record<string, string>, text: string): string[] {
  return [...new Set(preview.rows.filter(r => r.owner === text).map(r => projects[r.buLabel]).filter(Boolean))];
}

export function WorkImport() {
  const [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [body, setBody] = useState<ReturnType<typeof importEnvelope> | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null), [receipt, setReceipt] = useState<ImportReceipt | null>(null);
  const [projects, setProjects] = useState<Record<string, string>>({}), [owners, setOwners] = useState<Record<string, string>>({});
  const requestKey = useRef('');
  const pairs = (pre: ImportPreview, prj: Record<string, string>, own: Record<string, string>) => ({
    projects: Object.entries(prj).filter(([label, id]) => id && !labelProblem(label)).map(([buLabel, projectId]) => ({ buLabel, projectId })),
    owners: Object.entries(own).filter(([, userId]) => userId).flatMap(([key, userId]) => { const [projectId, text] = key.split('\u0000'); return ownerProjects(pre, prj, text).includes(projectId) ? [{ text, projectId, userId }] : []; }),
  });

  async function runPreview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!file) return;
    setBusy(true); setError(''); setReceipt(null);
    const f = new FormData(e.currentTarget), get = (k: string) => String(f.get(k) ?? '');
    try {
      const next = importEnvelope(file.name, new Uint8Array(await file.arrayBuffer()), get('sourceUrl'), get('sheet'));
      const pre = await api<ImportPreview>('/api/v1/work-imports/preview', next, undefined, IMPORT_WAIT);   // the first preview uses the defaults
      setBody(next); setPreview(pre); requestKey.current = crypto.randomUUID();
      setProjects(Object.fromEntries(pre.buLabels.filter(b => b.defaultProjectId && !labelProblem(b.label)).map(b => [b.label, b.defaultProjectId as string]))); setOwners({});
    } catch (err) { setError((err as Error).message); setPreview(null); } finally { setBusy(false); }
  }
  /** A change of the mapping runs the preview again with it: counts, flags, the IBS HI decision and CODE_EXISTS are then those the commit will give. */
  async function remap(nextProjects: Record<string, string>, nextOwners: Record<string, string>) {
    if (!preview || !body) return;
    setProjects(nextProjects); setOwners(nextOwners); setBusy(true); setError('');
    try {
      const pre = await api<ImportPreview>('/api/v1/work-imports/preview', { ...body, ...pairs(preview, nextProjects, nextOwners) }, undefined, IMPORT_WAIT);
      setPreview(pre); requestKey.current = crypto.randomUUID();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function commit() {
    if (!preview || !body) return;
    setBusy(true); setError('');
    try { setReceipt(await api<ImportReceipt>('/api/v1/work-imports', { ...body, previewDigest: preview.previewDigest, requestKey: requestKey.current, ...pairs(preview, projects, owners) }, undefined, IMPORT_WAIT)); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return <main className="doc-page"><h1>Nhập bảng việc</h1>
    <p className="muted">Mỗi dòng hợp lệ trở thành một yêu cầu tạo việc ở trạng thái chờ; một ghế BoM của dự án, không phải người nhập, duyệt hoặc từ chối. Nhập không đổi bảng nguồn và không đổi người thực hiện của việc đã có.</p>
    <ol>{PM_STEPS.map(s => <li key={s}>{s}</li>)}</ol>
    {error && <p className="notice error" role="alert">{error}</p>}
    <form className="doc-card" onSubmit={runPreview}>
      <label className="doc-field">Tệp CSV<input type="file" accept=".csv,text/csv" required onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <label className="doc-field">Liên kết bảng nguồn<input name="sourceUrl" type="url" required placeholder="https://docs.google.com/spreadsheets/d/…" maxLength={1000} /></label>
      <label className="doc-field">Tên trang<input name="sheet" required defaultValue="Đầu việc Tech" maxLength={100} /></label>
      <p className="muted">Danh tính nguồn là lời khai của người nhập: tệp CSV không mang liên kết hay mốc sửa của bảng. Chỉ nhận trang «Đầu việc Tech».</p>
      <button className="doc-action" disabled={busy || !file}>{busy ? 'Đang đọc…' : 'Xem trước'}</button>
    </form>
    {preview && !receipt && <section className="doc-card work-import-result">
      <h2>Xem trước — chưa ghi gì</h2>
      <p className="muted">Mã băm tệp <code>{preview.fileHash.slice(0, 16)}</code> · bảng <code dir="auto">{preview.source.sourceId}</code> · trang <span dir="auto">{preview.source.sheet}</span></p>
      <Counts counts={preview.counts} />
      <h3>Nhãn BU → dự án</h3>
      {preview.buLabels.map(b => labelProblem(b.label)
        ? <p key={b.label || '(trống)'} className="muted"><span dir="auto">{b.label || '(trống)'}</span> ({b.rows} dòng): {labelProblem(b.label)} — các dòng này cần đối soát.</p>
        : <label key={b.label} className="doc-field"><span dir="auto">{b.label}</span> ({b.rows} dòng)
          <select value={projects[b.label] ?? ''} disabled={busy} onChange={e => remap({ ...projects, [b.label]: e.target.value }, owners)}>
            <option value="">Chưa chọn — các dòng này cần đối soát</option>{preview.catalog.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>)}
      {preview.owners.length > 0 && <><h3>Người phụ trách → tài khoản</h3>
        <p className="muted">Chỉ hiện người bạn đã thấy là người thực hiện của dự án đích của nhãn BU các dòng đó. Không chọn thì để trống và gắn cờ; chữ của ô luôn được giữ.</p>
        {preview.owners.map(o => { const targets = ownerProjects(preview, projects, o.text); return <div key={o.text} className="doc-field"><span dir="auto">{o.text}</span> ({o.rows} dòng)
          {o.candidates.flatMap(c => c.projectIds.filter(pid => targets.includes(pid)).map(pid => ({ c, pid }))).length === 0
            ? <span className="muted"> — không có ứng viên trong dự án đích của bạn</span>
            : o.candidates.flatMap(c => c.projectIds.filter(pid => targets.includes(pid)).map(pid => { const key = pid + '\u0000' + o.text; return <span key={key}><label><input type="radio" name={'o' + key} checked={owners[key] === c.userId} disabled={busy} onChange={() => remap(projects, { ...owners, [key]: c.userId })} /> {c.name} · {preview.catalog.find(x => x.id === pid)?.name ?? 'dự án'}</label>
              {owners[key] === c.userId && <button type="button" className="doc-action" disabled={busy} onClick={() => remap(projects, { ...owners, [key]: '' })}>Bỏ chọn</button>}</span>; }))}</div>; })}</>}
      <h3>Từng dòng</h3>
      <div className="table-scroll"><table><thead><tr><th>Dòng</th><th>STT</th><th>BU</th><th>Đầu việc</th><th>Mã việc</th><th>Người phụ trách</th><th>{SOURCE_STATUS_LABEL}</th><th>{SOURCE_DUE_LABEL}</th><th>Kết quả</th><th>Mã lý do và cờ</th></tr></thead>
        <tbody>{preview.rows.map(r => <tr key={r.row}><td>{r.row}</td><td dir="auto">{r.stt}</td><td dir="auto">{r.buLabel}</td><td dir="auto">{r.title}</td><td>{r.code ?? ''}</td><td dir="auto">{r.owner}</td><td dir="auto">{r.status}</td><td dir="auto">{r.due}</td>
          <td>{verdictLabel[r.result]}</td><td>{[...r.reasons, ...r.flags].join(', ')}</td></tr>)}</tbody></table></div>
      <button className="doc-action" onClick={commit} disabled={busy}>{busy ? 'Đang xử lý…' : 'Ghi vào hàng chờ BoM duyệt'}</button>
    </section>}
    {receipt && <section className="doc-card work-import-result">
      <h2>Biên nhận lô nhập</h2>
      <p className="muted">Mã lô <code>{receipt.id}</code>{receipt.replayed ? ' · lệnh đã được ghi trước đó, đây là biên nhận cũ' : ''} · Mã băm tệp <code>{receipt.fileHash.slice(0, 16)}</code></p>
      <Counts counts={receipt.counts} />
      <div className="table-scroll"><table><thead><tr><th>Dòng</th><th>STT</th><th>Kết quả</th><th>Mã lý do và cờ</th></tr></thead>
        <tbody>{receipt.results.map(r => <tr key={r.row}><td>{r.row}</td><td dir="auto">{r.stt}</td><td>{verdictLabel[r.result]}</td><td>{[...r.reasons, ...r.flags].join(', ')}</td></tr>)}</tbody></table></div>
      <p><a href="/work-requests">Xem «Việc chờ BoM duyệt»</a></p>
    </section>}
  </main>;
}
