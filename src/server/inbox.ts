import {z} from 'zod';
import {scoped,type Database,type Queryable} from './db';
import {AppError} from './errors';
import {deduplicate} from './service';
import {LATEST_REVISION_ORDER,refOf} from './intake';
import {candidateTransition,type CandidateAction,type CandidateState} from './intake-rules';
import {applyOutboxSignal,OVERDUE_SECONDS,type OutboxState} from './outbox';
import {projectRole} from './types';
import type {Principal} from './types';
export type {CandidateAction,CandidateState} from './intake-rules';

// PM-facing side of the inbox: reads candidates and failed outbox rows, and applies the PM's decisions.
// Every write: scoped transaction (role libetech_runtime), expected version, deduplicated by key, one immutable intake_events row.
// No action here creates, assigns, closes or accepts a work item. project_channels is read for display only (OQ-09).
export type IntakeStatus={receivedAt:string;persistedAt:string;projectedAt:null;deliveredAt:string|null;acknowledgedAt:string|null;outboxState:OutboxState|null};
export type CandidateCard={candidateId:string;ref:string;projectId:string;projectLabel:string;sourceRef:string;receivedAt:string;classification:'incident'|'request'|'document'|null;state:CandidateState;missingFields:string[];
 duplicateCandidates:{candidateId:string;ref:string;reason:string}[];contentMode:'excerpt'|'pointer_only';excerpt:string|null;forwarded:boolean;
 attachments:{state:string;mimeType:string;sizeBytes:number|null;fileName:string}[];ticketRef:string|null;status:IntakeStatus;version:number};
export type SourceAvailabilityRow={chatId:string;topicId:string;state:'not-configured'|'partially-received';coverageStart:string|null;coverageGaps:{from:string;to:string}[];label:string};
export type RevisionView={revisionNo:number;editedAt:string|null;contentHash:string|null;excerpt:string|null;textTruncated:boolean;recordedAt:string};
export type EventView={id:string;kind:string;actorKind:string;actorId:string;createdAt:string;payload:Record<string,unknown>};
export type DeliveryView={outboxId:string;template:string;state:OutboxState;attemptNo:number;deliveredAt:string|null;acknowledgedAt:string|null;
 receipts:{attemptNo:number;phase:string;outcome:string;reportedAt:string}[]};
// leased appears only once its lease has run out: the gateway took it and never answered, so it waits for the next pull's sweep.
export type FailureRow={outboxId:string;state:'dead'|'uncertain'|'pending'|'leased';template:string;candidateRef:string|null;lastErrorCode:string|null;ownerId:string|null;overdue:boolean;version:number};

const DENIED=()=>new AppError('SCOPE_DENIED','Không tìm thấy mục trong phạm vi được cấp.',404);
const READ_ROLES=new Set(['manager','engineer','technical','business']);
const uuid=z.string().uuid();
const iso=(v:unknown)=>new Date(v as string).toISOString();
const isoOrNull=(v:unknown)=>v==null?null:iso(v);

// Read needs a project role in {manager, engineer, technical, business} (OQ S5 placeholder); acting needs manager. Bot and viewer never pass.
export function readable(p:Principal,projectId:string):void {
 if(!p||p.role==='bot'||!p.projectIds?.includes(projectId)||!READ_ROLES.has(projectRole(p,projectId))) throw DENIED();
}
function managerOf(p:Principal,projectId:string):void {
 readable(p,projectId);
 if(projectRole(p,projectId)!=='manager') throw new AppError('MANAGER_REQUIRED','Chỉ điều phối dự án được thực hiện thao tác này.',403);
}

