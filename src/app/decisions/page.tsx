import { redirect } from 'next/navigation';
import { pagePrincipal } from '@/server/page-session';
import { database } from '@/server/db';
import { WorkService } from '@/server/service';
import { DecisionService } from '@/server/decisions';
import { reader } from '@/server/document-review';
import { AppError } from '@/server/errors';
import { Decisions } from '@/components/decisions';
export const dynamic = 'force-dynamic';

export default async function DecisionsPage({ searchParams }: { searchParams: Promise<{ projectId?: string | string[] }> }) {
  let principal;
  try { principal = await pagePrincipal(); }
  catch { redirect('/login'); }
  const raw = (await searchParams).projectId;
  const projectId = typeof raw === 'string' && raw ? raw : null;
  // The same reading rule as the review service, asked of the service's own function so the page and the API cannot drift.
  const mayRead = (id: string) => reader(principal, id);
  const denied = <Decisions key="denied" projects={[]} projectId={projectId} initial={null} denied people={[]} />;
  if (projectId && !mayRead(projectId)) return denied;
  const db = await database();
  const workspace = await new WorkService(db).workspace(principal);
  const projects = workspace.projects.filter(p => mayRead(p.id)).map(p => ({ id: p.id, name: p.name }));
  if (!projectId && projects.length === 1) redirect('/decisions?projectId=' + projects[0].id);
  if (!projectId) return <Decisions key="picker" projects={projects} projectId={null} initial={null} denied={false} people={[]} />;
  try {
    const initial = await new DecisionService(db).list(principal, { projectId });
    // Only the members of this project, and only id and name: nothing else of a directory entry reaches the browser.
    const people = workspace.people.filter(x => x.projectIds.includes(projectId) && x.role !== 'bot').map(x => ({ id: x.id, name: x.name }));
    return <Decisions key={projectId} projects={projects} projectId={projectId} initial={JSON.parse(JSON.stringify(initial))} denied={false} people={people} />;
  } catch (e) {
    if (e instanceof AppError && e.code === 'SCOPE_DENIED') return denied;
    throw e;
  }
}
