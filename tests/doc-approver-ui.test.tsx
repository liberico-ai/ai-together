import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApprovalItem, type Pending } from '../src/components/approvals';
import { AccessActions, expandsAccess, Grants, readGrants, TeamAccounts } from '../src/components/team-accounts';
import { permissionLabel, PERMISSION_LABELS } from '../src/components/grant-labels';
import { TYPE_NAMES } from '../src/components/documents-view';
import { DOC_APPROVAL_TYPES, docApprovalCode } from '../src/server/access-grants';
import type { Project, ProjectGrant } from '../src/server/types';
import before from './golden/approvals-before-7b.json';

// Static markup only; every name and id below is synthetic. Task 7b: the account form shows and keeps the eight document-approval codes,
// a ballot card names the document types it adds, and nothing in the registration form can carry the right (OQ-31 b).
const projects: Project[] = [{ id: 'p-sales', name: 'Dự án Bán hàng', bu: 'A' }, { id: 'p-transport', name: 'Dự án Vận tải', bu: 'A' }];
const design = docApprovalCode('design'), plan = docApprovalCode('plan');
const noop = async () => {};
type Entry = [string, string];

/** What a browser would submit for the markup: a select sends its selected option, a checked checkbox sends its value. */
function submitted(html: string): FormData {
  const form = new FormData();
  const attr = (tag: string, name: string) => tag.match(new RegExp('\\s' + name + '="([^"]*)"'))?.[1];
  for (const select of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
    const name = attr(select[1], 'name')!;
    const options = [...select[2].matchAll(/<option\b([^>]*)>/g)].map(o => o[1]);
    const chosen = options.find(o => /\sselected(=|\s|$)/.test(' ' + o)) ?? options[0];
    form.append(name, attr(chosen, 'value') ?? '');
  }
  for (const input of html.matchAll(/<input\b([^>]*)\/?>/g)) {
    if (attr(input[1], 'type') !== 'checkbox' || !/\schecked(=|\s|\/|$)/.test(' ' + input[1])) continue;
    form.append(attr(input[1], 'name')!, attr(input[1], 'value')!);
  }
  return form;
}
const retick = (form: FormData, name: string, value: string, on: boolean): FormData => {
  const entries: Entry[] = [...form.entries()].filter((e): e is Entry => typeof e[1] === 'string' && !(e[0] === name && e[1] === value));
  if (on) entries.push([name, value]);
  const next = new FormData();
  for (const [k, v] of entries) next.append(k, v);
  return next;
};
const held = (permissions: string[]): ProjectGrant[] => [{ projectId: 'p-sales', role: 'engineer', reportPermissions: permissions as ProjectGrant['reportPermissions'] }];
const accountForm = (initial: ProjectGrant[]) => renderToStaticMarkup(<Grants projects={projects} initial={initial} withDocApproval />);
const sorted = (g: ProjectGrant[]) => g.map(x => ({ ...x, reportPermissions: [...x.reportPermissions].sort() }));

