import {createHmac,randomBytes} from 'node:crypto';
import {createHash,randomUUID} from 'node:crypto';
import {ids} from '../src/server/identities';
import {sameBuProject} from './slice1-fixtures';

import type {BridgeConfig} from '../src/server/bridge-config';
import type {IntakeEventInput} from '../src/server/types';
export type EventOverride=Partial<Omit<IntakeEventInput,'context'>>&{context?:Partial<IntakeEventInput['context']>};

export const chatSales='-1000000000001';
export const chatTransport='-1000000000002';
export const chatMulti='-1000000000003';
export const chatUnknown='-1000000000009';
export const chatNotIntake='-1000000000004';
export const botKey:string=randomBytes(48).toString('base64url');
export const intakeKey:string=randomBytes(48).toString('base64url');
export const intakePrincipalId='22000000-0000-4000-8000-000000000001';

export const bridgeConfig:BridgeConfig={
  key:botKey,
  chatScopes:{[chatSales]:[ids.sales],[chatTransport]:[ids.transport],[chatMulti]:[ids.sales,sameBuProject],[chatNotIntake]:[ids.sales]},
  intake:{key:intakeKey,principalId:intakePrincipalId,chats:[chatSales,chatTransport,chatMulti]},
};

const BASE='http://127.0.0.1:3148';
export function signedRequest(path:string,body:unknown,opts:{key?:string;timestamp?:string;nonce?:string;signPath?:string}={}):Request{
  const raw=typeof body==='string'?body:JSON.stringify(body);
  const timestamp=opts.timestamp??String(Date.now());
  const nonce=opts.nonce??randomBytes(24).toString('base64url');
  const signature=createHmac('sha256',opts.key??intakeKey).update(`${timestamp}\n${nonce}\nPOST\n${opts.signPath??path}\n${raw}`).digest('hex');
  return new Request(BASE+path,{method:'POST',body:raw,headers:{'content-type':'application/json','x-libetech-timestamp':timestamp,'x-libetech-nonce':nonce,'x-libetech-signature':signature}});
}

let seq=0;
export function messageEvent(over:EventOverride={}):IntakeEventInput{
  seq+=1;
  const {context,...rest}=over;
  const text=rest.text??`Tin mẫu số ${seq}`;
  return {
    context:{telegramId:'900000001',chatId:chatSales,chatType:'supergroup',profile:'libetech',messageId:String(seq),...context},
    observedAt:new Date(1760000000000+seq*1000).toISOString(),addressed:true,spooled:false,forwarded:false,
    text,textTruncated:false,contentHash:createHash('sha256').update(text).digest('hex'),traceId:randomUUID(),
    ...rest,
  };
}

/** Task 7/8 assertion shared: no slice-2 table may hold a ticket status/state column (AI OS keeps only an external reference). */
export async function ticketStateColumns(query:(sql:string)=>Promise<{column_name:string}[]>):Promise<string[]>{
  return (await query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public'
    AND table_name IN ('source_events','source_event_revisions','intake_attachments','intake_candidates','intake_events','outbox_messages','delivery_receipts','outbox_state_events')
    AND (column_name LIKE '%ticket_status%' OR column_name LIKE '%ticket_state%')`)).map(r=>r.column_name);
}
