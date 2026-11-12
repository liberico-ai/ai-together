import {createHmac,timingSafeEqual} from 'node:crypto';
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
export type ChatScopes=Record<string,string[]>;
export const signingText=(timestamp:string,nonce:string,raw:string)=>`${timestamp}\n${nonce}\nPOST\n/api/bridge\n${raw}`;
export async function handleBridge(request:Request,db:Database,identity:IdentityService,key:string,chatScopes:ChatScopes) {
 invariant(key.length>=43,'BRIDGE_UNCONFIGURED','Cầu nối chưa được cấu hình.',503);
 const raw=await request.text(); invariant(Buffer.byteLength(raw)<=4096,'PAYLOAD_TOO_LARGE','Yêu cầu quá lớn.',413);
 const timestamp=request.headers.get('x-libetech-timestamp')??'',nonce=request.headers.get('x-libetech-nonce')??'',signature=request.headers.get('x-libetech-signature')??'';
 invariant(/^\d{13}$/.test(timestamp)&&Math.abs(Date.now()-Number(timestamp))<60000&&/^[A-Za-z0-9_-]{20,80}$/.test(nonce)&&/^[a-f0-9]{64}$/.test(signature),'BRIDGE_AUTH_DENIED','Không xác thực được cầu nối.',401);
 const expected=createHmac('sha256',key).update(signingText(timestamp,nonce,raw)).digest();
 invariant(timingSafeEqual(expected,Buffer.from(signature,'hex')),'BRIDGE_AUTH_DENIED','Không xác thực được cầu nối.',401);
 const data=schema.parse(JSON.parse(raw));
 const used=await identity.scope(async tx=>(await tx.query(`INSERT INTO identity.bridge_nonces(tenant_id,nonce,expires_at) VALUES($1,$2,now()+interval '2 minutes') ON CONFLICT(tenant_id,nonce) DO NOTHING RETURNING id`,[identity.tenantId,nonce])).rows.length);
 invariant(used,'BRIDGE_REPLAY','Yêu cầu cầu nối đã được sử dụng.',409);
 await identity.throttle('bridge-global',120,60);
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
