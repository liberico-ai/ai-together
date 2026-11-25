import { redirect } from 'next/navigation';
import { pagePrincipal } from '@/server/page-session';
import { database } from '@/server/db';
import { identityService } from '@/server/identity';
import { demoProfiles } from '@/server/identities';
import { projectRole } from '@/server/types';
import { WorkRequestService, publicPage } from '@/server/work-requests';
import { SheetImportService, workImportEnabled } from '@/server/sheet-import';
import { WorkRequests } from '@/components/work-requests';
export const dynamic = 'force-dynamic';

export default async function WorkRequestsPage() {
  let principal;
  try { principal = await pagePrincipal(); }
  catch { redirect('/login'); }
  const db = await database();
  const requests = new WorkRequestService(db);
  const initial = publicPage(await requests.list(principal, {}), principal.id);
  // the projects where this person decides (every project for a BoM Tech), their services and seats: the decider picks a service and the people
  const ctx = await requests.context(principal);
  const demo = process.env.LIBETECH_DEMO === '1';
  const people = demo
    ? Object.values(demoProfiles).filter(x => x.tenantId === principal.tenantId && x.projectIds.some(id => ctx.projectIds.includes(id)))
    : await identityService().directory({ ...principal, projectIds: ctx.projectIds });
  // the Team Tech members may perform work in every project (M2): listed for the people who file or decide requests only
  const decides = principal.techMember || principal.techBom || principal.projectIds.some(id => projectRole(principal, id) === 'manager') || Object.values(ctx.seats).some(s => s.includes(principal.id));
  const performers = decides && !demo ? await identityService().performers(principal) : [];
  // what the sheet said about each imported request (the requester and the deciders of the project only)
  const imports = await new SheetImportService(db).annotations(principal, initial.items.filter(i => i.origin === 'import').map(i => i.id));
  return <WorkRequests initial={JSON.parse(JSON.stringify(initial))} services={ctx.services} people={JSON.parse(JSON.stringify(people))} performers={performers} seats={ctx.seats}
    imports={JSON.parse(JSON.stringify(imports))} importEnabled={workImportEnabled()} />;
}
