import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PoolItemView } from '../src/components/inbox-pool';
import { CandidateWork } from '../src/components/inbox-work';
import type { PoolCard, PoolLinkView } from '../src/server/intake-pool';
import type { CandidateCard } from '../src/server/inbox';

// OQ-61 B6: «Gỡ liên kết» only where the viewer may; a revoked link says who, when and why. Synthetic ids and text.
const noop = () => {};
const link = (over: Record<string, unknown> = {}): PoolLinkView => ({ linkId: '55555555-5555-4555-8555-555555555555', kind: 'work', requestId: null, requestState: null, workCode: 'LT-THU-001', title: null,
  createdAt: '2026-11-26T01:00:00.000Z', createdByName: 'Người tạo thử', canRevoke: true, revoked: null, ...over } as PoolLinkView);
const revoked = { byName: 'Người gỡ thử', at: '2026-11-26T02:00:00.000Z', reasonCode: 'wrong_work' };
const poolCard = (links: PoolLinkView[]): PoolCard => ({ itemId: '33333333-3333-4333-8333-333333333333', ref: 'IN-33333333', state: 'assigned', classification: 'request', dismissCode: null,
  projectId: '22222222-2222-4222-8222-222222222222', projectLabel: 'Dự án Thử', receivedAt: '2026-11-26T00:00:00.000Z', editedAt: null, revisionCount: 0, senderName: 'Tech thử', forwarded: false,
  attachment: null, receipt: { state: 'delivered', deliveredAt: null }, version: 3, trail: { label: 'Đã liên kết việc LT-THU-001', waitingOn: '', steps: [] }, links });
const candidate = (links: PoolLinkView[]) => ({ candidateId: '11111111-1111-4111-8111-111111111111', projectId: '22222222-2222-4222-8222-222222222222', state: 'confirmed', version: 4,
  contentMode: 'pointer_only', excerpt: null, links } as unknown as CandidateCard);

describe('revoking a link on the page', () => {
  for (const [where, html] of [
    ['pool card', (links: PoolLinkView[]) => renderToStaticMarkup(<PoolItemView card={poolCard(links)} projects={[]} onCommand={noop} />)],
    ['candidate card', (links: PoolLinkView[]) => renderToStaticMarkup(<CandidateWork card={candidate(links)} work={{ works: [], people: [], onCommand: async () => {} }} />)],
  ] as const) {
    it(`${where}: the button and the reason list show only for a link the viewer may revoke`, () => {
      const may = html([link()]);
      expect(may).toContain('Gỡ liên kết');
      for (const label of ['Sai việc', 'Sai tin', 'Sai dự án', 'Nối nhầm']) expect(may).toContain(label);
      expect(html([link({ canRevoke: false })])).not.toContain('Gỡ liên kết');
    });
    it(`${where}: a revoked link says who revoked it and why, with no button`, () => {
      const gone = html([link({ canRevoke: false, revoked })]);
      expect(gone).toContain('Đã gỡ bởi Người gỡ thử');
      expect(gone).toContain('Sai việc');
      expect(gone).not.toContain('Gỡ liên kết');
    });
  }
});
