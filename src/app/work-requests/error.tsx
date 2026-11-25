'use client';
export default function WorkRequestsError({ reset }: { reset: () => void }) {
  return <main className="doc-page"><h1>Việc chờ BoM duyệt</h1><p className="notice error" role="alert">Chưa tải được danh sách. Thử lại sau.</p><button className="doc-action" onClick={reset}>Thử lại</button></main>;
}
