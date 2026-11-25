import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { canCreateWork, CreateWorkButton } from '../src/components/create-work-button';
import { ApproveFields, BulkDecide, bulkBody, candidates, decisionBody, nameOf, performerCandidates, waitingCopy, NO_SEAT_COPY, OWN_COPY, WAIT_COPY, UNASSIGNED, WorkRequests, type RequestCard } from '../src/components/work-requests';
import type { Principal } from '../src/server/types';

// Every id and name below is synthetic.
const A = '11000000-0000-4000-8000-0000000000a1', B = '11000000-0000-4000-8000-0000000000b2';
const person = (n: number, name: string, role: Principal['role'], projects: string[] = [A]): Principal => ({ id: `14000000-0000-4000-8000-${String(n).padStart(12, '0')}`, tenantId: '10000000-0000-4000-8000-000000000001', name, role, projectIds: projects });
const manager = person(1, 'Điều phối thử', 'manager', [A]);
const viewerOnly = person(2, 'Người xem thử', 'viewer', [A]);
const mixed: Principal = { ...person(3, 'Vai lẫn thử', 'viewer', [A, B]), grants: [{ projectId: A, role: 'manager', reportPermissions: [] }, { projectId: B, role: 'viewer', reportPermissions: [] }] };
const techOnly: Principal = { ...person(4, 'Thành viên Tech thử', 'viewer', [B]), techMember: true };
const engineer = person(5, 'Kỹ sư thử', 'engineer'), technical = person(6, 'Kỹ thuật thử', 'technical'), business = person(7, 'Nghiệp vụ thử', 'business');

describe('the create button (E-TEST-04: it was hidden by a wrong predicate once)', () => {
  it('is offered to a manager of one project even when the same person only views another', () => {
    expect(canCreateWork(mixed)).toBe(true);
    expect(renderToStaticMarkup(<CreateWorkButton principal={mixed} onClick={() => {}} />)).toContain('Tạo công việc');
  });
  it('is offered to a Team Tech member who holds no manager grant', () => {
    expect(canCreateWork(techOnly)).toBe(true);
    expect(renderToStaticMarkup(<CreateWorkButton principal={techOnly} onClick={() => {}} />)).toContain('Tạo công việc');
  });
  it('is hidden from a viewer who is not on the roster, and from a bot', () => {
    expect(canCreateWork(viewerOnly)).toBe(false);
    expect(canCreateWork({ ...manager, role: 'bot' })).toBe(false);
    expect(renderToStaticMarkup(<CreateWorkButton principal={viewerOnly} onClick={() => {}} />)).toBe('');
  });
  it('is offered to a plain manager', () => { expect(canCreateWork(manager)).toBe(true); });
});

const card = (over: Partial<RequestCard> = {}): RequestCard => ({ id: 'c0000000-0000-4000-8000-000000000001', project_id: A, requester_id: techOnly.id, requester_name: techOnly.name, origin: 'form', source_ref: null,
  code: null, title: 'Việc thử để duyệt', priority: 'normal', due_at: null, criteria: '', spec_url: null, assignee_id: null, technical_id: null, business_id: null, state: 'pending',
  decider_name: null, decided_at: null, decision_note: null, work_id: null, version: 1, created_at: '2026-11-25T01:00:00.000Z', updated_at: '2026-11-25T01:00:00.000Z',
  project_name: 'Dự án thử', can_decide: true, seat_open: true, work_code: null, ...over });
const people = [engineer, technical, business, manager];

describe('the approver sees what they approve', () => {
  const html = (c: RequestCard) => renderToStaticMarkup(<WorkRequests initial={{ items: [c], total: 1 }} services={[]} people={people} />);
  it('names the proposed people, or «Chưa giao», the due time in Vietnam time and the spec as a link', () => {
    const out = html(card({ assignee_id: engineer.id, due_at: '2026-12-01T16:30:00.000Z', spec_url: 'https://example.com/spec/1' }));
    expect(out).toContain('Kỹ sư thử');
    expect(out).toContain(UNASSIGNED);
    expect(out).toContain('23:30');
    expect(out).toContain('href="https://example.com/spec/1"');
    expect(out).toContain('rel="noopener noreferrer"');
  });
  it('shows «Chưa đặt» when there is no due time', () => { expect(html(card())).toContain('Chưa đặt'); });
  it('tells a requester without a grant that the request waits for a seat, a project without seats that nobody can approve, a requester with a grant who decides', () => {
    expect(html(card({ can_decide: false, seat_open: null }))).toContain(WAIT_COPY);
    expect(html(card({ can_decide: false, seat_open: null }))).not.toContain(OWN_COPY);
    expect(html(card({ can_decide: false, seat_open: false }))).toContain(NO_SEAT_COPY);
    expect(html(card({ can_decide: false, seat_open: true }))).toContain(OWN_COPY);
    expect(waitingCopy({ seat_open: null }, false)).toBe(WAIT_COPY);
  });
  it('a person the directory does not list is a person, never an id', () => { expect(nameOf(people, 'f0000000-0000-4000-8000-000000000009')).toBe('Người được giao'); });
});

