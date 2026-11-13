import type {Database,Queryable} from './db';
import {AppError} from './errors';

export type IntakePrincipal={id:string;tenantId:string;projectIds:string[]};

export async function intakeScoped<T>(db:Database,p:IntakePrincipal,fn:(tx:Queryable)=>Promise<T>):Promise<T> {
 if(!p?.id||!p.tenantId||!p.projectIds.length) throw new AppError('UNAUTHENTICATED','Cần phạm vi dự án.',401);
 return db.transaction(async tx=>{
  await tx.query('SET LOCAL ROLE libetech_intake');
  await tx.query("SELECT set_config('app.tenant_id', $1, true), set_config('app.project_ids', $2, true), set_config('app.intake_principal_id', $3, true)",[p.tenantId,p.projectIds.join(','),p.id]);
  return fn(tx);
 });
}
