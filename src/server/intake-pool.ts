import {z} from 'zod';
import type {Database,Queryable} from './db';
import {AppError,invariant} from './errors';
import {refOf} from './intake';
import {intakeTrail,type IntakeTrail,type TrailRequest} from './intake-trail';
import type {OutboxState} from './outbox';
import {fileRequestIn,submitSchema} from './work-requests';
import type {Principal} from './types';

// The Team Tech side of the pool (GIAO VIỆC 5 B): a message of a shared group arrived as a pool item without text and without a project. A Team Tech member
// picks the project and the kind, and in the same transaction files a work request (a BoM seat approves it, GIAO VIỆC 5 A) or links existing work.
// Identity and tenant come from the principal only; the body names neither. Every write: one transaction as libetech_runtime, the item locked, the expected
// version checked, one append-only pool event per step. The bot principal reads nothing here.
const DENIED=()=>new AppError('SCOPE_DENIED','Không tìm thấy mục trong phạm vi được cấp.',404);
const uuid=z.string().uuid();
const expectedVersion=z.number().int().min(1);
const classification=z.enum(['incident','request','document']);
export const DISMISS_CODES=['not_work','duplicate','wrong_group'] as const;
const fileSchema=submitSchema.extend({kind:z.literal('file_request'),expectedVersion,classification}).strict();
const linkSchema=z.object({kind:z.literal('link_work'),expectedVersion,projectId:uuid,classification,workId:uuid}).strict();
const dismissSchema=z.object({kind:z.literal('dismiss'),expectedVersion,code:z.enum(DISMISS_CODES)}).strict();
const reopenSchema=z.object({kind:z.literal('reopen'),expectedVersion}).strict();
// OQ-61 B6 (2): a wrong link is revoked with a fixed reason (never free text); the link row stays
export const REVOKE_REASONS=['wrong_work','wrong_message','wrong_project','mistake'] as const;
export type RevokeReason=typeof REVOKE_REASONS[number];
export const revokeSchema=z.object({kind:z.literal('revoke_link'),expectedVersion,linkId:uuid,reasonCode:z.enum(REVOKE_REASONS)}).strict();
const commandSchema=z.discriminatedUnion('kind',[fileSchema,linkSchema,dismissSchema,reopenSchema,revokeSchema]);
const listSchema=z.object({state:z.enum(['unassigned','assigned','dismissed']).optional(),limit:z.number().int().min(1).max(200).default(50),offset:z.number().int().min(0).default(0)}).strict();
export type PoolState='unassigned'|'assigned'|'dismissed';
export type LinkRevocation={byName:string;at:string;reasonCode:RevokeReason};
/** `canRevoke`: the viewer made this link or holds a BoM seat of its project, and it is not revoked yet. */
export type PoolLinkView={linkId:string;kind:'request'|'work';requestId:string|null;requestState:'pending'|'approved'|'rejected'|null;workCode:string|null;title:string|null;createdAt:string;createdByName:string;
 canRevoke:boolean;revoked:LinkRevocation|null};
export type PoolCard={itemId:string;ref:string;state:PoolState;classification:'incident'|'request'|'document'|null;dismissCode:string|null;projectId:string|null;projectLabel:string|null;
 receivedAt:string;editedAt:string|null;revisionCount:number;senderName:string|null;forwarded:boolean;attachment:{mimeType:string;sizeBytes:number|null}|null;
 receipt:{state:OutboxState|null;deliveredAt:string|null};version:number;trail:IntakeTrail;links:PoolLinkView[]};
export type PoolEventView={id:string;kind:string;actorKind:string;actorName:string|null;createdAt:string;payload:Record<string,unknown>};

const iso=(v:unknown)=>new Date(v as string).toISOString();
const isoOrNull=(v:unknown)=>v==null?null:iso(v);
const PROJECT_LIST="string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]";

type ItemRow={id:string;state:PoolState;classification:PoolCard['classification'];dismiss_code:string|null;project_id:string|null;observed_at:unknown;edited_at:unknown;revision_count:number;
 forwarded:boolean;attachment_mime:string|null;attachment_size:string|number|null;version:number;triaged_at:unknown;sender_name:string|null;triager_name:string|null;project_name:string|null;
 seat_open:boolean|null;outbox_state:OutboxState|null;delivered_at:unknown};
