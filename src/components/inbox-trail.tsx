import type { IntakeTrail } from '../server/intake-trail';
import { formatTime } from './inbox-view';

// The trail of one message (GIAO VIỆC 5 B): each step from its own row, and who it waits for. Nothing here says work was made or given unless a step says so.
const MARK = { done: 'Xong', waiting: 'Đang chờ', skipped: 'Chưa tới' } as const;
export function TrailStrip({ trail }: { trail: IntakeTrail }) {
  return <section className="inbox-trail" aria-label="Các bước của tin này">
    <p className="inbox-trail-label"><strong>{trail.label}</strong>{trail.waitingOn ? <> · Đang chờ: <span className="inbox-wait">{trail.waitingOn}</span></> : null}</p>
    <ol className="inbox-plain inbox-steps">{trail.steps.map(s => <li key={s.key} data-step={s.key} data-state={s.state}>
      <span className="inbox-badge">{MARK[s.state]}</span> {s.label}{s.actor ? ' · ' + s.actor : ''}{s.at ? ' · ' + formatTime(s.at) : ''}</li>)}</ol>
  </section>;
}
