import { ReviewQueueBody } from '@/components/review';
export default function Loading() {
  return <main className="doc-page"><h1>Review tài liệu</h1>
    <ReviewQueueBody state="loading" items={[]} total={0} error={null} projectLabel="" /></main>;
}
