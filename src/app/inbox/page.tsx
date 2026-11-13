import { redirect } from 'next/navigation';
import { pagePrincipal } from '@/server/page-session';
import { database } from '@/server/db';
import { projectRole } from '@/server/types';
import { WorkService } from '@/server/service';
import { InboxService, readable } from '@/server/inbox';
import { AppError } from '@/server/errors';
import { Inbox } from '@/components/inbox';
export const dynamic = 'force-dynamic';

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ projectId?: string | string[] }> }) {
  let principal;
  try { principal = await pagePrincipal(); }
  catch { redirect('/login'); }
  const raw = (await searchParams).projectId;
  const projectId = typeof raw === 'string' && raw ? raw : null;
  // Same rule as the service (read roles only); the page asks the service's own check so the two cannot drift.
  const mayRead = (id: string) => { try { readable(principal, id); return true; } catch (e) { if (e instanceof AppError) return false; throw e; } };
  const denied = <Inbox key="denied" projects={[]} projectId={projectId} initial={null} sources={[]} failures={[]} denied canAct={false} />;
  if (projectId && !mayRead(projectId)) return denied;
  const db = await database();
  const projects = (await new WorkService(db).workspace(principal)).projects.filter(p => mayRead(p.id)).map(p => ({ id: p.id, name: p.name }));
  if (!projectId && projects.length === 1) redirect('/inbox?projectId=' + projects[0].id);
  if (!projectId) return <Inbox key="picker" projects={projects} projectId={null} initial={null} sources={[]} failures={[]} denied={false} canAct={false} />;
  const inbox = new InboxService(db);
  try {
    const [initial, sources, failures] = await Promise.all([inbox.list(principal, { projectId }), inbox.sources(principal, projectId), inbox.failures(principal, projectId)]);
    return <Inbox key={projectId} projects={projects} projectId={projectId} initial={JSON.parse(JSON.stringify(initial))} sources={sources} failures={failures} denied={false} canAct={projectRole(principal, projectId) === 'manager'} />;
  } catch (e) {
    if (e instanceof AppError && e.code === 'SCOPE_DENIED') return denied;
    throw e;
  }
}
