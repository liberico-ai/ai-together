import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { identityService,SESSION_COOKIE } from '@/server/identity';
import { database,scoped } from '@/server/db';
import { BomWorkspace } from '@/components/bom-workspace';
import { AppError } from '@/server/errors';

export const dynamic='force-dynamic';

export default async function BomPage() {
  try {
    const identity=identityService();
    const principal=await identity.session((await cookies()).get(SESSION_COOKIE)?.value);
    const works=await scoped(await database(),principal,async tx=>(await tx.query<{id:string;code:string;title:string}>(`
      SELECT w.id,w.code,w.title FROM work_items w JOIN bom_scopes b
        ON b.tenant_id=w.tenant_id AND b.project_id=w.project_id
      WHERE $1::uuid=ANY(b.seat_ids)
        AND EXISTS (SELECT 1 FROM bom_eligible_members(w.project_id,ARRAY[$1]::uuid[]) WHERE linked)
        AND (EXISTS(SELECT 1 FROM bom_sources s WHERE s.work_id=w.id)
          OR EXISTS(SELECT 1 FROM bom_proposals p WHERE p.work_id=w.id))
      ORDER BY w.code LIMIT 200`,[principal.id])).rows);
    const people=(await identity.directory(principal)).map(person=>({id:person.id,name:person.name}));
    return <BomWorkspace works={works} people={people} viewerId={principal.id}/>;
  } catch(error) {
    if(error instanceof AppError&&error.status===401) redirect('/login');
    return <main className="failure"><h1>Chưa mở được phiếu BoM</h1><a href="/">Về không gian làm việc</a></main>;
  }
}