const listSchema=z.object({projectId:uuid,state:z.enum(['new','needs_info','confirmed','duplicate','dismissed']).optional(),limit:z.number().int().min(1).max(200).default(50),offset:z.number().int().min(0).default(0)}).strict();
const expectedVersion=z.number().int().min(1);
const reason=z.string().trim().min(1).max(500);
const commandSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('confirm'),expectedVersion,classification:z.enum(['incident','request','document']),note:z.string().trim().max(1000).optional()}).strict(),
 z.object({kind:z.literal('need_info'),expectedVersion,missingFields:z.array(z.string().trim().min(1).max(100)).min(1).max(10)}).strict(),
 z.object({kind:z.literal('mark_duplicate'),expectedVersion,duplicateOf:uuid,reason}).strict(),
 z.object({kind:z.literal('dismiss'),expectedVersion,reason}).strict(),
 z.object({kind:z.literal('reopen'),expectedVersion,reason}).strict(),
 z.object({kind:z.literal('link_ticket'),expectedVersion,ticketRef:z.string().regex(/^TK-[A-Z0-9]{1,12}-\d{6}-\d{3,5}$/)}).strict(),
]);
const failureSchema=z.object({kind:z.enum(['take','requeue','abandon']),expectedVersion,reason}).strict();

type CardRow={id:string;project_id:string;project_label:string;state:CandidateState;classification:CandidateCard['classification'];missing_fields:string[];ticket_ref:string|null;version:number;
 source_id:string;observed_at:unknown;ingested_at:unknown;forwarded:boolean;content_mode:'excerpt'|'pointer_only';text_excerpt:string|null;dups:string[];
 attachments:CandidateCard['attachments'];outbox_state:OutboxState|null;delivered_at:unknown;acknowledged_at:unknown};

// "lat" = the newest revision of each candidate's root message, chosen by edited_at then revision_no (LATEST_REVISION_ORDER).
const CARD_SQL=`WITH lat AS (
  SELECT DISTINCT ON (c.id) c.id AS cid, r.content_hash, r.text_excerpt
  FROM intake_candidates c JOIN source_events e ON e.id=c.root_source_event_id JOIN source_event_revisions r ON r.source_event_id=e.id
  WHERE c.project_id=$1 ORDER BY c.id, ${LATEST_REVISION_ORDER})
 SELECT c.id,c.project_id,pr.name AS project_label,c.state,c.classification,c.missing_fields,c.ticket_ref,c.version,
  e.source_id,e.observed_at,e.ingested_at,e.forwarded,e.content_mode,l.text_excerpt,
  (SELECT coalesce(json_agg(l2.cid ORDER BY l2.cid),'[]'::json) FROM lat l2 WHERE l2.content_hash=l.content_hash AND l2.cid<>c.id) AS dups,
  (SELECT coalesce(json_agg(json_build_object('state',a.state,'mimeType',a.mime_type,'sizeBytes',a.size_bytes,'fileName',a.file_name) ORDER BY a.created_at,a.id),'[]'::json)
     FROM intake_attachments a WHERE a.source_event_id=e.id) AS attachments,
  o.state AS outbox_state,o.delivered_at,o.acknowledged_at
 FROM intake_candidates c
 JOIN projects pr ON pr.id=c.project_id
 JOIN source_events e ON e.id=c.root_source_event_id
 LEFT JOIN lat l ON l.cid=c.id
 LEFT JOIN LATERAL (SELECT state,delivered_at,acknowledged_at FROM outbox_messages WHERE candidate_id=c.id ORDER BY created_at DESC,id LIMIT 1) o ON true
 WHERE c.project_id=$1`;

function toCard(r:CardRow):CandidateCard {
 return {candidateId:r.id,ref:refOf(r.id),projectId:r.project_id,projectLabel:r.project_label,sourceRef:r.source_id,receivedAt:iso(r.observed_at),classification:r.classification,state:r.state,
  missingFields:r.missing_fields,duplicateCandidates:r.dups.map(id=>({candidateId:id,ref:refOf(id),reason:'cùng nội dung'})),
  contentMode:r.content_mode,excerpt:r.content_mode==='excerpt'?r.text_excerpt:null,forwarded:r.forwarded,
  attachments:r.attachments.map(a=>({state:a.state,mimeType:a.mimeType,sizeBytes:a.sizeBytes==null?null:Number(a.sizeBytes),fileName:a.fileName})),ticketRef:r.ticket_ref,
  status:{receivedAt:iso(r.observed_at),persistedAt:iso(r.ingested_at),projectedAt:null,deliveredAt:isoOrNull(r.delivered_at),acknowledgedAt:isoOrNull(r.acknowledged_at),outboxState:r.outbox_state},version:r.version};
}
async function loadCard(tx:Queryable,projectId:string,candidateId:string):Promise<CandidateCard> {
 const row=(await tx.query<CardRow>(CARD_SQL+' AND c.id=$2',[projectId,candidateId])).rows[0];
 if(!row) throw DENIED();
 return toCard(row);
}

