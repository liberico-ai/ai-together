export default function Loading() {
  return <main className="doc-page" aria-busy="true"><h1>Chi tiết tài liệu</h1>
    <div className="doc-list doc-skeleton" aria-label="Đang tải chi tiết tài liệu">{[0, 1, 2].map(i => <div key={i} className="doc-skel-row" aria-hidden="true" />)}</div></main>;
}
