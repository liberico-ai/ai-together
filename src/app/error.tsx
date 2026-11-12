'use client';
export default function ErrorPage({reset}:{reset:()=>void}) { return <main className="failure"><h1>Chưa tải được không gian làm việc</h1><p>Dữ liệu đã lưu không bị thay đổi. Tải lại để đối chiếu trạng thái mới nhất.</p><button onClick={reset}>Tải lại</button></main>; }