export class InboxService {
 constructor(private db:Database) {}

 /** One scoped transaction on a single project, with the acting person set for the database (event actor, state-event actor). */
 private run<T>(p:Principal,projectId:string,fn:(tx:Queryable)=>Promise<T>):Promise<T> {
  return scoped(this.db,{...p,projectIds:[projectId]},async tx=>{
   await tx.query("SELECT set_config('app.person_id',$1,true)",[p.id]);
   return fn(tx);
  });
 }
 /** Finds which project an id belongs to among the projects this person is scoped to. Missing and out of scope look the same. */
 private async locate(p:Principal,table:'intake_candidates'|'outbox_messages',id:string):Promise<string> {
  if(!p||p.role==='bot'||!p.projectIds?.length||!uuid.safeParse(id).success) throw DENIED();
  const row=await scoped(this.db,p,async tx=>(await tx.query<{project_id:string}>(`SELECT project_id FROM ${table} WHERE id=$1`,[id])).rows[0]);
  if(!row?.project_id) throw DENIED();
  return row.project_id;
 }

 async list(p:Principal,raw:unknown):Promise<{items:CandidateCard[];total:number}> {
  if(!p||p.role==='bot') throw DENIED();
  const q=listSchema.parse(raw);
  readable(p,q.projectId);
  return this.run(p,q.projectId,async tx=>{
   const params:unknown[]=[q.projectId];
   let filter='';
   if(q.state) {params.push(q.state);filter=` AND c.state=$${params.length}`;}
   const total=(await tx.query<{n:number}>(`SELECT count(*)::int AS n FROM intake_candidates c WHERE c.project_id=$1${filter}`,params)).rows[0].n;
   params.push(q.limit,q.offset);
   const rows=(await tx.query<CardRow>(`${CARD_SQL}${filter} ORDER BY c.created_at DESC,c.id LIMIT $${params.length-1} OFFSET $${params.length}`,params)).rows;
   return {items:rows.map(toCard),total};
  });
 }

 async detail(p:Principal,candidateId:string):Promise<{card:CandidateCard;revisions:RevisionView[];events:EventView[];deliveries:DeliveryView[]}> {
  const projectId=await this.locate(p,'intake_candidates',candidateId);
  readable(p,projectId);
  return this.run(p,projectId,async tx=>{
   const card=await loadCard(tx,projectId,candidateId);
   const root=(await tx.query<{root_source_event_id:string;content_mode:string}>('SELECT c.root_source_event_id,e.content_mode FROM intake_candidates c JOIN source_events e ON e.id=c.root_source_event_id WHERE c.id=$1',[candidateId])).rows[0];
   const revisions=(await tx.query<{revision_no:number;edited_at:unknown;content_hash:string;text_excerpt:string|null;text_truncated:boolean;created_at:unknown}>(
    `SELECT r.revision_no,r.edited_at,r.content_hash,r.text_excerpt,r.text_truncated,r.created_at FROM source_event_revisions r JOIN source_events e ON e.id=r.source_event_id
     WHERE r.source_event_id=$1 ORDER BY ${LATEST_REVISION_ORDER}`,[root.root_source_event_id])).rows
    // pointer_only: AGENTS.md allows hashes only as stored pointers; OQ-28 is open, so no hash is shown for such a project.
    .map(r=>({revisionNo:r.revision_no,editedAt:isoOrNull(r.edited_at),contentHash:root.content_mode==='excerpt'?r.content_hash:null,excerpt:root.content_mode==='excerpt'?r.text_excerpt:null,textTruncated:r.text_truncated,recordedAt:iso(r.created_at)}));
   const events=(await tx.query<{id:string;kind:string;actor_kind:string;actor_id:string;created_at:unknown;payload:Record<string,unknown>}>(
    'SELECT id,kind,actor_kind,actor_id,created_at,payload FROM intake_events WHERE project_id=$1 AND entity_id IN ($2,$3) ORDER BY created_at,id LIMIT 500',[projectId,candidateId,root.root_source_event_id])).rows
    .map(e=>({id:e.id,kind:e.kind,actorKind:e.actor_kind,actorId:e.actor_id,createdAt:iso(e.created_at),payload:e.payload}));
   const outs=(await tx.query<{id:string;template:string;state:OutboxState;attempt_no:number;delivered_at:unknown;acknowledged_at:unknown}>(
    'SELECT id,template,state,attempt_no,delivered_at,acknowledged_at FROM outbox_messages WHERE candidate_id=$1 ORDER BY created_at,id',[candidateId])).rows;
   const deliveries:DeliveryView[]=[];
   for(const o of outs) {
    const receipts=(await tx.query<{attempt_no:number;phase:string;outcome:string;reported_at:unknown}>('SELECT attempt_no,phase,outcome,reported_at FROM delivery_receipts WHERE outbox_id=$1 ORDER BY attempt_no,reported_at,id',[o.id])).rows;
    deliveries.push({outboxId:o.id,template:o.template,state:o.state,attemptNo:o.attempt_no,deliveredAt:isoOrNull(o.delivered_at),acknowledgedAt:isoOrNull(o.acknowledged_at),
     receipts:receipts.map(r=>({attemptNo:r.attempt_no,phase:r.phase,outcome:r.outcome,reportedAt:iso(r.reported_at)}))});
   }
   return {card,revisions,events,deliveries};
  });
 }

