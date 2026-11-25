import { redirect } from 'next/navigation';
import { pagePrincipal } from '@/server/page-session';
import { database } from '@/server/db';
import { WorkService } from '@/server/service';
import { WorkRequestService, publicPage } from '@/server/work-requests';
import { SheetImportService, workImportEnabled } from '@/server/sheet-import';
import { WorkRequests } from '@/components/work-requests';
export const dynamic = 'force-dynamic';

export default async function WorkRequestsPage() {
  let principal;
  try { principal = await pagePrincipal(); }
  catch { redirect('/login'); }
  const db = await database();
  const initial = publicPage(await new WorkRequestService(db).list(principal, {}), principal.id);
  // services and people of the projects this person holds a grant in: the seat picks a service, and fills the people the request left empty
  const workspace = await new WorkService(db).workspace(principal);
  const services = workspace.services.map(s => ({ id: s.id, project_id: s.project_id, name: s.name }));
  // what the sheet said about each imported request (the requester and the BoM seats of the project only)
  const imports = await new SheetImportService(db).annotations(principal, initial.items.filter(i => i.origin === 'import').map(i => i.id));
  return <WorkRequests initial={JSON.parse(JSON.stringify(initial))} services={services} people={JSON.parse(JSON.stringify(workspace.people))}
    imports={JSON.parse(JSON.stringify(imports))} importEnabled={workImportEnabled()} />;
}
