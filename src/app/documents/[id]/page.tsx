import { redirect } from 'next/navigation';
import { pagePrincipal } from '@/server/page-session';
import { database } from '@/server/db';
import { WorkService } from '@/server/service';
import { DocumentService } from '@/server/documents';
import { AppError } from '@/server/errors';
import { DocumentDetailView, DocumentDeniedBlock } from '@/components/document-detail';
export const dynamic = 'force-dynamic';
const NOT_VISIBLE = new Set(['SCOPE_DENIED', 'READ_ONLY']);
export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  let principal;
  try { principal = await pagePrincipal(); }
  catch { redirect('/login'); }
  const { id } = await params;
  const db = await database();
  let detail;
  try { detail = await new DocumentService(db).detail(principal, id); }
  catch (e) { if (e instanceof AppError && NOT_VISIBLE.has(e.code)) return <DocumentDeniedBlock />; throw e; }
  const projectId = detail.record.project_id;
  const projectLabel = (await new WorkService(db).workspace(principal)).projects.find(p => p.id === projectId)?.name ?? 'Dự án trong phạm vi';
  return <DocumentDetailView detail={JSON.parse(JSON.stringify(detail))} projectLabel={projectLabel} canOpen />;
}