 /** requestId comes from the caller (the HTTP request id), never from JSON. */
 async command(p:Principal,candidateId:string,raw:unknown,key:string,requestId:string):Promise<CandidateCard> {
  uuid.parse(requestId);
  const projectId=await this.locate(p,'intake_candidates',candidateId);
  managerOf(p,projectId);
  const input=commandSchema.parse(raw);
  const action:CandidateAction=input.kind;
  return this.run(p,projectId,async tx=>{
   // The stored idempotent response holds ids, state and version only; the card is always re-read.
   const done=await deduplicate(tx,p,projectId,key,{op:'inbox.candidate.'+input.kind,candidateId,...input},async()=>{
   if(input.kind==='mark_duplicate') {
    // Lock source and target in id order so two opposite marks serialize instead of forming a cycle.
    await tx.query('SELECT id FROM intake_candidates WHERE id=ANY($1::uuid[]) AND project_id=$2 ORDER BY id FOR UPDATE',[[candidateId,input.duplicateOf],projectId]);
   }
   const row=(await tx.query<{id:string;state:CandidateState;version:number;classification:string|null;duplicate_of:string|null;missing_fields:string[];note:string;ticket_ref:string|null;trace_id:string}>(
    `SELECT c.id,c.state,c.version,c.classification,c.duplicate_of,c.missing_fields,c.note,c.ticket_ref,e.trace_id
     FROM intake_candidates c JOIN source_events e ON e.id=c.root_source_event_id WHERE c.id=$1 AND c.project_id=$2 FOR UPDATE OF c`,[candidateId,projectId])).rows[0];
   if(!row) throw DENIED();
   if(row.version!==input.expectedVersion) throw new AppError('REVISION_CONFLICT','Ứng viên đã thay đổi; tải lại rồi thao tác lại.',409);
   const next=candidateTransition(row.state,action);
   const set={classification:row.classification,duplicateOf:row.duplicate_of,missing:row.missing_fields,note:row.note,ticketRef:row.ticket_ref};
   const detail:Record<string,unknown>={};
   switch(input.kind) {
    // The incident note is the manager's own text (impact / recovery); the event payload is what «Xem chi tiết» shows.
    case 'confirm': set.classification=input.classification;set.duplicateOf=null;set.missing=[];set.note=input.note??'';detail.classification=input.classification;
     if(input.note) detail.note=input.note;break;
    case 'need_info': set.missing=input.missingFields;detail.missingFields=input.missingFields;break;
    case 'mark_duplicate': {
     if(input.duplicateOf===candidateId) throw new AppError('INVALID_DUPLICATE_TARGET','Không thể đánh dấu trùng với chính nó.',422);
     const target=(await tx.query<{state:CandidateState}>('SELECT state FROM intake_candidates WHERE id=$1 AND project_id=$2',[input.duplicateOf,projectId])).rows[0];
     if(!target) throw DENIED();
     if(target.state==='duplicate') throw new AppError('INVALID_DUPLICATE_TARGET','Ứng viên đích đã là bản trùng của ứng viên khác.',422);
     set.duplicateOf=input.duplicateOf;set.note=input.reason;detail.duplicateOf=input.duplicateOf;detail.reason=input.reason;break;
    }
    case 'dismiss': set.note=input.reason;detail.reason=input.reason;break;
    case 'reopen': set.classification=null;set.duplicateOf=null;set.missing=[];set.note=input.reason;detail.reason=input.reason;break;
    case 'link_ticket': set.ticketRef=input.ticketRef;detail.ticketRef=input.ticketRef;break;
   }
   const upd=await tx.query(
    `UPDATE intake_candidates SET state=$3,classification=$4,duplicate_of=$5,missing_fields=$6::jsonb,note=$7,ticket_ref=$8,decided_by=$9,version=version+1,updated_at=now()
     WHERE id=$1 AND version=$2 RETURNING id`,
    [candidateId,input.expectedVersion,next,set.classification,set.duplicateOf,JSON.stringify(set.missing),set.note,set.ticketRef,p.id]);
   if(!upd.rows.length) throw new AppError('REVISION_CONFLICT','Ứng viên đã thay đổi; tải lại rồi thao tác lại.',409);
   const kind={confirm:'candidate.confirmed',need_info:'candidate.needs_info',mark_duplicate:'candidate.marked_duplicate',dismiss:'candidate.dismissed',reopen:'candidate.reopened',link_ticket:'candidate.ticket_linked'}[input.kind];
   await tx.query(
    `INSERT INTO intake_events(tenant_id,project_id,entity_type,entity_id,actor_id,actor_kind,kind,request_id,trace_id,payload) VALUES($1,$2,'intake_candidate',$3,$4,'user',$5,$6,$7,$8)`,
    [p.tenantId,projectId,candidateId,p.id,kind,requestId,row.trace_id,JSON.stringify({stateBefore:row.state,stateAfter:next,versionBefore:row.version,versionAfter:row.version+1,...detail})]);
   return {candidateId,state:next,version:row.version+1};
   });
   return loadCard(tx,projectId,done.candidateId);
  });
 }

