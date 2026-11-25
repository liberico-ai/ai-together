import { redirect } from 'next/navigation';
import { pagePrincipal } from '@/server/page-session';
import { database } from '@/server/db';
import { WorkService } from '@/server/service';
import { WorkRequestService, publicPage } from '@/server/work-requests';
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
  return <WorkRequests initial={JSON.parse(JSON.stringify(initial))} services={services} people={JSON.parse(JSON.stringify(workspace.people))} />;
}
