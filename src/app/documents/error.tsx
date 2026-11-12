'use client';
import { DocumentsBody } from '@/components/documents';
export default function DocumentsError({ reset }: { reset: () => void }) {
  return <main className="doc-page"><h1>Tài liệu dự án</h1>
    <DocumentsBody state="error" rows={[]} projectedAt={null} canRegister={false} error="Không tải được tài liệu. Dữ liệu đã lưu không bị thay đổi." projectLabel="" onRetry={reset} /></main>;
}
