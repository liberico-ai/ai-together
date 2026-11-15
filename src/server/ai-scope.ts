import type {Database,Queryable} from './db';
import {AppError} from './errors';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The AI pipeline's own identity: the id the service writes into ai_principal_id, never a value taken from a request. */
export type AiPrincipal={id:string;tenantId:string;projectIds:string[]};

/** One transaction under the database role of the AI pipeline (migration 021): it may write Z4 drafts and read its own projects, nothing else. */
export async function aiScoped<T>(db:Database,p:AiPrincipal,fn:(tx:Queryable)=>Promise<T>):Promise<T> {
 if(!p?.id||!p.tenantId||!Array.isArray(p.projectIds)||!p.projectIds.length) throw new AppError('UNAUTHENTICATED','Cần phạm vi dự án.',401);
 // a malformed id is the module's 404, never a raw 22P02 from the database
 if(![p.id,p.tenantId,...p.projectIds].every(x=>typeof x==='string'&&UUID.test(x.toLowerCase()))) throw new AppError('SCOPE_DENIED','Không tìm thấy mục trong phạm vi được cấp.',404);
 return db.transaction(async tx=>{
  await tx.query('SET LOCAL ROLE libetech_ai');
  await tx.query("SELECT set_config('app.tenant_id', $1, true), set_config('app.project_ids', $2, true), set_config('app.ai_principal_id', $3, true)",[p.tenantId,p.projectIds.join(','),p.id]);
  return fn(tx);
 });
}
