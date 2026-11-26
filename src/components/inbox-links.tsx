'use client';
import type { PoolLinkView, RevokeReason } from '../server/intake-pool';
import { formatTime } from './inbox-view';

// The links of one message (OQ-61 B6): what was filed or linked, and for a link the viewer may take back, a reason list and «Gỡ liên kết».
// A revoked link stays listed with who took it back, when and why. Reasons are a fixed list: no free text is typed or kept.
export const REVOKE_LABELS: Record<RevokeReason, string> = { wrong_work: 'Sai việc', wrong_message: 'Sai tin', wrong_project: 'Sai dự án', mistake: 'Nối nhầm' };
export const revokeBody = (version: number, linkId: string, reasonCode: string): Record<string, unknown> => ({ kind: 'revoke_link', expectedVersion: version, linkId, reasonCode });

export function LinkList({ links, version, busy, onCommand }: { links: PoolLinkView[]; version: number; busy?: boolean; onCommand?: (cmd: Record<string, unknown>) => void }) {
  if (links.length === 0) return null;
  return <ul className="inbox-plain" aria-label="Yêu cầu và liên kết">{links.map(l => <li key={l.linkId} className="doc-wrap">
    {l.kind === 'request' ? 'Yêu cầu' + (l.title ? ': ' + l.title : '') : 'Liên kết việc ' + (l.workCode ?? '')} · {l.createdByName} · {formatTime(l.createdAt)}
    {l.revoked && <span className="doc-meta"> · Đã gỡ bởi {l.revoked.byName} · {formatTime(l.revoked.at)} · {REVOKE_LABELS[l.revoked.reasonCode]}</span>}
    {l.canRevoke && onCommand && <form className="inbox-actions" onSubmit={e => { e.preventDefault(); onCommand(revokeBody(version, l.linkId, String(new FormData(e.currentTarget).get('reasonCode') ?? ''))); }}>
      <label className="doc-field">Lý do gỡ<select name="reasonCode" defaultValue="wrong_work">{(Object.keys(REVOKE_LABELS) as RevokeReason[]).map(r => <option key={r} value={r}>{REVOKE_LABELS[r]}</option>)}</select></label>
      <button type="submit" className="doc-action inbox-secondary" disabled={busy}>Gỡ liên kết</button>
    </form>}
  </li>)}</ul>;
}
