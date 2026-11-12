'use client';
export default function DocumentDetailError({ reset }: { reset: () => void }) {
  return <main className="doc-page"><h1>Chi tiết tài liệu</h1>
    <div className="doc-state doc-error" role="alert"><h2>Chưa tải được tài liệu</h2>
      <p>Không tải được tài liệu. Dữ liệu đã lưu không bị thay đổi.</p><button type="button" className="doc-action" onClick={reset}>Thử lại</button></div></main>;
}
