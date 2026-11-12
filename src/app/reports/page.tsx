import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { identityService,SESSION_COOKIE } from '@/server/identity';
import { database,scoped } from '@/server/db';
import { Reports } from '@/components/reports';
import type { Project } from '@/server/types';
import { AppError } from '@/server/errors';
export const dynamic='force-dynamic';

export default async function ReportsPage() {
  let principal;
  try {principal=await identityService().session((await cookies()).get(SESSION_COOKIE)?.value);}
  catch(error){
    if(error instanceof AppError&&error.status===401) redirect('/login');
    return <main className="failure"><h1>Chưa mở được dashboard</h1><a href="/">Về trang chính</a></main>;
  }
  const projects=await scoped(await database(),principal,async tx=>(await tx.query<Project>('SELECT id,name,bu FROM projects ORDER BY name')).rows);
  return <Reports projects={projects} viewerId={principal.id}/>;
}