describe('document approval on the team screen', () => {
  it('the team form offers document approval per type only for existing accounts, never in the registration form', async () => {
    const html = accountForm([]);
    expect(html).toContain('Duyệt bản chuẩn theo loại tài liệu');
    for (const project of projects) {
      const boxes = [...html.matchAll(new RegExp('<input[^>]*type="checkbox"[^>]*name="' + project.id + '-report"[^>]*value="doc_approve:([a-z_]+)"', 'g'))].map(m => m[1]);
      expect(boxes, project.id).toEqual([...DOC_APPROVAL_TYPES]);
    }
    for (const type of DOC_APPROVAL_TYPES) expect(html).toContain('>' + TYPE_NAMES[type] + '</label>');
    // each nested group is named after its project, as text, so a screen reader can tell which project a box grants
    const legends = [...html.matchAll(/<legend>(Duyệt bản chuẩn theo loại tài liệu[^<]*)<\/legend>/g)].map(m => m[1]);
    expect(legends).toEqual(projects.map(p => 'Duyệt bản chuẩn theo loại tài liệu — ' + p.name));
    // the three old permissions are still there beside them
    for (const key of Object.keys(PERMISSION_LABELS)) expect(html).toContain('value="' + key + '"');
    // the plain Grants (the registration form, the proposal that has no account yet) has none of it
    const plain = renderToStaticMarkup(<Grants projects={projects} />);
    expect(plain).not.toContain('doc_approve:');
    expect(plain).not.toContain('Duyệt bản chuẩn');
    // the whole screen with a pending registration: its form offers no document approval
    const request = { id: 'r1', username: 'dang.ky', name: 'Người đăng ký', project_interest: 'Dự án Bán hàng', note: '', created_at: '2026-11-15T00:00:00Z',
      approval_id: null, approval_state: null, approval_agreed: 0, chairman_agreed: false, bom_agreed: 0, approval_grants: null };
    const screen = renderToStaticMarkup(<TeamAccounts initial={[]} requests={[request]} projects={projects} />);
    expect(screen).toContain('Trình duyệt');
    expect(screen).toContain('Phạm vi dự án');
    expect(screen).not.toContain('doc_approve:');
    expect(screen).not.toContain('Duyệt bản chuẩn');
    // and in the source only the existing-account form switches it on; no other form and no per-person control
    const source = await readFile('src/components/team-accounts.tsx', 'utf8');
    expect([...source.matchAll(/<Grants\b/g)].length).toBe(2); // the registration form and the account form
    expect([...source.matchAll(/<Grants\b[^>]*withDocApproval/g)].length).toBe(1);
    expect(source).toMatch(/<Grants projects=\{projects\} initial=\{user\.grants\} withDocApproval\/>/);
    expect(source).not.toContain('dangerouslySetInnerHTML');
  });

  it('ticking a document type is a widening and offers Trình phiếu đổi quyền; unticking offers Lưu quyền', () => {
    const none = held([]);
    const untouched = submitted(accountForm(none));
    expect(readGrants(untouched, projects)).toEqual(none);
    const ticked = retick(untouched, 'p-sales-report', design, true);
    const afterTick = readGrants(ticked, projects);
    expect(afterTick).toEqual(held([design]));
    expect(expandsAccess(none, afterTick)).toBe(true);
    const widen = renderToStaticMarkup(<AccessActions expands={expandsAccess(none, afterTick)} busy={false} />);
    expect(widen).toContain('Trình phiếu đổi quyền');
    expect(widen).toContain('value="propose_access_change"');
    // an account that holds the code: unticking that box alone is a reduction
    const have = held([design, plan]);
    const afterUntick = readGrants(retick(submitted(accountForm(have)), 'p-sales-report', design, false), projects);
    expect(afterUntick).toEqual(held([plan]));
    expect(expandsAccess(have, afterUntick)).toBe(false);
    const narrow = renderToStaticMarkup(<AccessActions expands={expandsAccess(have, afterUntick)} busy={false} />);
    expect(narrow).toContain('>Lưu quyền<');
    expect(narrow).not.toContain('Trình phiếu đổi quyền');
    // a box ticked on a project where no role is chosen is not a grant at all: readGrants skips that project
    const other = readGrants(retick(submitted(accountForm(have)), 'p-transport-report', design, true), projects);
    expect(other).toEqual(held([design, plan]));
  });

  it('codes held on two projects round-trip untouched, and a code ticked on a second project that has a role is a widening', () => {
    const both: ProjectGrant[] = [
      { projectId: 'p-sales', role: 'engineer', reportPermissions: [design] as ProjectGrant['reportPermissions'] },
      { projectId: 'p-transport', role: 'manager', reportPermissions: [plan, 'people_read'] as ProjectGrant['reportPermissions'] }];
    const form = submitted(accountForm(both));
    const same = readGrants(form, projects);
    expect(sorted(same)).toEqual(sorted(both));
    expect(expandsAccess(both, same)).toBe(false);
    // ticking another type on the second project keeps both sets and is a widening
    const added = readGrants(retick(form, 'p-transport-report', design, true), projects);
    expect(sorted(added)).toEqual(sorted([both[0], { ...both[1], reportPermissions: [plan, 'people_read', design] as ProjectGrant['reportPermissions'] }]));
    expect(expandsAccess(both, added)).toBe(true);
    // unticking on one project leaves the other untouched
    const dropped = readGrants(retick(form, 'p-sales-report', design, false), projects);
    expect(sorted(dropped)).toEqual(sorted([{ ...both[0], reportPermissions: [] }, both[1]]));
    expect(expandsAccess(both, dropped)).toBe(false);
  });

  it('saving an unrelated change keeps the document approval codes an account already holds', () => {
    const account = held(['people_read', design]);
    const html = accountForm(account);
    // the box for Thiết kế is drawn ticked, the one for Kế hoạch is not
    const box = (code: string) => html.match(new RegExp('<input[^>]*value="' + code + '"[^>]*/?>'))![0];
    expect(box(design)).toMatch(/\schecked(=|\s|\/)/);
    expect(box(plan)).not.toMatch(/\schecked(=|\s|\/)/);
    // read back untouched: both codes
    const form = submitted(html);
    const same = readGrants(form, projects);
    expect(sorted(same)).toEqual(sorted(account));
    expect(expandsAccess(account, same)).toBe(false);
    // change one report permission (add one): the document code stays, and that is the widening it is
    const added = readGrants(retick(form, 'p-sales-report', 'quality_review', true), projects);
    expect(added[0].reportPermissions).toEqual(expect.arrayContaining(['people_read', 'quality_review', design]));
    expect(expandsAccess(account, added)).toBe(true);
    // drop only a report permission: the document code stays, and it is not a widening
    const dropped = readGrants(retick(form, 'p-sales-report', 'people_read', false), projects);
    expect(dropped).toEqual(held([design]));
    expect(expandsAccess(account, dropped)).toBe(false);
    // change the role (down to viewer): codes stay, a reduction
    const html2 = renderToStaticMarkup(<Grants projects={projects} initial={account} withDocApproval />).replace('value="engineer" selected=""', 'value="engineer"').replace('<option value="viewer">', '<option value="viewer" selected="">');
    const viewerForm = readGrants(submitted(html2), projects);
    expect(viewerForm[0]).toMatchObject({ role: 'viewer' });
    expect(viewerForm[0].reportPermissions).toEqual(expect.arrayContaining(['people_read', design]));
    expect(expandsAccess(account, viewerForm)).toBe(false);
    // only an explicit untick removes the code
    expect(readGrants(retick(form, 'p-sales-report', design, false), projects)).toEqual(held(['people_read']));
  });
});