export type LinkRow={link_id:string;revoked_by_name:string|null;revoked_at:unknown;reason_code:RevokeReason|null;can_revoke:boolean|null;project_id:string;pool_item_id:string|null;candidate_id:string|null;work_request_id:string|null;work_id:string|null;created_at:unknown;created_by_name:string;r_id:string|null;r_state:TrailRequest['state']|null;r_title:string|null;
 r_filed:unknown;r_requester:string|null;r_decider:string|null;r_decided:unknown;r_work:string|null;work_code:string|null;work_visible:string|null};

const ITEM_SQL=`SELECT i.id,i.state,i.classification,i.dismiss_code,i.project_id,i.observed_at,i.edited_at,i.revision_count,i.forwarded,i.attachment_mime,i.attachment_size,i.version,i.triaged_at,
  sn.name AS sender_name,tn.name AS triager_name,cat.name AS project_name,
  CASE WHEN i.project_id=ANY(${PROJECT_LIST}) THEN EXISTS (SELECT 1 FROM bom_scopes s WHERE s.project_id=i.project_id AND s.enabled) END AS seat_open,
  o.state AS outbox_state,o.delivered_at
 FROM intake_pool_items i
 LEFT JOIN public.tech_roster_names() sn ON sn.id=i.sender_id
 LEFT JOIN public.tech_roster_names() tn ON tn.id=i.triaged_by
 LEFT JOIN public.tech_project_catalog() cat ON cat.id=i.project_id
 LEFT JOIN LATERAL (SELECT state,delivered_at FROM outbox_messages WHERE pool_item_id=i.id ORDER BY created_at DESC,id LIMIT 1) o ON true`;

/** Reads the links of one message into what the viewer may see: the request and work views, the trail inputs, and how many links exist that the viewer may not read. */
export function summariseLinks(links:LinkRow[]) {
 const views:PoolLinkView[]=[];
 const requests:TrailRequest[]=[];
 const workLinks:{workCode:string|null;at:string}[]=[];
 let hidden=0;
 for(const l of links) {
  // a revoked link stays on the card with who took it back and why, and counts for nothing in the trail
  const revoked:LinkRevocation|null=l.revoked_at==null?null:{byName:l.revoked_by_name!,at:iso(l.revoked_at),reasonCode:l.reason_code!};
  const common={linkId:l.link_id,createdAt:iso(l.created_at),createdByName:l.created_by_name,canRevoke:!revoked&&l.can_revoke===true,revoked};
  if(l.work_request_id) {
   // the request row is readable only to its requester, its decider and a BoM seat; for anybody else the link shows that something was filed and nothing more
   if(!l.r_id) {if(!revoked) hidden++;continue;}
   if(!revoked) requests.push({id:l.r_id,state:l.r_state!,filedAt:isoOrNull(l.r_filed),filedBy:l.r_requester,decidedBy:l.r_decider,decidedAt:isoOrNull(l.r_decided),workCode:l.work_code});
   views.push({...common,kind:'request',requestId:l.r_id,requestState:l.r_state,workCode:l.work_code,title:l.r_title});
  } else {
   if(!l.work_visible) {if(!revoked) hidden++;continue;}
   if(!revoked) workLinks.push({workCode:l.work_code,at:iso(l.created_at)});
   views.push({...common,kind:'work',requestId:null,requestState:null,workCode:l.work_code,title:null});
  }
 }
 return {views,requests,workLinks,hidden};
}
/** The links of messages (pool items or candidates) with the request and the work each points at, under the caller's row level security. */
export async function loadLinkRows(tx:Queryable,column:'pool_item_id'|'candidate_id',ids:string[]):Promise<LinkRow[]> {
 return (await tx.query<LinkRow>(
  `SELECT l.id AS link_id,l.project_id,l.pool_item_id,l.candidate_id,l.work_request_id,l.work_id,l.created_at,l.created_by_name,
    v.revoked_by_name,v.created_at AS revoked_at,v.reason_code,
    (l.created_by=nullif(current_setting('app.person_id',true),'')::uuid OR public.work_request_seat(l.project_id)) AS can_revoke,
    r.id AS r_id,r.state AS r_state,r.title AS r_title,r.created_at AS r_filed,r.requester_name AS r_requester,r.decider_name AS r_decider,r.decided_at AS r_decided,r.work_id AS r_work,
    w.code AS work_code,w.id AS work_visible
   FROM intake_work_links l
   LEFT JOIN intake_link_revocations v ON v.link_id=l.id AND v.tenant_id=l.tenant_id
   LEFT JOIN work_requests r ON r.id=l.work_request_id
   LEFT JOIN work_items w ON w.id=coalesce(l.work_id,r.work_id)
   WHERE l.${column}=ANY($1::uuid[]) ORDER BY l.created_at,l.id`,[ids])).rows;
}

