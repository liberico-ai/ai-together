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

/** Tenant-level scope for the pool (GIAO VIỆC 5 B): no project list. The intake role sees pool rows by tenant only; project rows stay hidden (empty app.project_ids). */
export async function intakePoolScoped<T>(db:Database,p:{id:string;tenantId:string},fn:(tx:Queryable)=>Promise<T>):Promise<T> {
 if(!p?.id||!p.tenantId) throw new AppError('UNAUTHENTICATED','Cần phạm vi tiếp nhận.',401);
 return db.transaction(async tx=>{
  await tx.query('SET LOCAL ROLE libetech_intake');
  await tx.query("SELECT set_config('app.tenant_id', $1, true), set_config('app.project_ids', '', true), set_config('app.intake_principal_id', $2, true)",[p.tenantId,p.id]);
  return fn(tx);
 });
}