 async sources(p:Principal,projectId:string):Promise<SourceAvailabilityRow[]> {
  readable(p,projectId);
  return this.run(p,projectId,async tx=>{
   // project_channels is read to show what was proposed; it never decides what is received (OQ-09).
   const channels=(await tx.query<{chat_id:string;topic_id:string}>('SELECT chat_id,topic_id FROM project_channels WHERE project_id=$1 ORDER BY created_at,id LIMIT 200',[projectId])).rows;
   const out:SourceAvailabilityRow[]=[];
   for(const ch of channels) {
    const match='project_id=$1 AND chat_id=$2 AND ($3=\'\' OR topic_id=$3)';
    const first=(await tx.query<{first:unknown}>(`SELECT min(observed_at) AS first FROM source_events WHERE ${match}`,[projectId,ch.chat_id,ch.topic_id])).rows[0].first;
    if(first==null) {out.push({chatId:ch.chat_id,topicId:ch.topic_id,state:'not-configured',coverageStart:null,coverageGaps:[],label:'Chưa xác minh khả năng nhận tin'});continue;}
    const gaps=(await tx.query<{observed_at:unknown;ingested_at:unknown}>(`SELECT observed_at,ingested_at FROM source_events WHERE ${match} AND spooled ORDER BY observed_at LIMIT 100`,[projectId,ch.chat_id,ch.topic_id])).rows;
    const start=iso(first);
    out.push({chatId:ch.chat_id,topicId:ch.topic_id,state:'partially-received',coverageStart:start,coverageGaps:gaps.map(g=>({from:iso(g.observed_at),to:iso(g.ingested_at)})),
     // the instant is coverageStart; the screen formats it, so no raw ISO reaches the label (UI-4)
     label:'Nhận từ mốc ghi đầu tiên; không có lịch sử trước mốc này'});
   }
   return out;
  });
 }