function toCard(r:ItemRow,links:LinkRow[]):PoolCard {
 const {views,requests,workLinks,hidden:found}=summariseLinks(links);
 let hidden=found;
 // an assigned item always holds a request or a link (they are written in the transaction that assigns it): none readable means they exist and are not the viewer's to read
 if(r.state==='assigned'&&views.length===0) hidden=Math.max(hidden,1);
 const trail=intakeTrail({kind:'pool',receivedAt:iso(r.observed_at),poolState:r.state,projectName:r.project_name,triagedAt:isoOrNull(r.triaged_at),triagedBy:r.triager_name,requests,workLinks,hiddenLinks:hidden,seatOpen:r.seat_open});
 return {itemId:r.id,ref:refOf(r.id),state:r.state,classification:r.classification,dismissCode:r.dismiss_code,projectId:r.project_id,projectLabel:r.project_name,
  receivedAt:iso(r.observed_at),editedAt:isoOrNull(r.edited_at),revisionCount:r.revision_count,senderName:r.sender_name,forwarded:r.forwarded,
  attachment:r.attachment_mime!==null||r.attachment_size!==null?{mimeType:r.attachment_mime??'',sizeBytes:r.attachment_size==null?null:Number(r.attachment_size)}:null,
  receipt:{state:r.outbox_state,deliveredAt:isoOrNull(r.delivered_at)},version:r.version,trail,links:views};
}

/** Whether this message was linked to this work before: still linked, revoked (that pair is not linked again), or never. */
export async function priorLink(tx:Queryable,column:'pool_item_id'|'candidate_id',sourceId:string,workId:string):Promise<'live'|'revoked'|'none'> {
 const row=(await tx.query<{revoked:boolean}>(`SELECT EXISTS (SELECT 1 FROM intake_link_revocations v WHERE v.link_id=l.id) AS revoked
   FROM intake_work_links l WHERE l.${column}=$1 AND l.work_id=$2`,[sourceId,workId])).rows[0];
 return !row?'none':row.revoked?'revoked':'live';
}
export const LINK_REVOKED=()=>new AppError('LINK_REVOKED','Liên kết giữa tin này và việc đó đã bị gỡ nên không nối lại được. Chọn việc đúng.',409);
/** A link of this message that the caller reads under its own row level security (else 404), and may revoke: its creator or a BoM seat of its project. */
export async function revocableLink(tx:Queryable,p:Principal,column:'pool_item_id'|'candidate_id',sourceId:string,linkId:string):Promise<{id:string;projectId:string}> {
 const row=(await tx.query<{id:string;project_id:string;created_by:string;seat:boolean}>(
  `SELECT l.id,l.project_id,l.created_by,public.work_request_seat(l.project_id) AS seat FROM intake_work_links l WHERE l.id=$1 AND l.${column}=$2`,[linkId,sourceId])).rows[0];
 if(!row) throw DENIED();
 if(row.created_by!==p.id&&row.seat!==true) throw new AppError('REVOKE_DENIED','Chỉ người đã tạo liên kết hoặc một ghế BoM của dự án gỡ được. Nhờ một trong hai người đó gỡ.',403);
 return {id:row.id,projectId:row.project_id};
}
/** Writes the revocation once (UNIQUE + ON CONFLICT); false when the link was already revoked. */
export async function revokeLink(tx:Queryable,p:Principal,link:{id:string;projectId:string},reason:RevokeReason):Promise<boolean> {
 return (await tx.query(`INSERT INTO intake_link_revocations(tenant_id,project_id,link_id,revoked_by,revoked_by_name,reason_code) VALUES($1,$2,$3,$4,$5,$6)
   ON CONFLICT (tenant_id,link_id) DO NOTHING RETURNING id`,[p.tenantId,link.projectId,link.id,p.id,p.name,reason])).rows.length>0;
}