describe('approval fields', () => {
  const out = (c: RequestCard) => renderToStaticMarkup(<ApproveFields item={c} services={[{ id: 's1', project_id: A, name: 'Hệ thống thử' }]} people={[...people, person(8, 'Người dự án khác', 'engineer', [B])]} />);
  it('renders a select for each empty slot, filtered by the role in the project, with «Chưa giao» as the empty option', () => {
    const html = out(card());
    for (const name of ['assigneeId', 'technicalId', 'businessId']) expect(html).toContain(`name="${name}"`);
    expect(html).toContain('Kỹ sư thử');
    expect(html).not.toContain('Người dự án khác');
    expect(html).toMatch(new RegExp(`<option value=""[^>]*>${UNASSIGNED}</option>`));
    expect(candidates(people, A, 'technical').map(x => x.name)).toEqual(['Kỹ thuật thử']);
  });
  it('0.9.2 (M3): renders a select for a slot the requester filled too, with the proposed person chosen and «Giữ người đã đề xuất» as the empty option', () => {
    const html = out(card({ assignee_id: engineer.id }));
    expect(html).toContain('name="assigneeId"');
    expect(html).toContain('đã đề xuất, có thể đổi');
    expect(html).toMatch(new RegExp(`<option value="${engineer.id}" selected=""`));
    expect(html).toContain('Giữ người đã đề xuất');
    expect(html).toContain('name="technicalId"');
  });
  it('sends the person chosen for every slot (a change of a proposed person included), null for «keep» and for a rejection', () => {
    const get = (k: string) => ({ serviceId: 's1', code: '', note: 'Đủ căn cứ để duyệt.', assigneeId: engineer.id, technicalId: technical.id, businessId: '' } as Record<string, string>)[k] ?? '';
    expect(decisionBody(card(), 'approve', get)).toMatchObject({ decision: 'approve', serviceId: 's1', code: null, assigneeId: engineer.id, technicalId: technical.id, businessId: null });
    expect(decisionBody(card({ assignee_id: business.id }), 'approve', get)).toMatchObject({ assigneeId: engineer.id, technicalId: technical.id });
    expect(decisionBody(card(), 'reject', get)).toMatchObject({ decision: 'reject', serviceId: null, assigneeId: null, technicalId: null, businessId: null });
  });
  it('0.9.2 (M1, M2): the performer list holds the engineers of the project, every Team Tech member and the BoM seats of the project, each once', () => {
    const tech = { id: 'f0000000-0000-4000-8000-0000000000aa', name: 'Tech không thuộc dự án thử' };
    const list = performerCandidates([...people, person(8, 'Người dự án khác', 'engineer', [B])], [tech, { id: engineer.id, name: engineer.name }], [manager.id], A);
    expect(list.map(x => x.name)).toEqual(['Kỹ sư thử', 'Tech không thuộc dự án thử', 'Điều phối thử']);
    const html = renderToStaticMarkup(<ApproveFields item={card()} services={[{ id: 's1', project_id: A, name: 'Hệ thống thử' }]} people={people} performers={[tech]} seats={{ [A]: [manager.id] }} />);
    expect(html).toContain('Tech không thuộc dự án thử');
  });
});

describe('0.9.2 (M7): many requests in one approval', () => {
  it('offers the pending requests the reader may decide, and a button for each import batch among them', () => {
    const imports = { [card().id]: { sourceStatus: '', dueRaw: '', sourceRef: 'x', sourceId: 'x', sheet: 'x', stt: '1', buLabel: 'LBRC', ownerRaw: '', flags: [], batchId: 'b0000000-0000-4000-8000-000000000001' } };
    const html = renderToStaticMarkup(<BulkDecide items={[card(), card({ id: 'c0000000-0000-4000-8000-000000000002', can_decide: false, title: 'Việc không được duyệt' })]} services={[]} imports={imports} onDone={async () => {}} />);
    expect(html).toContain('Duyệt nhiều yêu cầu');
    expect(html).toContain('Việc thử để duyệt');
    expect(html).not.toContain('Việc không được duyệt');
    expect(html).toContain('Duyệt cả lô nhập (1 yêu cầu)');
    expect(renderToStaticMarkup(<BulkDecide items={[card({ can_decide: false })]} services={[]} imports={{}} onDone={async () => {}} />)).toBe('');
  });
  it('sends the chosen requests or one batch, the note, and a service only for the projects that were given one', () => {
    expect(bulkBody({ requestIds: ['a', 'b'] }, 'Đủ căn cứ để duyệt.', { [A]: 's1', [B]: '' })).toEqual({ requestIds: ['a', 'b'], note: 'Đủ căn cứ để duyệt.', services: [{ projectId: A, serviceId: 's1' }] });
    expect(bulkBody({ batchId: 'b1' }, 'Đủ căn cứ để duyệt.', {})).toEqual({ batchId: 'b1', note: 'Đủ căn cứ để duyệt.', services: [] });
  });
});
