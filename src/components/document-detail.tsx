import type { DocumentDetail, DocumentRevision } from '@/server/types';
import { SourceAvailability, SourceOpener } from './documents';
import { TYPE_NAMES, DETAIL_DENIED_COPY, SOURCE_GONE_COPY, approvedLabel, hashLabel, formatTime, eventKindLabel } from './documents-view';

export function DocumentDeniedBlock() {
  return <main className="doc-page"><a className="doc-action doc-back" href="/documents">← Về danh sách tài liệu</a>
    <div className="doc-state doc-denied" role="status"><h2>{DETAIL_DENIED_COPY}</h2>
      <p>Tài liệu không tồn tại hoặc tài khoản chưa được cấp quyền xem.</p></div></main>;
}

function Revision({ rev }: { rev: DocumentRevision }) {
  const refs = rev.source_refs;
  return <li className="doc-rev-item">
    <h3 className="doc-rev-head">r{rev.revision_no} <small className="doc-meta">{formatTime(rev.created_at)}</small></h3>
    <p>{rev.changes.summary}</p>
    <div className="doc-cols">
      <div><strong>Đã có:</strong>{rev.changes.present.length ? <ul>{rev.changes.present.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="doc-meta">Chưa có</p>}</div>
      <div><strong>Còn thiếu:</strong>{rev.changes.missing.length ? <ul>{rev.changes.missing.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="doc-meta">Chưa có</p>}</div>
    </div>
    <p className="doc-meta doc-wrap">Bản nguồn: {rev.source_revision ?? 'Chưa có'}</p>
    {refs.length > 0 && <ul className="doc-refs">{refs.map((r, i) => <li key={i} className="doc-wrap">{r.label}: {r.value}</li>)}</ul>}
    <p className="doc-hash doc-wrap">{hashLabel(rev.source_hash ? rev.hash_verification : null)}{rev.source_hash ? ' · ' + rev.source_hash : ''}</p>
  </li>;
}

export function DocumentDetailView({ detail, projectLabel, canOpen }: { detail: DocumentDetail; projectLabel: string; canOpen: boolean }) {
  const { record, events } = detail;
  const revisions = [...detail.revisions].sort((a, b) => b.revision_no - a.revision_no);
  const latest = revisions.find(r => r.id === record.latest_revision_id) ?? null;
  const approved = revisions.find(r => r.id === record.approved_revision_id) ?? null;
  return <main className="doc-page">
    <a className="doc-action doc-back" href={'/documents?projectId=' + record.project_id}>← Về danh sách tài liệu</a>
    <header className="doc-detail-head">
      <h1 className="doc-title">{record.title}</h1>
      <p className="doc-meta"><span className="doc-ref">{record.ref_code || 'Chưa có mã'}</span> · {TYPE_NAMES[record.doc_type] ?? record.doc_type} · {projectLabel}</p>
      <p className="doc-meta">Chủ nội dung: {record.owner_label.trim() || 'Chưa có'}</p>
    </header>
    <section className="doc-pointers" aria-label="Bản đang soạn và bản chuẩn">
      <div className="doc-pointer"><span className="doc-rev">Bản đang soạn: {approvedLabel(latest?.revision_no ?? null)}</span></div>
      <div className="doc-pointer"><span className="doc-tag-neutral">Bản chuẩn: {approvedLabel(approved?.revision_no ?? null)}</span></div>
    </section>
    <p className="doc-meta">Nguồn chưa đóng băng (SOURCE_NOT_FROZEN) · Phân loại: Chưa phân loại</p>
    <section className="doc-section" aria-label="Thiếu thông tin"><h2>Thông tin còn thiếu</h2>
      {record.metadata.missingFields.length ? <ul>{record.metadata.missingFields.map(f => <li key={f}>{f}: Chưa có</li>)}</ul> : <p className="doc-meta">Không có trường thiếu được ghi nhận.</p>}</section>
    <section className="doc-section" aria-label="Dòng nguồn"><h2>Dòng nguồn liên kết</h2>
      {record.source_links.length ? <ul>{record.source_links.map((l, i) => <li key={i} className="doc-wrap">{l.value} · {l.label}
        {l.present === false && <p className="doc-problem">{SOURCE_GONE_COPY}</p>}</li>)}</ul> : <p className="doc-meta">Chưa có</p>}</section>
    <section className="doc-section" aria-label="Nguồn"><h2>Nguồn</h2>
      <SourceAvailability state={record.source_state} lastSuccessAt={record.source_checked_at} />
      <div className="doc-actions"><SourceOpener documentId={record.id} sourceState={record.source_state} canOpen={canOpen} /></div></section>
    <section className="doc-section" aria-label="Các bản"><h2>Các bản (mới nhất trước)</h2>
      {revisions.length ? <ol className="doc-revlist">{revisions.map(r => <Revision key={r.id} rev={r} />)}</ol> : <p className="doc-meta">Chưa có bản nào.</p>}</section>
    <section className="doc-section" aria-label="Sự kiện"><h2>Sự kiện</h2>
      {events.length ? <ul>{events.map(e => <li key={e.id}>{eventKindLabel(e.kind)} · {formatTime(e.created_at)}</li>)}</ul> : <p className="doc-meta">Chưa có</p>}</section>
  </main>;
}
