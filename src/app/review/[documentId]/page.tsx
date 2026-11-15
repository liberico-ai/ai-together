import { redirect } from 'next/navigation';
import { pagePrincipal } from '@/server/page-session';
import { database } from '@/server/db';
import { projectRole } from '@/server/types';
import { WorkService } from '@/server/service';
import { ReviewService } from '@/server/document-review';
import { DependencyService } from '@/server/document-dependencies';
import { loadFlaggedLinks, detailFailure } from '@/server/review-page';
import { ReviewDetailScreen, ReviewDetailDenied, ReviewDetailNoRevision } from '@/components/review';
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
    // missing, out of scope, viewer and a malformed id look the same; a document without a revision has its own sentence
    const outcome = detailFailure(e);
    if (outcome === 'denied') return <ReviewDetailDenied />;
    if (outcome === 'no_revision') return <ReviewDetailNoRevision />;
    throw e;
  }
  const projectId = detail.item.projectId;
  // only a scope denial leaves the block absent; any other failure reaches error.tsx
  const links = await loadFlaggedLinks(() => new DependencyService(db).list(principal, { projectId, documentId: detail.item.documentId, needsReview: true }));
  const workspace = await new WorkService(db).workspace(principal);
  const people = workspace.people.filter(x => x.projectIds.includes(projectId) && x.role !== 'bot').map(x => ({ id: x.id, name: x.name, role: projectRole(x, projectId) as string }));
  return <ReviewDetailScreen detail={JSON.parse(JSON.stringify(detail))} affectedLinks={JSON.parse(JSON.stringify(links.items))} people={people} />;
}
