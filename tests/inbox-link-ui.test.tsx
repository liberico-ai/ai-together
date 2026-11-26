import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntakeCard } from '../src/components/inbox';
import { CandidateWork, fileRequestBody, linkWorkBody, pickableWorks, workCommands, requestFormFromData, WorkRequestForm, WorkPicker, type WorkOption } from '../src/components/inbox-work';
import type { CandidateCard } from '../src/server/inbox';

// GIAO VIỆC 5 B: the two actions of a confirmed candidate, «Lập yêu cầu việc» and «Nối với việc có sẵn». Every id and text below is synthetic.
const pid = '22222222-2222-4222-8222-222222222222', other = '33333333-3333-4333-8333-333333333333';
const card = (over: Partial<CandidateCard> = {}): CandidateCard => ({ candidateId: '11111111-1111-4111-8111-111111111111', ref: 'IN-11111111', projectId: pid, projectLabel: 'Dự án Thử',
  sourceRef: 'telegram:-10012345:42', receivedAt: '2026-11-25T01:00:00.000Z', classification: 'request', state: 'confirmed', missingFields: [], duplicateCandidates: [], contentMode: 'pointer_only',
  excerpt: null, forwarded: false, attachments: [], ticketRef: null, version: 2,
  status: { receivedAt: '2026-11-25T01:00:00.000Z', persistedAt: '2026-11-25T01:00:01.000Z', projectedAt: null, deliveredAt: null, acknowledgedAt: null, outboxState: null },
  trail: { label: 'Đã nhận — chưa thấy yêu cầu hay việc nào trong phạm vi của bạn', waitingOn: 'điều phối dự án', steps: [] }, links: [], ...over });
const works: WorkOption[] = [
  { id: 'a0000000-0000-4000-8000-000000000001', projectId: pid, code: 'LT-THU-001', title: 'Việc của dự án này' },
  { id: 'b0000000-0000-4000-8000-000000000002', projectId: other, code: 'LT-KHAC-002', title: 'Việc của dự án khác' },
];
const people = [{ id: 'c0000000-0000-4000-8000-000000000003', name: 'Người thực hiện thử', role: 'engineer' as const }];
const noop = async () => {};
const render = (c: CandidateCard, withWork = true) => renderToStaticMarkup(<IntakeCard card={c} canAct={false} onCommand={noop} work={withWork ? { works, people, onCommand: noop } : undefined} />);

describe('which actions a card offers', () => {
  it('both actions only on a confirmed card, and only when the page hands over the work context', () => {
    expect(workCommands(card())).toEqual(['file_request', 'link_work']);
    for (const state of ['new', 'needs_info', 'duplicate', 'dismissed'] as const) expect(workCommands(card({ state, classification: null })), state).toEqual([]);
    const shown = render(card());
    expect(shown).toContain('Lập yêu cầu việc');
    expect(shown).toContain('Nối với việc có sẵn');
    for (const state of ['new', 'dismissed'] as const) {
      const hidden = render(card({ state, classification: null }));
      expect(hidden).not.toContain('Lập yêu cầu việc');
      expect(hidden).not.toContain('Nối với việc có sẵn');
    }
    expect(render(card(), false)).not.toContain('Lập yêu cầu việc');
  });
  it('the card is read-only for the existing manager actions even when the work actions show (the server decides who may file or link)', () => {
    const html = render(card());
    expect(html).toContain('Lập yêu cầu việc');
    expect(html).toContain('Chỉ điều phối dự án được thao tác');
  });
});

describe('the request form', () => {
  const form = { title: '  Việc cần làm từ tin này  ', priority: 'high', dueAt: '2026-12-01', criteria: 'Tiêu chí thử', specUrl: 'https://example.com/spec', assigneeId: people[0].id, technicalId: '', businessId: '' };
  it('title is empty unless the reader already sees the text on the card; the project is not a field', () => {
    expect(requestFormFromData(card({ contentMode: 'pointer_only' })).title).toBe('');
    expect(requestFormFromData(card({ contentMode: 'hidden' as never, excerpt: 'Chữ không được hiện' })).title).toBe('');
    expect(requestFormFromData(card({ contentMode: 'excerpt', excerpt: 'Cổng thanh toán lỗi từ 9 giờ' })).title).toBe('Cổng thanh toán lỗi từ 9 giờ');
    const html = renderToStaticMarkup(<WorkRequestForm card={card()} people={people} busy={false} error="" onSubmit={noop} />);
    expect(html).not.toMatch(/name="projectId"|name="tenantId"|name="requesterId"|name="origin"/);
    expect(html).toContain('Người thực hiện thử');
  });
  it('the body carries the card version and the filer\'s own words, and no tenant, requester, origin or project', () => {
    const body = fileRequestBody(card(), form, 'e0000000-0000-4000-8000-000000000004');
    expect(body).toEqual({ kind: 'file_request', expectedVersion: 2, requestKey: 'e0000000-0000-4000-8000-000000000004', code: null, title: 'Việc cần làm từ tin này', priority: 'high',
      dueAt: new Date('2026-12-01T00:00:00.000Z').toISOString(), criteria: 'Tiêu chí thử', specUrl: 'https://example.com/spec', assigneeId: people[0].id, technicalId: null, businessId: null });
    for (const key of ['tenantId', 'requesterId', 'requesterName', 'origin', 'projectId', 'state', 'sourceRef', 'actorId']) expect(Object.keys(body), key).not.toContain(key);
    expect(fileRequestBody(card(), { ...form, dueAt: '', specUrl: '' }, 'e0000000-0000-4000-8000-000000000004')).toMatchObject({ dueAt: null, specUrl: null });
  });
});

describe('the work picker', () => {
  it('lists only the work of the candidate project, with code and title, and sends the existing link_work command', () => {
    expect(pickableWorks(card(), works).map(w => w.code)).toEqual(['LT-THU-001']);
    const html = renderToStaticMarkup(<WorkPicker card={card()} works={works} busy={false} error="" onSubmit={noop} />);
    expect(html).toContain('LT-THU-001');
    expect(html).toContain('Việc của dự án này');
    expect(html).not.toContain('LT-KHAC-002');
    expect(html).not.toContain('Việc của dự án khác');
    expect(linkWorkBody(card(), works[0].id)).toEqual({ kind: 'link_work', expectedVersion: 2, workId: works[0].id });
    expect(Object.keys(linkWorkBody(card(), works[0].id))).not.toContain('projectId');
  });
  it('a project without work says so instead of an empty list', () => {
    const html = renderToStaticMarkup(<WorkPicker card={card()} works={[works[1]]} busy={false} error="" onSubmit={noop} />);
    expect(html).toContain('Dự án chưa có việc nào bạn đọc được');
  });
});

describe('the actions component', () => {
  it('renders both buttons for a confirmed card and nothing for an open one', () => {
    expect(renderToStaticMarkup(<CandidateWork card={card()} work={{ works, people, onCommand: noop }} />)).toContain('Nối với việc có sẵn');
    expect(renderToStaticMarkup(<CandidateWork card={card({ state: 'new', classification: null })} work={{ works, people, onCommand: noop }} />)).toBe('');
  });
});
