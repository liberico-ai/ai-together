import { notFound, redirect } from 'next/navigation';
import { workImportEnabled } from '@/server/sheet-import';
import { pagePrincipal } from '@/server/page-session';
import { WorkImport } from '@/components/work-import';
export const dynamic = 'force-dynamic';

// «Nhập bảng việc»: the screen holds no data of its own. Every refusal (who may import) comes back from the service when the file is previewed.
export default async function WorkImportPage() {
  // off unless the operator turned it on (LIBETECH_WORK_IMPORT=1): the page then answers as an unknown path
  if (!workImportEnabled()) notFound();
  try { await pagePrincipal(); }
  catch { redirect('/login'); }
  return <WorkImport />;
}
