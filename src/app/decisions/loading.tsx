import { DecisionsBody } from '@/components/decisions';
export default function Loading() {
  return <main className="doc-page"><h1>Quyết định</h1>
    <DecisionsBody state="loading" cards={[]} error={null} people={[]} /></main>;
}