describe('document approval on the ballot card', () => {
  const base = { id: 'b1', name: 'Thành viên Thử', username: 'thu', reason: 'Cần mở rộng phạm vi', expires_at: '2026-11-20T00:00:00Z', project_interest: '' };
  const card = (item: Pending) => renderToStaticMarkup(<ApprovalItem busy={false} onVote={noop} item={item} />);

  it('an approval card names each document type under duyệt bản chuẩn, next to the current grants', () => {
    const html = card({ ...base, kind: 'access_change',
      previous_grant_details: [{ name: 'Dự án A', role: 'engineer', reportPermissions: ['people_read', design] }],
      grant_details: [{ name: 'Dự án A', role: 'engineer', reportPermissions: ['people_read', design, plan] },
        { name: 'Dự án B', role: 'engineer', reportPermissions: [docApprovalCode('guide')] }] });
    expect(html).toContain('Quyền hiện tại: Dự án A (Thực hiện, quyền báo cáo: Xem điểm nhân sự · duyệt bản chuẩn: Thiết kế)');
    expect(html).toContain('Quyền đề nghị: Dự án A (Thực hiện, quyền báo cáo: Xem điểm nhân sự · duyệt bản chuẩn: Thiết kế, Kế hoạch); Dự án B (Thực hiện, duyệt bản chuẩn: Hướng dẫn)');
    expect(html).not.toContain('doc_approve:');
    // order of the types is the fixed order, not the order sent
    const reversed = card({ ...base, kind: 'access_change', previous_grant_details: [], grant_details: [{ name: 'Dự án A', role: 'engineer', reportPermissions: [plan, design] }] });
    expect(reversed).toContain('(Thực hiện, duyệt bản chuẩn: Thiết kế, Kế hoạch)');
    // a code the screen does not know stays with the report permissions, shown as itself; a doc code of an unknown type likewise
    const odd = card({ ...base, kind: 'access_change', previous_grant_details: [], grant_details: [{ name: 'Dự án A', role: 'engineer', reportPermissions: ['doc_approve:zzz', 'report_admin', design] }] });
    expect(odd).toContain('(Thực hiện, quyền báo cáo: doc_approve:zzz, report_admin · duyệt bản chuẩn: Thiết kế)');
  });

  it('text from the ballot is rendered as text', () => {
    const html = card({ ...base, name: '<img src=x onerror=alert(1)>', kind: 'access_change', previous_grant_details: [],
      grant_details: [{ name: '<b>Dự án</b>', role: 'engineer', reportPermissions: ['<i>x</i>', design] }] });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<i>');
    expect(html).toContain('&lt;b&gt;Dự án&lt;/b&gt;');
  });

  it('a ballot without document approval renders exactly as before', () => {
    const items: Record<string, Pending> = {
      changeOld: { ...base, kind: 'access_change', previous_grant_details: [{ name: 'Dự án A', role: 'viewer', reportPermissions: [] }],
        grant_details: [{ name: 'Dự án A', role: 'engineer', reportPermissions: ['people_read', 'quality_review', 'report_approve'] }, { name: 'Dự án B', role: 'manager', reportPermissions: [] }] },
      changeNoPrev: { ...base, kind: 'access_change', previous_grant_details: [], grant_details: [{ name: 'Dự án B', role: 'manager', reportPermissions: [] }] },
      changeUnknownCode: { ...base, kind: 'access_change', previous_grant_details: null, grant_details: [{ name: 'Dự án A', role: 'engineer', reportPermissions: ['report_admin'] }] },
      changeEmpty: { ...base, kind: 'access_change', previous_grant_details: [{ name: 'Dự án A', role: 'viewer', reportPermissions: ['people_read'] }], grant_details: [] },
      registration: { ...base, kind: 'registration', project_interest: 'Dự án A', previous_grant_details: null, grant_details: [{ name: 'Dự án A', role: 'viewer', reportPermissions: ['people_read'] }] },
    };
    // golden/approvals-before-7b.json was rendered by the component as it was before this task
    expect(Object.keys(before).sort()).toEqual(Object.keys(items).sort());
    for (const [name, item] of Object.entries(items)) expect(card(item), name).toBe((before as Record<string, string>)[name]);
  });
});

