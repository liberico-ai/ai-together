import { redirect } from 'next/navigation';
import { pagePrincipal } from '@/server/page-session';
import { database } from '@/server/db';
import { PoolService } from '@/server/intake-pool';
import { WorkRequestService } from '@/server/work-requests';
import { PoolList } from '@/components/inbox-pool';
export const dynamic = 'force-dynamic';

// The pool of the shared group: Team Tech only. Anybody else gets an empty list from the service (the database returns no row); a bot reads nothing.
export default async function PoolPage() {
  let principal;
  try { principal = await pagePrincipal(); }
  catch { redirect('/login'); }
  if (principal.role === 'bot') redirect('/');
  const db = await database();
  const initial = await new PoolService(db).list(principal, {});
  const projects = initial.items.length ? await new WorkRequestService(db).catalog(principal) : [];
  return <PoolList initial={JSON.parse(JSON.stringify(initial))} projects={JSON.parse(JSON.stringify(projects))} />;
}
