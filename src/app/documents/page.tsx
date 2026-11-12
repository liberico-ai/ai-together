import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { identityService, SESSION_COOKIE } from '@/server/identity';
import { database } from '@/server/db';
import { WorkService } from '@/server/service';
import { findDocuments } from '@/server/document-index';
import { templateManifest } from '@/server/document-templates';
import { Documents } from '@/components/documents';
export const dynamic = 'force-dynamic';
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ projectId?: string | string[] }> }) {
  let principal;
  try { principal = await identityService().session((await cookies()).get(SESSION_COOKIE)?.value); }
  catch { redirect('/login'); }
  const raw = (await searchParams).projectId;
  const projectId = typeof raw === 'string' && raw ? raw : null;
  const canRegister = !['viewer', 'bot'].includes(principal.role);
  const templates = templateManifest.map(t => ({ code: t.code, title: t.title }));
  if (projectId && !principal.projectIds.includes(projectId))
    return <Documents projects={[]} projectId={projectId} initial={null} denied canRegister={false} templates={[]} />;
  const db = await database();
  const projects = (await new WorkService(db).workspace(principal)).projects.filter(p => principal.projectIds.includes(p.id)).map(p => ({ id: p.id, name: p.name }));
  if (!projectId && projects.length === 1) redirect('/documents?projectId=' + projects[0].id);
  const initial = projectId ? await findDocuments(db, principal, { projectId }) : null;
  return <Documents projects={projects} projectId={projectId} initial={initial} denied={false} canRegister={canRegister} templates={templates} />;
}
