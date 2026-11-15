'use client';
import { ReviewQueueBody } from '@/components/review';
export default function ReviewError({ reset }: { reset: () => void }) {
  return <main className="doc-page"><h1>Review tài liệu</h1>
    <ReviewQueueBody state="error" items={[]} total={0} error={null} projectLabel="" onRetry={reset} /></main>;
}