async function loadCards(tx:Queryable,where:string,params:unknown[],tail=''):Promise<PoolCard[]> {
 const items=(await tx.query<ItemRow>(`${ITEM_SQL} WHERE ${where}${tail}`,params)).rows;
 if(!items.length) return [];
 const links=await loadLinkRows(tx,'pool_item_id',items.map(i=>i.id));
 return items.map(i=>toCard(i,links.filter(l=>l.pool_item_id===i.id&&l.project_id===i.project_id)));
}

export class PoolService {
 constructor(private db:Database) {}

 /** One transaction as the runtime role, tenant and projects of the principal, and the acting person (event actor, triager, link creator). */
 private run<T>(p:Principal,fn:(tx:Queryable)=>Promise<T>):Promise<T> {
  invariant(p&&p.id&&p.tenantId&&p.role!=='bot','READ_ONLY','Vai này chỉ được đọc dữ liệu trong phạm vi dự án.',403);
  return this.db.transaction(async tx=>{
   await tx.query('SET LOCAL ROLE libetech_runtime');
   await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.person_id',$3,true)",[p.tenantId,(p.projectIds??[]).join(','),p.id]);
   return fn(tx);
  });
 }
 private async tech(tx:Queryable):Promise<boolean> {return (await tx.query<{ok:boolean}>('SELECT public.app_actor_is_tech_member() AS ok')).rows[0].ok===true;}

 /** Off the roster: an empty list (the policy returns no row), not an error. */
 async list(p:Principal,raw:unknown):Promise<{items:PoolCard[];unassigned:number}> {
  const q=listSchema.parse(raw??{});
  return this.run(p,async tx=>{
   const filter=q.state?' AND i.state=$1':'';
   const params=q.state?[q.state]:[];
   // the only count is the items that still wait for a project; a count over every project would add up work of different domains
   const unassigned=(await tx.query<{n:number}>('SELECT count(*)::int AS n FROM intake_pool_items i WHERE i.state=\'unassigned\'')).rows[0].n;
   const items=await loadCards(tx,`true${filter}`,[...params],` ORDER BY i.created_at DESC,i.id LIMIT ${q.limit} OFFSET ${q.offset}`);
   return {items,unassigned};
  });
 }

 async detail(p:Principal,id:string):Promise<{card:PoolCard;events:PoolEventView[]}> {
  if(!uuid.safeParse(id).success) throw DENIED();
  return this.run(p,async tx=>{
   const card=(await loadCards(tx,'i.id=$1',[id]))[0];
   if(!card) throw DENIED();
   const events=(await tx.query<{id:string;kind:string;actor_kind:string;actor_name:string|null;created_at:unknown;payload:Record<string,unknown>}>(
    `SELECT e.id,e.kind,e.actor_kind,n.name AS actor_name,e.created_at,e.payload FROM intake_pool_events e LEFT JOIN public.tech_roster_names() n ON n.id=e.actor_id AND e.actor_kind='user'
     WHERE e.pool_item_id=$1 ORDER BY e.seq LIMIT 500`,[id])).rows
    .map(e=>({id:e.id,kind:e.kind,actorKind:e.actor_kind,actorName:e.actor_name,createdAt:iso(e.created_at),payload:e.payload}));
   return {card,events};
  });
 }