 async failures(p:Principal,projectId:string):Promise<FailureRow[]> {
  readable(p,projectId);
  return this.run(p,projectId,async tx=>(await tx.query<{id:string;state:FailureRow['state'];template:string;candidate_id:string|null;last_error_code:string|null;failure_owner_id:string|null;version:number;overdue:boolean}>(
   `SELECT id,state,template,candidate_id,last_error_code,failure_owner_id,version,
      (state='leased' OR (delivered_at IS NULL AND created_at < now() - make_interval(secs => $2::double precision))) AS overdue
    FROM outbox_messages
    WHERE project_id=$1 AND (state IN ('dead','uncertain')
      OR (state='pending' AND created_at < now() - make_interval(secs => $2::double precision))
      OR (state='leased' AND lease_expires_at < now()))
    ORDER BY created_at,id LIMIT 200`,[projectId,OVERDUE_SECONDS])).rows
   .map(r=>({outboxId:r.id,state:r.state,template:r.template,candidateRef:r.candidate_id?refOf(r.candidate_id):null,lastErrorCode:r.last_error_code,ownerId:r.failure_owner_id,overdue:r.overdue,version:r.version})));
 }

 async failureCommand(p:Principal,outboxId:string,raw:unknown,key:string,requestId:string):Promise<void> {
  uuid.parse(requestId);
  const projectId=await this.locate(p,'outbox_messages',outboxId);
  managerOf(p,projectId);
  const input=failureSchema.parse(raw);
  await this.run(p,projectId,tx=>deduplicate(tx,p,projectId,key,{op:'inbox.outbox.'+input.kind,outboxId,...input},async()=>{
   const row=(await tx.query<{id:string;tenant_id:string;project_id:string;state:OutboxState;attempt_no:number;version:number;trace_id:string}>(
    'SELECT id,tenant_id,project_id,state,attempt_no,version,trace_id FROM outbox_messages WHERE id=$1 AND project_id=$2 FOR UPDATE',[outboxId,projectId])).rows[0];
   if(!row) throw DENIED();
   if(row.version!==input.expectedVersion) throw new AppError('REVISION_CONFLICT','Tin đã thay đổi; tải lại rồi thao tác lại.',409);
   if(input.kind==='take') {
    // Same state: not a transition, so it does not go through applyOutboxSignal.
    if(row.state!=='dead'&&row.state!=='uncertain'&&row.state!=='pending') throw new AppError('OUTBOX_TRANSITION_INVALID','Không nhận xử lý được tin ở trạng thái này.',409);
    const upd=await tx.query('UPDATE outbox_messages SET failure_owner_id=$3,version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING id',[outboxId,input.expectedVersion,p.id]);
    if(!upd.rows.length) throw new AppError('REVISION_CONFLICT','Tin đã thay đổi; tải lại rồi thao tác lại.',409);
   } else if(input.kind==='requeue') await applyOutboxSignal(tx,row,'requeue',{requestId},{set:{attempt_no:0}});
   else await applyOutboxSignal(tx,row,'abandon',{requestId});
   const kind={take:'outbox.taken',requeue:'outbox.requeued',abandon:'outbox.abandoned'}[input.kind];
   await tx.query(
    `INSERT INTO intake_events(tenant_id,project_id,entity_type,entity_id,actor_id,actor_kind,kind,request_id,trace_id,payload) VALUES($1,$2,'outbox_message',$3,$4,'user',$5,$6,$7,$8)`,
    [p.tenantId,projectId,outboxId,p.id,kind,requestId,row.trace_id,JSON.stringify({stateBefore:row.state,versionBefore:row.version,reason:input.reason})]);
   const stateAfter=input.kind==='requeue'?'pending':input.kind==='abandon'?'abandoned':row.state;
   return {outboxId,state:stateAfter,version:row.version+1};
  }));
 }
}
