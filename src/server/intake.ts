import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Database,Queryable} from './db';
import type {ChatScopes} from './bridge-config';
import {intakePoolScoped,intakeScoped} from './intake-scope';
import {enqueuePoolReceipt as realEnqueuePoolReceipt,enqueueReceipt as realEnqueueReceipt,type EnqueuePoolReceipt} from './outbox';
import {AppError} from './errors';
import {attachmentVerdict,cleanFileName,eventKey,qualityScore,redactSecrets,threadKey} from './intake-rules';
import type {AttachmentState,IntakeAck,IntakeEventInput} from './types';
export type {IntakeAck,IntakeEventInput} from './types';

const digits=z.string().regex(/^[0-9]{1,20}$/);
const msgId=z.string().regex(/^[1-9][0-9]{0,19}$/);
const stamp=z.string().datetime({offset:true});
const hex64=z.string().regex(/^[a-f0-9]{64}$/);
const attachmentSchema=z.discriminatedUnion('state',[
 z.object({state:z.literal('stored'),locator:z.string().max(200),sha256:hex64,mimeType:z.string().min(1).max(100),sizeBytes:z.number().int().positive(),fileName:z.string().max(1000).optional()}).strict(),
 z.object({state:z.literal('failed'),reasonCode:z.string().min(1).max(64),mimeType:z.string().max(100).optional(),sizeBytes:z.number().int().nonnegative().optional(),fileName:z.string().max(1000).optional()}).strict(),
]);
export const intakeEventSchema:z.ZodType<IntakeEventInput>=z.object({
 context:z.object({telegramId:digits,chatId:z.string().regex(/^-[1-9][0-9]*$/),chatType:z.enum(['group','supergroup']),profile:z.literal('libetech'),
  messageId:msgId,topicId:digits.optional(),replyToMessageId:msgId.optional(),mediaGroupId:z.string().min(1).max(64).optional()}).strict(),
 observedAt:stamp,editedAt:stamp.optional(),addressed:z.boolean(),spooled:z.boolean(),forwarded:z.boolean(),actorLabel:z.string().max(200).optional(),
 text:z.string().max(4096),textTruncated:z.boolean(),contentHash:hex64,traceId:z.string().uuid(),attachment:attachmentSchema.optional(),
}).strict();

/** Latest revision of a SourceEvent (Task 7 reuses this). Alias: r = source_event_revisions (callers may also join e = source_events).
 * A revision with an edit time outranks one without; edits compare on Telegram's edited_at only; revisions without one fall
 * back to arrival order. Never e.observed_at: it is the first arrival's time, which may be an edit's (Codex round 3, finding 4). */
export const LATEST_REVISION_ORDER='r.edited_at DESC NULLS LAST, r.revision_no DESC';

type ReceiptTemplate='intake.received'|'intake.recovered'|'intake.attachment_failed';
export type EnqueueReceipt=(tx:Queryable,i:{tenantId:string;projectId:string;sourceEventId:string;candidateId:string|null;chatId:string;topicId:string;replyToMessageId:string;template:ReceiptTemplate;params:Record<string,string>;traceId:string;correlationId:string})=>Promise<'queued'|'none'>;

const DENIED=()=>new AppError('SCOPE_DENIED','Không có quyền tiếp nhận từ nhóm này.',403);
const MIME=/^[a-z0-9][\w.+-]{0,63}\/[a-z0-9][\w.+-]{0,63}$/i;
const LOCATOR=/^gw:\/\/libetech\/attachments\/([a-f0-9]{64})$/;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export const refOf=(id:string)=>'IN-'+id.slice(0,8).toUpperCase();
/** Why a file of an addressed message was not stored, for the receipt: a fixed list only. A word from the wire that is not on it is not passed on. */
const ATTACHMENT_REASONS=new Set(['TOO_LARGE','UNSUPPORTED_TYPE','DOWNLOAD_UNAVAILABLE','STORE_UNAVAILABLE']);
const attachmentReason=(state:AttachmentState|undefined,wire:string|undefined):string|undefined=>
 state==='too_large'?'TOO_LARGE':state==='unsupported_type'?'UNSUPPORTED_TYPE':state==='failed'&&wire&&ATTACHMENT_REASONS.has(wire)?wire:undefined;

