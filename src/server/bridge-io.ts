import type {Database,Queryable} from './db';
import type {IdentityService} from './identity';
import type {BridgeConfig} from './bridge-config';
import {verifySigned} from './bridge-auth';
import {AppError,invariant} from './errors';
import {IntakeService,type EnqueueReceipt} from './intake';
import {OutboxService} from './outbox';

export {intakeScoped,type IntakePrincipal} from './intake-scope';
export type IoDeps={intakeDb:Database;identity:IdentityService;config:BridgeConfig;tenantId:string;enqueueReceipt?:EnqueueReceipt};
export const IO_PATHS=['/api/bridge/intake/events','/api/bridge/outbox/pull','/api/bridge/outbox/receipts'] as const;
const MAX_BYTES:Record<(typeof IO_PATHS)[number],number>={'/api/bridge/intake/events':16384,'/api/bridge/outbox/pull':1024,'/api/bridge/outbox/receipts':4096};

export async function handleBridgeIo(request:Request,parts:string[],deps:IoDeps):Promise<unknown> {
 const path='/api/bridge/'+parts.join('/');
 const route=IO_PATHS.find(p=>p===path);
 if(!route) throw new AppError('NOT_FOUND','Không tìm thấy.',404);
 invariant(deps.config.intake,'INTAKE_UNCONFIGURED','Tiếp nhận chưa được cấu hình.',503);
 const raw=await verifySigned(request,{key:deps.config.intake.key,path:route,maxBytes:MAX_BYTES[route],identity:deps.identity,throttleBucket:'bridge-intake',throttleLimit:600});
 if(route==='/api/bridge/intake/events') {
  const i=deps.config.intake;
  return new IntakeService(deps.intakeDb,deps.tenantId,i.principalId,deps.config.chatScopes,i,deps.enqueueReceipt).ingest(JSON.parse(raw));
 }
 // Pull scope is the union of the projects of the configured intake chats; empty fails closed in intakeScoped.
 const i=deps.config.intake;
 const projectIds=[...new Set(i.chats.flatMap(c=>deps.config.chatScopes[c]??[]))];
 const outbox=new OutboxService(deps.intakeDb,deps.identity,{id:i.principalId,tenantId:deps.tenantId,projectIds});
 return route==='/api/bridge/outbox/pull'?outbox.pull(JSON.parse(raw)):outbox.report(JSON.parse(raw));
}
