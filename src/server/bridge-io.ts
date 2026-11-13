import type {Database,Queryable} from './db';
import type {IdentityService} from './identity';
import type {BridgeConfig} from './bridge-config';
import {verifySigned} from './bridge-auth';
import {AppError,invariant} from './errors';

export type IntakePrincipal={id:string;tenantId:string;projectIds:string[]};
export type IoDeps={intakeDb:Database;identity:IdentityService;config:BridgeConfig;tenantId:string};
export const IO_PATHS=['/api/bridge/intake/events','/api/bridge/outbox/pull','/api/bridge/outbox/receipts'] as const;
const MAX_BYTES:Record<(typeof IO_PATHS)[number],number>={'/api/bridge/intake/events':16384,'/api/bridge/outbox/pull':1024,'/api/bridge/outbox/receipts':4096};

export async function handleBridgeIo(request:Request,parts:string[],deps:IoDeps):Promise<unknown> {
 const path='/api/bridge/'+parts.join('/');
 const route=IO_PATHS.find(p=>p===path);
 if(!route) throw new AppError('NOT_FOUND','Không tìm thấy.',404);
 invariant(deps.config.intake,'INTAKE_UNCONFIGURED','Tiếp nhận chưa được cấu hình.',503);
 await verifySigned(request,{key:deps.config.intake.key,path:route,maxBytes:MAX_BYTES[route],identity:deps.identity,throttleBucket:'bridge-intake',throttleLimit:600});
 // Tasks 4 and 6 replace this with the real handlers.
 throw new AppError('NOT_IMPLEMENTED','Chưa triển khai.',501);
}

export async function intakeScoped<T>(db:Database,p:IntakePrincipal,fn:(tx:Queryable)=>Promise<T>):Promise<T> {
 if(!p?.id||!p.tenantId||!p.projectIds.length) throw new AppError('UNAUTHENTICATED','Cần phạm vi dự án.',401);
 return db.transaction(async tx=>{
  await tx.query('SET LOCAL ROLE libetech_intake');
  await tx.query("SELECT set_config('app.tenant_id', $1, true), set_config('app.project_ids', $2, true), set_config('app.intake_principal_id', $3, true)",[p.tenantId,p.projectIds.join(','),p.id]);
  return fn(tx);
 });
}
