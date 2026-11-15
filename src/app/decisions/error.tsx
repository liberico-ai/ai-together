'use client';
import { DecisionsBody } from '@/components/decisions';
export default function DecisionsError({ reset }: { reset: () => void }) {
  return <main className="doc-page"><h1>Quyết định</h1>
    <DecisionsBody state="error" cards={[]} error={null} people={[]} onRetry={reset} /></main>;
}
