import { redirect } from 'next/navigation';
import { pagePrincipal } from '@/server/page-session';
import { database } from '@/server/db';
import { projectRole } from '@/server/types';
import { WorkService } from '@/server/service';
import { ReviewService, reader } from '@/server/document-review';
import { DelegationService } from '@/server/review-delegations';
import { AppError } from '@/server/errors';
import { ReviewQueue } from '@/components/review';
export const dynamic = 'force-dynamic';

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ projectId?: string | string[] }> }) {
  let principal;
  try { principal = await pagePrincipal(); }
  catch { redirect('/login'); }
  const raw = (await searchParams).projectId;
  const projectId = typeof raw === 'string' && raw ? raw : null;
  // The same reading rule as the service, asked of the service's own function so the page and the API cannot drift.
  const mayRead = (id: string) => reader(principal, id);
  const denied = <ReviewQueue key="denied" projects={[]} projectId={projectId} initial={null} denied delegations={null} people={[]} viewerId="" />;
  if (projectId && !mayRead(projectId)) return denied;
  const db = await database();
  const workspace = await new WorkService(db).workspace(principal);
  const projects = workspace.projects.filter(p => mayRead(p.id)).map(p => ({ id: p.id, name: p.name }));
  if (!projectId && projects.length === 1) redirect('/review?projectId=' + projects[0].id);
  if (!projectId) return <ReviewQueue key="picker" projects={projects} projectId={null} initial={null} denied={false} delegations={null} people={[]} viewerId={principal.id} />;
  try {
    const initial = await new ReviewService(db).queue(principal, { projectId });
    // Only the members of this project, and only id, name and the role they hold here: nothing else of a directory entry reaches the browser.
    const people = workspace.people.filter(x => x.projectIds.includes(projectId) && x.role !== 'bot').map(x => ({ id: x.id, name: x.name, role: projectRole(x, projectId) as string }));
    let delegations = null;
    try { delegations = await new DelegationService(db).list(principal, { projectId }); }
    catch (e) { if (!(e instanceof AppError && e.code === 'SCOPE_DENIED')) throw e; }
    return <ReviewQueue key={projectId} projects={projects} projectId={projectId} initial={JSON.parse(JSON.stringify(initial))} denied={false}
      delegations={delegations && JSON.parse(JSON.stringify(delegations))} people={people} viewerId={principal.id} />;
  } catch (e) {
    if (e instanceof AppError && e.code === 'SCOPE_DENIED') return denied;
    throw e;
  }
}