export class IntakeService {
 constructor(private db:Database,private tenantId:string,private principalId:string,private chatScopes:ChatScopes,private intake:{chats:readonly string[];excerptChats?:readonly string[];poolChats?:readonly string[]},
  private enqueueReceipt:EnqueueReceipt=realEnqueueReceipt,private enqueuePoolReceipt:EnqueuePoolReceipt=realEnqueuePoolReceipt) {}

 /**
  * A message of a pool group (GIAO VIỆC 5 B, plan 3). Authority is the operator's poolChats list plus the sender: a person linked to Telegram, active and on the
  * Team Tech roster, calling the bot. Anything else leaves nothing and gets no answer, like a group that is not allowed. The project is never read from
  * chatScopes. text, actorLabel and fileName are never passed to SQL: a pool item keeps pointers, a hash, the mime type and the size only (AGENTS.md: IBS HI is
  * pointers, hashes and Tech work metadata only, and the domain of a pool item is not known until it is triaged).
  */
 private async ingestPool(e:IntakeEventInput):Promise<IntakeAck> {
  const c=e.context,tenantId=this.tenantId;
  if(!e.addressed||this.intake.chats.includes(c.chatId)) throw DENIED();
  const att=e.attachment;
  const attState:AttachmentState|undefined=att?(att.state==='stored'?attachmentVerdict(att):'failed'):undefined;
  const score=qualityScore({forwarded:e.forwarded,textTruncated:e.textTruncated,attachmentState:attState});
  const locator=c.chatId.startsWith('-100')?`https://t.me/c/${c.chatId.slice(4)}/${c.messageId}`:'';
  // a mime type is stored only when it has the shape of one: the field is free text in the body and a pool row keeps no free text
  const mime=att?.mimeType&&MIME.test(att.mimeType)?att.mimeType:null,size=att?.sizeBytes??null;
  return intakePoolScoped(this.db,{id:this.principalId,tenantId},async tx=>{
   const sender=(await tx.query<{id:string|null}>('SELECT public.intake_pool_sender($1) AS id',[c.telegramId])).rows[0]?.id;
   if(!sender) throw DENIED();
   const requestId=randomUUID();
   const event=(itemId:string,kind:string,traceId:string,payload:Record<string,unknown>)=>tx.query(
    `INSERT INTO intake_pool_events(tenant_id,pool_item_id,actor_id,actor_kind,kind,request_id,trace_id,payload) VALUES($1,$2,$3,'intake_service',$4,$5,$6,$7)`,
    [tenantId,itemId,this.principalId,kind,requestId,traceId,JSON.stringify(payload)]);
   const ins=(await tx.query<{id:string;trace_id:string;correlation_id:string}>(
    `INSERT INTO intake_pool_items(tenant_id,source_id,source_type,quality_score,chat_id,topic_id,message_id,reply_to_message_id,locator,sender_id,observed_at,edited_at,content_hash,forwarded,attachment_mime,attachment_size,trace_id,correlation_id)
     VALUES($1,$2,'telegram_gateway',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT(tenant_id,source_type,chat_id,message_id) DO NOTHING RETURNING id,trace_id,correlation_id`,
    [tenantId,eventKey(c.chatId,c.messageId),score,c.chatId,c.topicId??'',c.messageId,c.replyToMessageId??null,locator,sender,e.observedAt,e.editedAt??null,e.contentHash,e.forwarded,mime,size,e.traceId,randomUUID()])).rows[0];
   if(ins) {
    await event(ins.id,'pool.received',ins.trace_id,{state_after:'unassigned',version_after:1});
    const ref=refOf(ins.id);
    const receipt=await this.enqueuePoolReceipt(tx,{tenantId,poolItemId:ins.id,chatId:c.chatId,topicId:c.topicId??'',replyToMessageId:c.messageId,params:{ref,observedAt:e.observedAt},traceId:ins.trace_id,correlationId:ins.correlation_id});
    return {sourceEventId:ins.id,revisionNo:1,candidateRef:ref,replayed:false,persisted:true,receipt};
   }
   // The message is already there. The row is locked while it is compared: two sends at once cannot both count as the first revision.
   const old=(await tx.query<{id:string;content_hash:string;edited_at:unknown;revision_count:number;version:number;trace_id:string}>(
    'SELECT id,content_hash,edited_at,revision_count,version,trace_id FROM intake_pool_items WHERE tenant_id=$1 AND source_type=$2 AND chat_id=$3 AND message_id=$4 FOR UPDATE',[tenantId,'telegram_gateway',c.chatId,c.messageId])).rows[0];
   if(!old) throw new AppError('SOURCE_EVENT_CONFLICT','Không ghi nhận được tin này.',409);
   const ref=refOf(old.id);
   // a revision is a later edit time AND a different hash; the stored hash is only ever compared for equality
   const newer=e.editedAt!==undefined&&e.contentHash!==old.content_hash&&(old.edited_at==null||Date.parse(e.editedAt)>new Date(old.edited_at as string).getTime());
   if(!newer) return {sourceEventId:old.id,revisionNo:old.revision_count+1,candidateRef:ref,replayed:true,persisted:true,receipt:'none'};
   await tx.query('UPDATE intake_pool_items SET content_hash=$2,edited_at=$3,revision_count=revision_count+1,version=version+1,updated_at=now() WHERE id=$1',[old.id,e.contentHash,e.editedAt]);
   await event(old.id,'pool.revised',old.trace_id,{revision_no:old.revision_count+2,version_before:old.version,version_after:old.version+1});
   return {sourceEventId:old.id,revisionNo:old.revision_count+2,candidateRef:ref,replayed:false,persisted:true,receipt:'none'};
  });
 }

