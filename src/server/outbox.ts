import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Database,Queryable} from './db';
import type {IdentityService} from './identity';
import {intakeScoped,type IntakePrincipal} from './intake-scope';
import {AppError} from './errors';

// Outbox (E-INT-06): rows are written in the caller's own transaction; the Telegram gateway pulls, sends and reports receipts.
// AI OS never calls Telegram and never reads a token variable. State changes go only through outboxTransition (E-INT-05).
export type OutboxState='pending'|'leased'|'delivered'|'uncertain'|'dead'|'abandoned';
export type OutboxSignal='lease'|'delivered'|'failed_retryable'|'failed_permanent'|'uncertain'|'lease_expired'|'reconciled_delivered'|'reconciled_not_sent'|'requeue'|'abandon';
export const MAX_ATTEMPTS=6,LEASE_SECONDS=60,OVERDUE_SECONDS=600;
export const backoffSeconds=(attemptNo:number)=>Math.min(30*2**(attemptNo-1),900);

export function outboxTransition(state:OutboxState,signal:OutboxSignal,attemptNo:number):OutboxState {
 const next=((): OutboxState|undefined=>{
  switch(state) {
   case 'pending': return signal==='lease'?'leased':undefined;
   case 'leased':
    if(signal==='delivered') return 'delivered';
    if(signal==='failed_retryable') return attemptNo<MAX_ATTEMPTS?'pending':'dead';
    if(signal==='failed_permanent') return 'dead';
    if(signal==='uncertain'||signal==='lease_expired') return 'uncertain';
    return undefined;
   case 'uncertain':
    if(signal==='reconciled_delivered') return 'delivered';
    if(signal==='reconciled_not_sent') return 'pending';
    if(signal==='abandon') return 'abandoned';
    return undefined;
   case 'dead':
    if(signal==='requeue') return 'pending';
    if(signal==='abandon') return 'abandoned';
    return undefined;
   default: return undefined;
  }
 })();
 if(!next) throw new AppError('OUTBOX_TRANSITION_INVALID','Không chuyển được trạng thái tin này.',409);
 return next;
}

export type Envelope={event_id:string;event_type:string;version:'v1';source:'libetech-ai-os';timestamp:string;tenant_id:string;trace_id:string;correlation_id:string;causation_id:string|null;payload:{template:string;params:Record<string,string>}};
export type Delivery={outboxId:string;attemptNo:number;leaseToken:string;audience:'group'|'dm';chatId:string;topicId:string;replyToMessageId:string|null;envelope:Envelope};

type Row={id:string;tenant_id:string;project_id:string|null;state:OutboxState;attempt_no:number;version:number;audience:'group'|'dm';recipient_user_id:string|null;
 target_chat_id:string;target_topic_id:string;reply_to_message_id:string|null;event_id:string;event_type:string;event_version:string;source:string;occurred_at:string|Date;
 trace_id:string;correlation_id:string;causation_id:string|null;template:string;payload:{params?:Record<string,string>};lease_token:string|null};
const COLS='id,tenant_id,project_id,state,attempt_no,version,audience,recipient_user_id,target_chat_id,target_topic_id,reply_to_message_id,event_id,event_type,event_version,source,occurred_at,trace_id,correlation_id,causation_id,template,payload,lease_token';

export type OutboxActor={kind:'intake_service'|'user';id:string};
export type OutboxSetColumn='attempt_no'|'lease_token'|'lease_expires_at'|'delivered_at'|'telegram_message_id'|'last_error_code'|'failure_owner_id';
export type OutboxMove={set?:Partial<Record<OutboxSetColumn,string|number|null>>;nextAttemptInSeconds?:number;leaseExpiresInSeconds?:number};
export type OutboxCtx={actor:OutboxActor;requestId:string};

/** Sole writer of outbox_messages.state: validates the move with outboxTransition, updates guarded by state and version,
 * and writes exactly one outbox_state_events row in the same transaction. Typed values only; every value is a bound parameter. */
