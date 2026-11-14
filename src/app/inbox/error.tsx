'use client';
import { InboxBody } from '@/components/inbox';
export default function InboxError({ reset }: { reset: () => void }) {
  return <main className="doc-page"><h1>Inbox dự án</h1>
    <InboxBody state="error" items={[]} total={0} error="Không tải được Inbox. Dữ liệu đã lưu không bị thay đổi." projectLabel="" canAct={false} onRetry={reset} /></main>;
}
