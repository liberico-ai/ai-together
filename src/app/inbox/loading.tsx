import { InboxBody } from '@/components/inbox';
export default function Loading() {
  return <main className="doc-page"><h1>Inbox dự án</h1>
    <InboxBody state="loading" items={[]} total={0} error={null} projectLabel="" canAct={false} onCommand={async () => {}} /></main>;
}