describe('labels', () => {
  it('every doc_approve label comes from TYPE_NAMES and an unknown code is shown as itself', async () => {
    expect(DOC_APPROVAL_TYPES).toHaveLength(8);
    for (const type of DOC_APPROVAL_TYPES) expect(permissionLabel('doc_approve:' + type)).toBe('Duyệt bản chuẩn: ' + TYPE_NAMES[type]);
    expect(permissionLabel('doc_approve:zzz')).toBe('doc_approve:zzz');
    expect(permissionLabel('doc_approve:')).toBe('doc_approve:');
    expect(permissionLabel('Doc_Approve:design')).toBe('Doc_Approve:design');
    expect(permissionLabel('report_admin')).toBe('report_admin');
    for (const [key, label] of Object.entries(PERMISSION_LABELS)) expect(permissionLabel(key)).toBe(label);
    expect(permissionLabel('people_read')).toBe('Xem điểm nhân sự');
    expect(permissionLabel('quality_review')).toBe('Đánh giá phản hồi');
    expect(permissionLabel('report_approve')).toBe('Chốt kết quả');
    // the type names are not copied anywhere else
    for (const file of ['grant-labels.ts', 'approvals.tsx', 'team-accounts.tsx']) {
      const source = await readFile('src/components/' + file, 'utf8');
      for (const name of ['Thiết kế', 'Kế hoạch', 'Mục lục dự án']) expect(source, file).not.toContain(name);
    }
  });
});
