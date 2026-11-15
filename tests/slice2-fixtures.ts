import {createHmac,randomBytes} from 'node:crypto';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {ids} from '../src/server/identities';
import {sameBuProject} from './slice1-fixtures';

import type {BridgeConfig} from '../src/server/bridge-config';
import type {Database,Queryable} from '../src/server/db';
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

/**
 * Test clock for outbox rows: moves lease_expires_at or next_attempt_at of rows that keep their state into the past, as if time passed.
 * The guard refuses that same-state change for every role (Codex P1), so the UPDATE runs in one operator transaction with triggers
 * skipped (session_replication_role = replica, superuser only); CHECK constraints still apply. Test fixtures only, never app code.
 */
export async function outboxClock(operator:Database,sql:string,params:unknown[]=[]):Promise<void>{
  if(!/^UPDATE outbox_messages SET (lease_expires_at|next_attempt_at)=now\(\)-interval '[0-9]+ (minute|hour)'( WHERE [a-z_]+=\$1)?$/.test(sql))
    throw new Error('outboxClock only moves lease_expires_at or next_attempt_at into the past');
  await operator.transaction(async tx=>{
    await tx.query("SET LOCAL session_replication_role = 'replica'");
    await tx.query(sql,params);
  });
}

/** Body of the `-- guard:<name> begin/end` block of a migration file, ready to run as a statement. */
export const guardBlock=async(file:string,name:string)=>{
  const src=await readFile(path.join(process.cwd(),'migrations',file),'utf8');
  const m=new RegExp(`-- guard:${name} begin\\n([\\s\\S]*?)\\n-- guard:${name} end`).exec(src);
  if(!m) throw new Error(`no guard ${name} in ${file}`);
  return m[1];
};
export type Probe=(sql:string,params?:unknown[])=>Promise<string|null>;
/** Runs fn in one operational transaction that is always rolled back; probe returns null when a statement succeeds, else its error message. */
export async function rolledBack(operator:Database,fn:(tx:Queryable,probe:Probe)=>Promise<void>):Promise<void>{
  const done=new Error('rolled back');
  await operator.transaction(async tx=>{
    let n=0;
    // a savepoint keeps the outer transaction usable
    const probe:Probe=async(sql,params=[])=>{
      const sp='probe_'+(++n);
      await tx.query('SAVEPOINT '+sp);
      try {await tx.query(sql,params);await tx.query('RELEASE SAVEPOINT '+sp);return null;}
      catch(e){await tx.query('ROLLBACK TO SAVEPOINT '+sp);return (e as Error).message;}
    };
    await fn(tx,probe);
    throw done;
  }).catch(e=>{if(e!==done) throw e;});
}