export async function applyOutboxSignal(tx:Queryable,row:Pick<Row,'id'|'tenant_id'|'project_id'|'state'|'attempt_no'|'version'|'trace_id'>,signal:OutboxSignal,ctx:OutboxCtx,move:OutboxMove={}):Promise<OutboxState> {
 const next=outboxTransition(row.state,signal,row.attempt_no);
 const params:unknown[]=[row.id,row.state,next,row.version];
 const parts=['state=$3','version=version+1','updated_at=now()'];
 for(const [k,v] of Object.entries(move.set??{})) {params.push(v);parts.push(`${k}=$${params.length}`);}
 if(move.nextAttemptInSeconds!==undefined) {params.push(move.nextAttemptInSeconds);parts.push(`next_attempt_at=now() + make_interval(secs => $${params.length}::double precision)`);}
 if(move.leaseExpiresInSeconds!==undefined) {params.push(move.leaseExpiresInSeconds);parts.push(`lease_expires_at=now() + make_interval(secs => $${params.length}::double precision)`);}
 const r=await tx.query(`UPDATE outbox_messages SET ${parts.join(',')} WHERE id=$1 AND state=$2 AND version=$4 RETURNING id`,params);
 if(!r.rows.length) throw new AppError('OUTBOX_CONFLICT','Tin đã được xử lý ở nơi khác; thử lại.',409);
 const attemptAfter=typeof move.set?.attempt_no==='number'?move.set.attempt_no:row.attempt_no;
 await tx.query(
  `INSERT INTO outbox_state_events(tenant_id,project_id,outbox_id,from_state,to_state,signal,attempt_no,actor_kind,actor_id,request_id,trace_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
  [row.tenant_id,row.project_id,row.id,row.state,next,signal,attemptAfter,ctx.actor.kind,ctx.actor.id,ctx.requestId,row.trace_id]);
 return next;
}

type ReceiptTemplate='intake.received'|'intake.recovered'|'intake.attachment_failed';
export async function enqueueReceipt(tx:Queryable,i:{tenantId:string;projectId:string;sourceEventId:string;candidateId:string|null;chatId:string;topicId:string;replyToMessageId:string;template:ReceiptTemplate;params:Record<string,string>;traceId:string;correlationId:string}):Promise<'queued'|'none'> {
 const r=await tx.query<{id:string}>(
  `INSERT INTO outbox_messages(tenant_id,project_id,event_id,event_type,trace_id,correlation_id,causation_id,audience,target_chat_id,target_topic_id,reply_to_message_id,template,payload,dedupe_key,source_event_id,candidate_id)
   VALUES($1,$2,$3,$4,$5,$6,NULL,'group',$7,$8,$9,$10,$11,$12,$13,$14)
   ON CONFLICT(tenant_id,dedupe_key) DO NOTHING RETURNING id`,
  [i.tenantId,i.projectId,randomUUID(),i.template,i.traceId,i.correlationId,i.chatId,i.topicId,i.replyToMessageId,i.template,JSON.stringify({params:i.params}),i.template+':'+i.sourceEventId,i.sourceEventId,i.candidateId]);
 return r.rows.length?'queued':'none';
}

/** Runs inside identity.scope (role libetech_identity). The DM row belongs to the tenant, not to a project. */
export async function enqueueDm(tx:Queryable,i:{tenantId:string;recipientUserId:string;telegramId:string;template:'account_approval.pending';dedupeKey:string;params:Record<string,string>;traceId:string;correlationId:string;causationId:string|null}):Promise<void> {
 await tx.query(
  `INSERT INTO outbox_messages(tenant_id,event_id,event_type,trace_id,correlation_id,causation_id,audience,target_chat_id,recipient_user_id,template,payload,dedupe_key)
   VALUES($1,$2,$3,$4,$5,$6,'dm',$7,$8,$9,$10,$11) ON CONFLICT(tenant_id,dedupe_key) DO NOTHING`,
  [i.tenantId,randomUUID(),i.template,i.traceId,i.correlationId,i.causationId,i.telegramId,i.recipientUserId,i.template,JSON.stringify({params:i.params}),i.dedupeKey]);
}

const pullSchema=z.object({limit:z.number().int().min(1).max(10)}).strict();
const receiptSchema=z.object({
 outboxId:z.string().uuid(),attemptNo:z.number().int().min(1),leaseToken:z.string().uuid(),phase:z.enum(['send','reconcile']),
 outcome:z.enum(['delivered','failed_retryable','failed_permanent','uncertain','not_sent']),
 telegramMessageId:z.string().regex(/^[0-9]{1,20}$/).optional(),errorCode:z.string().regex(/^[A-Z0-9_]{1,64}$/).optional(),reportedAt:z.string().datetime({offset:true}),
}).strict().refine(r=>r.phase==='send'?r.outcome!=='not_sent':(r.outcome==='delivered'||r.outcome==='not_sent'),{message:'Outcome does not match phase.'});
const reportSchema=z.object({receipts:z.array(receiptSchema).min(1).max(10)}).strict();

const iso=(v:string|Date)=>new Date(v).toISOString();
const envelopeOf=(r:Row):Envelope=>({event_id:r.event_id,event_type:r.event_type,version:r.event_version as 'v1',source:r.source as 'libetech-ai-os',timestamp:iso(r.occurred_at),tenant_id:r.tenant_id,
 trace_id:r.trace_id,correlation_id:r.correlation_id,causation_id:r.causation_id,payload:{template:r.template,params:r.payload?.params??{}}});

export class OutboxService {
 constructor(private intakeDb:Database,private identity:IdentityService,private p:IntakePrincipal) {}

 private audit(tx:Queryable,row:{id:string;project_id:string|null;trace_id:string},kind:string,requestId:string,payload:Record<string,unknown>) {
  if(!row.project_id) return Promise.resolve();
  return tx.query(
   `INSERT INTO intake_events(tenant_id,project_id,entity_type,entity_id,actor_id,actor_kind,kind,request_id,trace_id,payload) VALUES($1,$2,'outbox_message',$3,$4,'intake_service',$5,$6,$7,$8)`,
   [this.p.tenantId,row.project_id,row.id,this.p.id,kind,requestId,row.trace_id,JSON.stringify(payload)]);
 }

 async pull(raw:unknown):Promise<{deliveries:Delivery[];reconcile:{outboxId:string;attemptNo:number}[]}> {
  const {limit}=pullSchema.parse(raw);
  const requestId=randomUUID();
  const ctx:OutboxCtx={actor:{kind:'intake_service',id:this.p.id},requestId};
  const t=this.p.tenantId;
  const first=await intakeScoped(this.intakeDb,this.p,async tx=>{
   // (1) leases whose gateway went silent become uncertain: reconcile before any resend.
   const expired=(await tx.query<Row>(`SELECT ${COLS} FROM outbox_messages WHERE tenant_id=$1 AND state='leased' AND lease_expires_at<now() ORDER BY created_at FOR UPDATE SKIP LOCKED`,[t])).rows;
   for(const r of expired) {
    await applyOutboxSignal(tx,r,'lease_expired',ctx);
    await this.audit(tx,r,'outbox.uncertain',requestId,{attemptNo:r.attempt_no,reason:'lease_expired'});
   }
   // (2) lease a batch; concurrent pulls skip rows another pull holds.
   const due=(await tx.query<Row>(`SELECT ${COLS} FROM outbox_messages WHERE tenant_id=$1 AND state='pending' AND next_attempt_at<=now() ORDER BY created_at LIMIT $2 FOR UPDATE SKIP LOCKED`,[t,limit])).rows;
   const leased:{row:Row;attemptNo:number;leaseToken:string}[]=[];
   for(const r of due) {
    const leaseToken=randomUUID();
    if(r.attempt_no>=MAX_ATTEMPTS) {
     // A reconciled "not sent" at the cap cannot go uncertain -> dead (017 guard), so it ends here: lease, then dead; never returned.
     await applyOutboxSignal(tx,r,'lease',ctx,{set:{lease_token:leaseToken},leaseExpiresInSeconds:LEASE_SECONDS});
     await this.audit(tx,r,'outbox.leased',requestId,{attemptNo:r.attempt_no});
     await applyOutboxSignal(tx,{...r,state:'leased',version:r.version+1},'failed_permanent',ctx,{set:{last_error_code:'MAX_ATTEMPTS_EXHAUSTED',lease_token:null,lease_expires_at:null}});
     await this.audit(tx,r,'outbox.dead',requestId,{attemptNo:r.attempt_no,errorCode:'MAX_ATTEMPTS_EXHAUSTED'});
     continue;
    }
    const attemptNo=r.attempt_no+1;
    await applyOutboxSignal(tx,r,'lease',ctx,{set:{attempt_no:attemptNo,lease_token:leaseToken},leaseExpiresInSeconds:LEASE_SECONDS});
    await this.audit(tx,r,'outbox.leased',requestId,{attemptNo});
    leased.push({row:{...r,state:'leased',attempt_no:attemptNo,version:r.version+1},attemptNo,leaseToken});
   }
   // (4) uncertain rows are handed back for reconciliation, never for resend.
   const reconcile=(await tx.query<{id:string;attempt_no:number}>(`SELECT id,attempt_no FROM outbox_messages WHERE tenant_id=$1 AND state='uncertain' ORDER BY created_at LIMIT 10`,[t])).rows
    .map(r=>({outboxId:r.id,attemptNo:r.attempt_no}));
   return {leased,reconcile};
  });

  // (3) The recipient link is read through the identity role in its own transaction (never nested in the intake one).
  const dms=first.leased.filter(l=>l.row.audience==='dm');
  let dead=new Set<string>();
  if(dms.length) {
   const links=await this.identity.scope(async tx=>(await tx.query<{user_id:string;telegram_id:string}>('SELECT user_id,telegram_id FROM identity.telegram_links WHERE user_id = ANY($1::uuid[])',[dms.map(l=>l.row.recipient_user_id)])).rows);
   const linked=new Set(links.map(l=>l.user_id+':'+l.telegram_id));
   const gone=dms.filter(l=>!linked.has(l.row.recipient_user_id+':'+l.row.target_chat_id));
   if(gone.length) {
    await intakeScoped(this.intakeDb,this.p,async tx=>{
     for(const l of gone) {
      await applyOutboxSignal(tx,l.row,'failed_permanent',ctx,{set:{last_error_code:'RECIPIENT_UNLINKED',lease_token:null,lease_expires_at:null}});
      await this.audit(tx,l.row,'outbox.dead',requestId,{attemptNo:l.attemptNo,errorCode:'RECIPIENT_UNLINKED'});
     }
    });
    dead=new Set(gone.map(l=>l.row.id));
   }
  }
  const deliveries=first.leased.filter(l=>!dead.has(l.row.id)).map(l=>({outboxId:l.row.id,attemptNo:l.attemptNo,leaseToken:l.leaseToken,audience:l.row.audience,
   chatId:l.row.target_chat_id,topicId:l.row.target_topic_id,replyToMessageId:l.row.reply_to_message_id,envelope:envelopeOf(l.row)}));
  return {deliveries,reconcile:first.reconcile};
 }

 async report(raw:unknown):Promise<{accepted:number;replayed:number;rejected:{outboxId:string;attemptNo:number;code:string}[]}> {
  const {receipts}=reportSchema.parse(raw);
  const requestId=randomUUID();
  const ctx:OutboxCtx={actor:{kind:'intake_service',id:this.p.id},requestId};
  return intakeScoped(this.intakeDb,this.p,async tx=>{
   let accepted=0,replayed=0;
   const rejected:{outboxId:string;attemptNo:number;code:string}[]=[];
   for(const r of receipts) {
    // Each receipt runs in its own savepoint: a bad one rolls back alone and the valid ones still apply.
    await tx.query('SAVEPOINT receipt_one');
    try {
    const row=(await tx.query<Row>(`SELECT ${COLS} FROM outbox_messages WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,[r.outboxId,this.p.tenantId])).rows[0];
    if(!row) throw new AppError('LEASE_INVALID','Biên nhận không khớp lượt gửi hiện tại.',409);
    const ins=await tx.query<{id:string}>(
     `INSERT INTO delivery_receipts(tenant_id,project_id,outbox_id,attempt_no,phase,outcome,telegram_message_id,error_code,reported_at,source_id,source_type,quality_score)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'telegram_gateway',$11) ON CONFLICT(outbox_id,attempt_no,phase) DO NOTHING RETURNING id`,
     [this.p.tenantId,row.project_id,row.id,r.attemptNo,r.phase,r.outcome,r.telegramMessageId??null,r.errorCode??null,r.reportedAt,`${row.id}:${r.attemptNo}:${r.phase}`,r.phase==='send'?100:60]);
    if(!ins.rows.length) {
     const old=(await tx.query<{outcome:string}>('SELECT outcome FROM delivery_receipts WHERE outbox_id=$1 AND attempt_no=$2 AND phase=$3',[row.id,r.attemptNo,r.phase])).rows[0];
     if(old?.outcome!==r.outcome) throw new AppError('RECEIPT_CONFLICT','Biên nhận khác với biên nhận đã ghi cho lượt này.',409);
     replayed++;await tx.query('RELEASE SAVEPOINT receipt_one');continue;
    }
    // A throw below rolls back to the savepoint, including the receipt row just inserted.
    const validSend=r.phase==='send'&&row.state==='leased'&&row.lease_token===r.leaseToken&&row.attempt_no===r.attemptNo;
    const validReconcile=r.phase==='reconcile'&&row.state==='uncertain'&&row.attempt_no===r.attemptNo;
    if(!validSend&&!validReconcile) throw new AppError('LEASE_INVALID','Biên nhận không khớp lượt gửi hiện tại.',409);
    const clear=r.phase==='send'?{lease_token:null,lease_expires_at:null}:{};
    let next:OutboxState;
    if(r.outcome==='delivered') {
     next=await applyOutboxSignal(tx,row,r.phase==='send'?'delivered':'reconciled_delivered',ctx,{set:{...clear,delivered_at:r.reportedAt,telegram_message_id:r.telegramMessageId??null}});
    } else if(r.outcome==='failed_retryable') {
     next=await applyOutboxSignal(tx,row,'failed_retryable',ctx,{set:{...clear,last_error_code:r.errorCode??null},nextAttemptInSeconds:backoffSeconds(row.attempt_no)});
    } else if(r.outcome==='failed_permanent') {
     next=await applyOutboxSignal(tx,row,'failed_permanent',ctx,{set:{...clear,last_error_code:r.errorCode??null}});
    } else if(r.outcome==='uncertain') {
     next=await applyOutboxSignal(tx,row,'uncertain',ctx,{set:{...clear,last_error_code:r.errorCode??null}});
    } else {
     // not sent: back to pending with backoff; at the attempt cap the next pull ends it as dead (see pull).
     next=await applyOutboxSignal(tx,row,'reconciled_not_sent',ctx,{nextAttemptInSeconds:backoffSeconds(row.attempt_no)});
    }
    await this.audit(tx,row,'outbox.'+(next==='pending'?'retry_scheduled':next),requestId,{attemptNo:r.attemptNo,phase:r.phase,outcome:r.outcome});
    accepted++;
    await tx.query('RELEASE SAVEPOINT receipt_one');
    } catch(error) {
     if(!(error instanceof AppError)||(error.code!=='LEASE_INVALID'&&error.code!=='RECEIPT_CONFLICT')) throw error;
     await tx.query('ROLLBACK TO SAVEPOINT receipt_one');
     await tx.query('RELEASE SAVEPOINT receipt_one');
     rejected.push({outboxId:r.outboxId,attemptNo:r.attemptNo,code:error.code});
    }
   }
   return {accepted,replayed,rejected};
  });
 }
}