 async ingest(raw:unknown):Promise<IntakeAck> {
  const e=intakeEventSchema.parse(raw),c=e.context;
  if(this.intake.poolChats?.includes(c.chatId)) return this.ingestPool(e);
  // Authority comes only from operator configuration, before any SQL that carries content.
  if(!c.chatId.startsWith('-')||!this.intake.chats.includes(c.chatId)) throw DENIED();
  const scope=[...new Set((this.chatScopes[c.chatId]??[]).map(x=>x.toLowerCase()))];
  if(scope.length===0) throw DENIED();
  // OQ-27 decided 14/11/2026 (a): only a group mapped to exactly one project is taken in.
  if(scope.length>1) throw new AppError('INTAKE_PROJECT_AMBIGUOUS','Nhóm này chưa được gán đúng một dự án.',409);
  const projectId=scope[0],tenantId=this.tenantId;
  const att=e.attachment;
  let attState:AttachmentState|undefined,attLocator:string|null=null,attSha:string|null=null;
  if(att?.state==='stored') {
   const m=LOCATOR.exec(att.locator);
   if(!m||m[1]!==att.sha256) throw new AppError('ATTACHMENT_HASH_MISMATCH','Mã tệp không khớp.',422);
   attState=attachmentVerdict(att);
   if(attState==='stored') {attLocator=att.locator;attSha=att.sha256;}
  } else if(att) attState='failed';
  const revisionKey=sha(`${e.contentHash}|${e.editedAt??''}|${att?.state==='stored'?att.sha256:''}`);
  const pid={id:this.principalId,tenantId,projectIds:[projectId]};

  return intakeScoped(this.db,pid,async tx=>{
   // OQ-28 (c): the operator flags a group in the bridge config. Fail closed twice: no flag means pointer only, and a project
   // mapped to IBS_HI is always pointer only (AGENTS.md:16). Other domain labels and "unmapped" decide nothing.
   // OQ-30 (b), decided 14/11/2026: the mode belongs to this revision, judged with the configuration current now. It may loosen or
   // tighten between revisions of one message; a replayed revision keeps the row (and mode) it was first written with.
   const flagged=(this.intake.excerptChats??[]).includes(c.chatId);
   const mapping=flagged?(await tx.query<{domain_code:string}>('SELECT domain_code FROM project_domain_mappings WHERE tenant_id=$1 AND project_id=$2 ORDER BY mapping_version DESC LIMIT 1',[tenantId,projectId])).rows[0]?.domain_code:undefined;
   const contentMode=flagged&&mapping!=='IBS_HI'?'excerpt':'pointer_only';
   const parent=c.replyToMessageId?(await tx.query<{thread_key:string}>('SELECT thread_key FROM source_events WHERE tenant_id=$1 AND source_type=$2 AND chat_id=$3 AND message_id=$4',[tenantId,'telegram_gateway',c.chatId,c.replyToMessageId])).rows[0]?.thread_key:undefined;
   const tKey=threadKey({messageId:c.messageId,mediaGroupId:c.mediaGroupId,parentThreadKey:parent});
   const locator=c.chatId.startsWith('-100')?`https://t.me/c/${c.chatId.slice(4)}/${c.messageId}`:'';
   const score=qualityScore({forwarded:e.forwarded,textTruncated:e.textTruncated,attachmentState:attState});
   const ins=await tx.query<{id:string;thread_key:string;trace_id:string;correlation_id:string}>(
    `INSERT INTO source_events(tenant_id,project_id,source_id,source_type,quality_score,chat_id,topic_id,message_id,reply_to_message_id,media_group_id,thread_key,source_actor,source_actor_label,observed_at,locator,forwarded,addressed,spooled,trace_id,correlation_id)
     VALUES($1,$2,$3,'telegram_gateway',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     ON CONFLICT(tenant_id,source_type,chat_id,message_id) DO NOTHING RETURNING id,thread_key,trace_id,correlation_id`,
    [tenantId,projectId,eventKey(c.chatId,c.messageId),score,c.chatId,c.topicId??'',c.messageId,c.replyToMessageId??null,c.mediaGroupId??null,tKey,'tg:'+c.telegramId,e.actorLabel??'',e.observedAt,locator,e.forwarded,e.addressed,e.spooled,e.traceId,randomUUID()]);
   let ev=ins.rows[0];
   const isNewEvent=Boolean(ev);
   if(!ev) {
    ev=(await tx.query<{id:string;thread_key:string;trace_id:string;correlation_id:string}>('SELECT id,thread_key,trace_id,correlation_id FROM source_events WHERE tenant_id=$1 AND source_type=$2 AND chat_id=$3 AND message_id=$4',[tenantId,'telegram_gateway',c.chatId,c.messageId])).rows[0];
    if(!ev) throw new AppError('SOURCE_EVENT_CONFLICT','Không ghi nhận được tin này.',409);
   }
   await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[ev.id]);
   const excerpt=contentMode==='excerpt'?redactSecrets(e.text.slice(0,4096)).slice(0,4096):null;
   const rev=(await tx.query<{id:string;revision_no:number}>(
    `INSERT INTO source_event_revisions(tenant_id,project_id,source_event_id,revision_no,revision_key,edited_at,content_hash,content_mode,text_excerpt,text_truncated)
     SELECT $1::uuid,$2::uuid,$3::uuid,coalesce(max(revision_no),0)+1,$4::text,$5::timestamptz,$6::text,$7::text,$8::text,$9::boolean FROM source_event_revisions WHERE source_event_id=$3::uuid
     ON CONFLICT(source_event_id,revision_key) DO NOTHING RETURNING id,revision_no`,
    [tenantId,projectId,ev.id,revisionKey,e.editedAt??null,e.contentHash,contentMode,excerpt,e.textTruncated])).rows[0];
   const replayed=!rev;
   const revisionNo=rev?rev.revision_no:(await tx.query<{revision_no:number}>('SELECT revision_no FROM source_event_revisions WHERE source_event_id=$1 AND revision_key=$2',[ev.id,revisionKey])).rows[0].revision_no;

   if(rev&&att&&attState) {
    const sizeBytes=att.sizeBytes??null;
    await tx.query(
     `INSERT INTO intake_attachments(tenant_id,project_id,source_event_id,revision_id,state,locator,sha256,mime_type,size_bytes,file_name,reason_code)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
     [tenantId,projectId,ev.id,rev.id,attState,attLocator,attSha,att.mimeType??'',sizeBytes,cleanFileName(att.fileName??''),att.state==='failed'?att.reasonCode:attState==='stored'?null:attState]);
   }

   let candidateId:string|undefined;
   const requestId=randomUUID();
   const audit=(entityType:string,entityId:string,kind:string,payload:Record<string,unknown>)=>tx.query(
    `INSERT INTO intake_events(tenant_id,project_id,entity_type,entity_id,actor_id,actor_kind,kind,request_id,trace_id,payload) VALUES($1,$2,$3,$4,$5,'intake_service',$6,$7,$8,$9)`,
    [tenantId,projectId,entityType,entityId,this.principalId,kind,requestId,e.traceId,JSON.stringify(payload)]);
   if(rev) {
    // contentMode here is this revision's mode (OQ-30 (b)).
    await audit('source_event',ev.id,isNewEvent?'source_event.persisted':'source_event.revised',{revisionNo,contentMode});
    const created=(await tx.query<{id:string}>(
     `INSERT INTO intake_candidates(tenant_id,project_id,chat_id,thread_key,root_source_event_id) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(tenant_id,project_id,chat_id,thread_key) DO NOTHING RETURNING id`,[tenantId,projectId,c.chatId,ev.thread_key,ev.id])).rows[0];
    if(created) {candidateId=created.id;await audit('intake_candidate',created.id,'candidate.created',{});}
   }
   if(!candidateId) candidateId=(await tx.query<{id:string}>('SELECT id FROM intake_candidates WHERE tenant_id=$1 AND project_id=$2 AND chat_id=$3 AND thread_key=$4',[tenantId,projectId,c.chatId,ev.thread_key])).rows[0]?.id;

   const ack:IntakeAck={sourceEventId:ev.id,revisionNo,candidateRef:candidateId?refOf(candidateId):null,replayed,persisted:true,receipt:'none'};
   if(!e.addressed) return ack;
   const notStored=Boolean(attState&&attState!=='stored');
   const why=notStored?attachmentReason(attState,att?.state==='failed'?att.reasonCode:undefined):undefined;
   if(replayed||revisionNo>1) return notStored?{...ack,receipt:'withheld',reason:'ATTACHMENT_NOT_STORED'}:ack;
   // Only a new, addressed event queues anything. Params carry the reference and observedAt, never the message text.
   const queued=await this.enqueueReceipt(tx,{tenantId,projectId,sourceEventId:ev.id,candidateId:candidateId??null,chatId:c.chatId,topicId:c.topicId??'',replyToMessageId:c.messageId,
    template:notStored?'intake.attachment_failed':e.spooled?'intake.recovered':'intake.received',params:{ref:candidateId?refOf(candidateId):'',observedAt:e.observedAt,...(why?{attachmentReason:why}:{})},traceId:ev.trace_id,correlationId:ev.correlation_id});
   // A failed file never claims success, whatever was queued.
   if(notStored) return {...ack,receipt:'withheld',reason:'ATTACHMENT_NOT_STORED'};
   const receipt=queued;
   return {...ack,receipt};
  });
 }
}
