import { redirect } from 'next/navigation';
import { pagePrincipal } from '@/server/page-session';
import { database } from '@/server/db';
import { projectRole } from '@/server/types';
import { WorkService } from '@/server/service';
import { ReviewService } from '@/server/document-review';
import { DependencyService } from '@/server/document-dependencies';
import { AppError } from '@/server/errors';
import { ReviewDetailScreen, ReviewDetailDenied } from '@/components/review';
export const dynamic = 'force-dynamic';

export default async function ReviewDetailPage({ params }: { params: Promise<{ documentId: string }> }) {
  let principal;
  try { principal = await pagePrincipal(); }
  catch { redirect('/login'); }
  const { documentId } = await params;
  const db = await database();
  let detail;
  try { detail = await new ReviewService(db).detail(principal, documentId); }
  catch (e) {
    // missing, out of scope, viewer and a malformed id look the same
    if (e instanceof AppError && e.code === 'SCOPE_DENIED') return <ReviewDetailDenied />;
    throw e;
  }
  const projectId = detail.item.projectId;
  // a failure to read the dependency links does not break the page: the block is simply absent
  const links = await new DependencyService(db).list(principal, { projectId, documentId: detail.item.documentId, needsReview: true }).catch(() => ({ items: [], total: 0 }));
  const workspace = await new WorkService(db).workspace(principal);
  const people = workspace.people.filter(x => x.projectIds.includes(projectId) && x.role !== 'bot').map(x => ({ id: x.id, name: x.name, role: projectRole(x, projectId) as string }));
  return <ReviewDetailScreen detail={JSON.parse(JSON.stringify(detail))} affectedLinks={JSON.parse(JSON.stringify(links.items))} people={people} />;
}
