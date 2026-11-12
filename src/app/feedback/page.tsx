import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { identityService,SESSION_COOKIE } from '@/server/identity';
import { database } from '@/server/db';
import { FeedbackService } from '@/server/feedback';
import { WorkService } from '@/server/service';
import { Feedback } from '@/components/feedback';
export const dynamic='force-dynamic';
export default async function FeedbackPage() {
 let principal;
 try {principal=await identityService().session((await cookies()).get(SESSION_COOKIE)?.value);}
 catch {redirect('/login');}
 const db=await database();
 const [rows,workspace]=await Promise.all([new FeedbackService(db).list(principal),new WorkService(db).workspace(principal)]);
 return <Feedback initial={rows as never} projects={workspace.projects}
  managerProjects={principal.grants?.filter(g=>g.role==='manager').map(g=>g.projectId)??[]}/>;
}