 /** requestId comes from the caller (the HTTP request id), never from JSON. */
 async command(p:Principal,id:string,raw:unknown,requestId:string):Promise<PoolCard> {
  invariant(p&&p.role!=='bot','READ_ONLY','Vai này chỉ được đọc dữ liệu trong phạm vi dự án.',403);
  uuid.parse(requestId);
  if(!uuid.safeParse(id).success) throw DENIED();
  const input=commandSchema.parse(raw);
  return this.run(p,async tx=>{
   if(!await this.tech(tx)) throw DENIED();
   const item=(await tx.query<{id:string;state:PoolState;project_id:string|null;version:number;trace_id:string}>(
    'SELECT id,state,project_id,version,trace_id FROM intake_pool_items WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!item) throw DENIED();
   const conflict=()=>new AppError('REVISION_CONFLICT','Mục đã thay đổi; tải lại rồi thao tác lại.',409);
   const event=(kind:string,payload:Record<string,unknown>)=>tx.query(
    `INSERT INTO intake_pool_events(tenant_id,pool_item_id,actor_id,actor_kind,kind,request_id,trace_id,payload) VALUES($1,$2,$3,'user',$4,$5,$6,$7)`,
    [p.tenantId,id,p.id,kind,requestId,item.trace_id,JSON.stringify(payload)]);
   /** The step that takes the item to its project (first command) or only raises its version (a further request or link in the same project). */
   const advance=async(project:string,kind:z.infer<typeof classification>)=>{
    if(item.version!==input.expectedVersion) throw conflict();
    const first=item.state==='unassigned';
    const upd=first
     ?await tx.query("UPDATE intake_pool_items SET state='assigned',project_id=$2,classification=$3,triaged_by=$4,triaged_at=now(),version=version+1,updated_at=now() WHERE id=$1 AND version=$5 RETURNING id",[id,project,kind,p.id,item.version])
     :await tx.query('UPDATE intake_pool_items SET version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING id',[id,item.version]);
    if(!upd.rows.length) throw conflict();
    if(first) await event('pool.triaged',{state_before:'unassigned',state_after:'assigned',version_before:item.version,version_after:item.version+1,project_id:project,classification:kind});
   };
   const link=async(project:string,target:{requestId?:string;workId?:string})=>(await tx.query<{id:string}>(
    `INSERT INTO intake_work_links(tenant_id,project_id,pool_item_id,work_request_id,work_id,created_by,created_by_name) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING id`,
    [p.tenantId,project,id,target.requestId??null,target.workId??null,p.id,p.name])).rows[0];
   const settle=async()=>(await loadCards(tx,'i.id=$1',[id]))[0];

   switch(input.kind) {
    case 'file_request': {
     if(item.state==='dismissed') throw new AppError('POOL_DISMISSED','Mục này đã bị bỏ qua; mở lại trước khi tạo yêu cầu.',409);
     if(item.state==='assigned'&&item.project_id!==input.projectId) throw new AppError('POOL_ASSIGNED','Mục này đã được gán cho dự án khác.',409);
     const {kind:_k,expectedVersion:_v,classification:kindOfItem,...content}=input;void _k;void _v;
     const filed=await fileRequestIn(tx,p,content,{origin:'intake',sourceRef:`${refOf(id)} · ${id}`,authorization:'standard'});
     if(filed.replayed) {
      // the same key filed from this item before: the old result, nothing written
      const seen=(await tx.query('SELECT 1 FROM intake_work_links WHERE pool_item_id=$1 AND work_request_id=$2',[id,filed.request.id])).rows.length>0;
      invariant(seen,'IDEMPOTENCY_CONFLICT','Mã thao tác đã được dùng cho một yêu cầu khác.',409);
      return settle();
     }
     await advance(input.projectId,kindOfItem);
     await link(input.projectId,{requestId:filed.request.id});
     // the link row holds the request id; an event names neither the request nor the work (a roster member who may not read them would learn them from it)
     await event('pool.request_filed',{project_id:input.projectId,version_after:item.version+1});
     return settle();
    }
    case 'link_work': {
     if(item.state==='dismissed') throw new AppError('POOL_DISMISSED','Mục này đã bị bỏ qua; mở lại trước khi liên kết việc.',409);
     if(item.state==='assigned'&&item.project_id!==input.projectId) throw new AppError('POOL_ASSIGNED','Mục này đã được gán cho dự án khác.',409);
     if(!(await tx.query('SELECT 1 FROM public.tech_project_catalog() WHERE id=$1',[input.projectId])).rows.length) throw DENIED();
     const allowed=(await tx.query<{ok:boolean}>('SELECT public.intake_link_allowed($1) AS ok',[input.projectId])).rows[0].ok===true;
     if(!allowed) throw new AppError('LINK_DENIED','Bạn không có quyền liên kết việc ở dự án này.',403);
     if(!(await tx.query('SELECT 1 FROM work_items WHERE id=$1 AND project_id=$2',[input.workId,input.projectId])).rows.length)
      throw new AppError('SCOPE_DENIED','Không tìm thấy việc trong phạm vi được cấp.',404);
     // the item is locked: a link read here is the link every concurrent caller would find; linking the same pair again changes nothing
     const prior=await priorLink(tx,'pool_item_id',id,input.workId);
     if(prior==='live') return settle();
     if(prior==='revoked') throw LINK_REVOKED();
     await advance(input.projectId,input.classification);
     const made=await link(input.projectId,{workId:input.workId});
     invariant(made,'REVISION_CONFLICT','Mục đã thay đổi; tải lại rồi thao tác lại.',409);
     await event('pool.work_linked',{project_id:input.projectId,version_after:item.version+1});
     return settle();
    }
    case 'revoke_link': {
     const link=await revocableLink(tx,p,'pool_item_id',id,input.linkId);
     // the insert decides: a link revoked before gives no row, and the card is answered as it stands; the version is checked only when something is written
     if(!await revokeLink(tx,p,link,input.reasonCode)) return settle();
     if(item.version!==input.expectedVersion) throw conflict();
     const upd=await tx.query('UPDATE intake_pool_items SET version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING id',[id,item.version]);
     if(!upd.rows.length) throw conflict();
     await event('pool.link_revoked',{project_id:link.projectId,link_id:input.linkId,reason_code:input.reasonCode,version_before:item.version,version_after:item.version+1});
     return settle();
    }
    case 'dismiss': {
     if(item.version!==input.expectedVersion) throw conflict();
     if(item.state==='assigned') throw new AppError('POOL_ASSIGNED','Mục đã được gán dự án; không bỏ qua được.',409);
     if(item.state==='dismissed') throw new AppError('POOL_TRANSITION_INVALID','Mục đã bị bỏ qua.',409);
     await tx.query("UPDATE intake_pool_items SET state='dismissed',dismiss_code=$2,triaged_by=$3,triaged_at=now(),version=version+1,updated_at=now() WHERE id=$1 AND version=$4",[id,input.code,p.id,item.version]);
     await event('pool.dismissed',{state_before:'unassigned',state_after:'dismissed',version_before:item.version,version_after:item.version+1,dismiss_code:input.code});
     return settle();
    }
    case 'reopen': {
     if(item.version!==input.expectedVersion) throw conflict();
     if(item.state==='unassigned') throw new AppError('POOL_TRANSITION_INVALID','Mục chưa được phân loại.',409);
     if(item.state==='assigned') {
      // The item opens only if every link it holds in this project is a rejected request that THIS caller can read. The caller's rejected requests are read under its
      // own row level security; a definer function then says, as one bit, whether any link lies outside them (it gives no number and names nothing). Pending, approved,
      // work links and links the caller cannot read all lie outside, so the one answer below says nothing about what a BoM seat decided.
      const held=(await loadLinkRows(tx,'pool_item_id',[id])).filter(l=>l.project_id===item.project_id);
      const readableRejected=held.filter(l=>l.revoked_at==null&&l.work_request_id!==null&&l.r_id!==null&&l.r_state==='rejected').map(l=>l.work_request_id as string);
      // revoked links no longer hold the item (030); one the caller can read stands, like a rejected request, for «this caller knows what was here»
      const readableRevoked=held.some(l=>l.revoked_at!=null);
      const outside=(await tx.query<{b:boolean|null}>('SELECT public.intake_pool_links_outside($1,$2,$3::uuid[]) AS b',[id,item.project_id,readableRejected])).rows[0].b;
      if(outside!==false||(readableRejected.length===0&&!readableRevoked)) throw new AppError('POOL_ASSIGNED','Không mở lại được mục này.',409);
     }
     await tx.query("UPDATE intake_pool_items SET state='unassigned',project_id=NULL,classification=NULL,dismiss_code=NULL,triaged_by=NULL,triaged_at=NULL,version=version+1,updated_at=now() WHERE id=$1 AND version=$2",[id,item.version]);
     await event('pool.reopened',{state_before:item.state,state_after:'unassigned',version_before:item.version,version_after:item.version+1});
     return settle();
    }
   }
  });
 }
}
