import { APP_VERSION } from './version';
import {z} from 'zod';
import {IdentityService} from './identity';
import {invariant,AppError} from './errors';
import {scoped,type Database} from './db';
import {AccountApprovalService,approvalChoice} from './account-approval';

const context=z.object({telegramId:z.string().regex(/^[1-9][0-9]{0,19}$/),chatId:z.string().regex(/^-?[1-9][0-9]{0,19}$/),chatType:z.enum(['private','dm','group','supergroup']),profile:z.literal('libetech'),messageId:z.string().regex(/^[1-9][0-9]*$/)}).strict();
const schema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('pair'),context,code:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict(),
 z.object({operation:z.literal('reconciliation'),context,code:z.string().regex(/^[A-Z0-9-]{3,40}$/),sourceSha:z.string().regex(/^[a-f0-9]{40}$/)}).strict(),
 z.object({operation:z.literal('account_approval_pending'),context}).strict(),
 z.object({operation:z.literal('account_approval_vote'),context,approvalId:z.uuid(),choice:approvalChoice}).strict(),
]);
export type {ChatScopes} from './bridge-config';
import type {ChatScopes} from './bridge-config';
import {signingText,verifySigned} from './bridge-auth';
export {signingText};
export async function handleBridge(request:Request,db:Database,identity:IdentityService,key:string,chatScopes:ChatScopes) {
 const raw=await verifySigned(request,{key,path:'/api/bridge',maxBytes:4096,identity,throttleBucket:'bridge-global',throttleLimit:120});
 const data=schema.parse(JSON.parse(raw));
 const c=data.context;
 if(data.operation==='pair') return identity.pair(data.code,c.telegramId,c.chatId,c.chatType);
 if(data.operation==='account_approval_pending') return new AccountApprovalService(identity)
  .pending(c.telegramId,c.chatId,c.chatType);
 if(data.operation==='account_approval_vote') return new AccountApprovalService(identity)
  .vote(c.telegramId,c.chatId,c.chatType,data.approvalId,data.choice);
 const p=await identity.telegramPrincipal(c.telegramId);
 const privateChat=['private','dm'].includes(c.chatType);
 invariant(privateChat?c.chatId===c.telegramId:c.chatId.startsWith('-'),'SCOPE_DENIED','Nguồn hội thoại không hợp lệ.',403);
 // This allowlist is operator configuration, never a client-provided lane/BU/project.
 const granted=privateChat?p.projectIds:(chatScopes[c.chatId]??[]);
 const projectIds=p.projectIds.filter(id=>granted.includes(id));
 invariant(projectIds.length,'SCOPE_DENIED','Không có quyền đọc dự án trong hội thoại này.',403);
 const result=await scoped(db,{...p,role:'bot',projectIds},async tx=>(await tx.query<{code:string;source_sha:string;source_id:string;source_type:string;ingested_at:string;quality_score:string;result:unknown}>(`SELECT code,source_sha,source_id,source_type,ingested_at,quality_score,result FROM analytics.reconciliations WHERE code=$1 AND source_sha=$2 ORDER BY ingested_at DESC LIMIT 1`,[data.code,data.sourceSha])).rows[0]);
 if(!result) throw new AppError('SCOPE_DENIED','Không tìm thấy hồ sơ đúng SHA trong phạm vi được cấp.',404);
 return {operation:'reconciliation',record:result,readOnly:true,acceptance:'not-inferred',identityBinding:'verified-telegram',version:APP_VERSION};
}
