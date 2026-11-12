import { DocumentsBody } from '@/components/documents';
export default function Loading() {
  return <main className="doc-page"><h1>Tài liệu dự án</h1>
    <DocumentsBody state="loading" rows={[]} projectedAt={null} canRegister={false} error={null} projectLabel="" /></main>;
}
