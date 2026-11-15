import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {aiScoped,type AiPrincipal} from './ai-scope';
import {scoped,type Database,type Queryable} from './db';
import {READ_ROLES} from './document-review';
import {DocumentService,mayWriteDocuments,proposeSchema,READ_ONLY_MESSAGE} from './documents';
import {AppError,invariant} from './errors';
import {buildSkillContextIn,CONTEXT_KINDS} from './skill-context';
import {checkSkillOutput,MAX_OUTPUT_BYTES,outputFits,outputSchemas,SKILLS,type SkillName} from './skill-contracts';
import {canonicalJson,skillManifests} from './skills';
import {storable} from './text-safety';
import {projectRole} from './types';
import type {Principal} from './types';

// Slice 3, Task 12 (AR-03, E-AI-04): an AI output is written to Z4 (intelligence.ai_drafts) and only there. A person confirms or rejects it;
// the draft's content is never copied into Z1 by this module: the one Z1 content row is the revision the person's own proposal creates.
// No route uses this module and nothing constructs it with an AI database handle (Z4 is not switched on). Nothing here logs a draft.
const NOT_FOUND='Không tìm thấy mục trong phạm vi được cấp.';
const denied=()=>new AppError('SCOPE_DENIED',NOT_FOUND,404);
const draftInvalid=()=>new AppError('DRAFT_INVALID','Đầu ra của kỹ năng không hợp lệ nên không được lưu.',422);
const idempotencyConflict=()=>new AppError('IDEMPOTENCY_CONFLICT','Mã thao tác đã được dùng với nội dung khác.',409);
const alreadyDecided=()=>new AppError('DRAFT_ALREADY_DECIDED','Nháp này đã có quyết định.',409);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX64=/^[a-f0-9]{64}$/;
const uuidIn=z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).transform(s=>s.toLowerCase());
const lower=z.string().transform(s=>s.toLowerCase());
const ENTITY_TYPES=['intake_candidate','document'] as const;
type EntityType=typeof ENTITY_TYPES[number];

export type DraftView={id:string;projectId:string;entityType:EntityType;entityId:string;skill:SkillName;skillVersion:string;manifestHash:string;modelVersion:string;
  value:unknown;valueHash:string;sources:{id:string}[];questions:{field:string;question:string}[];confidence:number;createdAt:string;
  decision:{result:'confirmed'|'rejected';decidedBy:string;decidedAt:string;documentRevisionId:string|null}|null};

const submitSchema=z.strictObject({
 skill:z.enum(SKILLS),projectId:uuidIn,entityType:z.enum(ENTITY_TYPES),entityId:uuidIn,output:z.unknown(),
 inputHash:z.string().regex(HEX64),modelVersion:z.string().min(1).max(64).refine(storable),
 dedupeKey:z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),traceId:uuidIn,
});
const decideSchema=z.strictObject({
 result:z.enum(['confirmed','rejected']),valueHash:z.string().regex(HEX64),
 reason:z.string().max(1000).refine(storable).optional(),revision:proposeSchema.optional(),
}).superRefine((v,ctx)=>{if(v.result==='rejected'&&v.revision!==undefined) ctx.addIssue({code:'custom',path:['revision'],message:'Từ chối không kèm bản đề xuất.'});});
const listSchema=z.strictObject({
 projectId:lower,entityType:z.enum(ENTITY_TYPES),entityId:lower,limit:z.number().int().min(1).max(200).default(50),offset:z.number().int().min(0).default(0),
});

/** Size of a value as PostgreSQL prints it as jsonb text (a space after every ':' and ','), which is what the table's backstop CHECKs measure (S42). */
function jsonbTextBytes(v:unknown):number {
 const text=(x:unknown):string=>{
  if(x===null||typeof x!=='object') return JSON.stringify(x);
  if(Array.isArray(x)) return `[${x.map(text).join(', ')}]`;
  return `{${Object.entries(x as Record<string,unknown>).map(([k,y])=>`${JSON.stringify(k)}: ${text(y)}`).join(', ')}}`;
 };
 return Buffer.byteLength(text(v),'utf8');
}
const sha256=(v:unknown)=>createHash('sha256').update(canonicalJson(v),'utf8').digest('hex');
const iso=(v:unknown)=>new Date(v as string).toISOString();

type DraftRow={id:string;project_id:string;entity_type:EntityType;entity_id:string;signal_type:SkillName;skill_version:string;manifest_hash:string;model_version:string;
  value:unknown;value_hash:string;sources:{id:string}[];questions:{field:string;question:string}[];confidence:number;created_at:unknown;
  dec_result:'confirmed'|'rejected'|null;dec_by:string|null;dec_at:unknown;dec_revision:string|null;dec_key:string|null};
const DRAFT_SQL=`SELECT d.id,d.project_id,d.entity_type,d.entity_id,d.signal_type,d.skill_version,d.manifest_hash,d.model_version,d.value,d.value_hash,d.sources,d.questions,d.confidence,d.created_at,
  x.result AS dec_result,x.decided_by AS dec_by,x.created_at AS dec_at,x.document_revision_id AS dec_revision,x.command_key AS dec_key
  FROM intelligence.ai_drafts d LEFT JOIN draft_decisions x ON x.draft_id=d.id`;
const toView=(r:DraftRow):DraftView=>({id:r.id,projectId:r.project_id,entityType:r.entity_type,entityId:r.entity_id,skill:r.signal_type,skillVersion:r.skill_version,manifestHash:r.manifest_hash,
  modelVersion:r.model_version,value:r.value,valueHash:r.value_hash,sources:r.sources,questions:r.questions,confidence:Number(r.confidence),createdAt:iso(r.created_at),
  decision:r.dec_result?{result:r.dec_result,decidedBy:r.dec_by!,decidedAt:iso(r.dec_at),documentRevisionId:r.dec_revision}:null});

export class SuggestionService {
 private documents:DocumentService;
 constructor(private db:Database,private aiDb:Database|null=null,private excerptChats:readonly string[]=[]) {this.documents=new DocumentService(db);}

 /** The pipeline's write: one insert under the AI role. Everything that can be refused is refused before the database is touched. */
 async submitDraft(ai:AiPrincipal,raw:unknown):Promise<{draftId:string;stored:boolean}> {
  if(!this.aiDb) throw new AppError('AI_PIPELINE_DISABLED','Đường ghi nháp AI chưa được bật.',503);
  if(!ai||!UUID.test(String(ai.id).toLowerCase())||!UUID.test(String(ai.tenantId).toLowerCase())||!Array.isArray(ai.projectIds)) throw new AppError('UNAUTHENTICATED','Cần phạm vi dự án.',401);
  const input=submitSchema.parse(raw);
  if(!ai.projectIds.some(x=>String(x).toLowerCase()===input.projectId)) throw denied();
  // a pair the context builder could never honour is never stored (it could never be confirmed)
  const kinds=CONTEXT_KINDS[input.skill];
  if(input.entityType==='intake_candidate'?!kinds.includes('source_event'):!kinds.includes('document_revision')) throw draftInvalid();
  if(!outputFits(input.output)) throw draftInvalid();
  const parsed=outputSchemas[input.skill].safeParse(input.output);
  if(!parsed.success) throw draftInvalid();
  const output=parsed.data;
  if(output.skill!==input.skill||output.manifestHash!==skillManifests[input.skill].hash) throw draftInvalid();
  // the table's backstops measure the jsonb text form, which is wider than the JSON text
  if(!outputFits(output)||jsonbTextBytes(output)>49152||jsonbTextBytes(output.sources)>65536||jsonbTextBytes(output.questions)>16384) throw draftInvalid();
  const valueHash=sha256(output),manifest=skillManifests[input.skill];
  return aiScoped(this.aiDb,{...ai,projectIds:[input.projectId]},async tx=>{
   const row=(await tx.query<{id:string}>(`INSERT INTO intelligence.ai_drafts(tenant_id,project_id,entity_type,entity_id,signal_type,skill_version,manifest_hash,model_version,value,value_hash,
     sources,questions,confidence,input_hash,ai_principal_id,trace_id,dedupe_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17)
     ON CONFLICT(tenant_id,dedupe_key) DO NOTHING RETURNING id`,
    [ai.tenantId,input.projectId,input.entityType,input.entityId,input.skill,manifest.version,manifest.hash,input.modelVersion,JSON.stringify(output),valueHash,
     JSON.stringify(output.sources),JSON.stringify(output.questions),output.confidence,input.inputHash,ai.id,input.traceId,input.dedupeKey])).rows[0];
   if(row) return {draftId:row.id,stored:true};
   // Nothing stored: the key is taken. It is a replay only if the row is visible to this principal and says the same thing; the key is unique per tenant across projects.
   const old=(await tx.query<{id:string;project_id:string;signal_type:string;entity_type:string;entity_id:string;value_hash:string}>(
    'SELECT id,project_id,signal_type,entity_type,entity_id,value_hash FROM intelligence.ai_drafts WHERE tenant_id=$1 AND dedupe_key=$2',[ai.tenantId,input.dedupeKey])).rows[0];
   if(!old||old.project_id!==input.projectId||old.signal_type!==input.skill||old.entity_type!==input.entityType||old.entity_id!==input.entityId||old.value_hash!==valueHash) throw idempotencyConflict();
   return {draftId:old.id,stored:false};
  });
 }

 async list(p:Principal,raw:unknown):Promise<{items:DraftView[];total:number}> {
  if(!p||p.role==='bot'||!p.id||!Array.isArray(p.projectIds)) throw denied();
  const peek=(raw as {projectId?:unknown}|null)?.projectId;
  const own=typeof peek==='string'?p.projectIds.find(x=>x.toLowerCase()===peek.toLowerCase()):undefined;
  if(own===undefined||!UUID.test(own.toLowerCase())||!READ_ROLES.has(projectRole(p,own))) throw denied();
  const q=listSchema.parse(raw);
  if(!UUID.test(q.entityId)) throw denied();
  return scoped(this.db,{...p,projectIds:[own]},async tx=>{
   const items=(await tx.query<DraftRow>(`${DRAFT_SQL} WHERE d.project_id=$1 AND d.entity_type=$2 AND d.entity_id=$3 ORDER BY d.created_at DESC, d.id DESC LIMIT $4 OFFSET $5`,
    [own,q.entityType,q.entityId,q.limit,q.offset])).rows.map(toView);
   const total=(await tx.query<{n:number}>('SELECT count(*)::int AS n FROM intelligence.ai_drafts WHERE project_id=$1 AND entity_type=$2 AND entity_id=$3',[own,q.entityType,q.entityId])).rows[0].n;
   return {items,total};
  });
 }

 /**
  * Order inside the one scoped transaction: (1) locate the draft in the person's scope, then narrow the scope to its project, lock on the draft id;
  * (2) replay / already decided, caller's valueHash; (3) authority; (4) reason for a rejection, or the holds for a confirmation (nothing is written yet);
  * (5) a document draft: the person's own revision proposal; (6) the decision row. A failure at any point rolls back everything written before it.
  */
 async decide(p:Principal,draftId:string,raw:unknown,key:string,requestId:string):Promise<DraftView> {
  if(!p||p.role==='bot'||!p.id||!Array.isArray(p.projectIds)||!p.projectIds.length) throw denied();
  const id=String(draftId).toLowerCase();
  if(!UUID.test(id)) throw denied();
  z.string().uuid().parse(requestId);
  invariant(/^[A-Za-z0-9_-]{8,100}$/.test(String(key)),'IDEMPOTENCY_REQUIRED','Cần mã thao tác hợp lệ để chống ghi lặp.',400);
  return scoped(this.db,p,async tx=>{
   await tx.query("SELECT set_config('app.person_id',$1,true)",[p.id]);
   const located=(await tx.query<{project_id:string}>('SELECT project_id FROM intelligence.ai_drafts WHERE id=$1::uuid',[id])).rows[0];
   if(!located||!READ_ROLES.has(projectRole(p,located.project_id))) throw denied();
   const projectId=located.project_id;
   await tx.query("SELECT set_config('app.project_ids',$1,true)",[projectId]);
   // two decisions of one draft take turns: the second reads the first's outcome instead of racing it
   await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[id]);
   const d=(await tx.query<DraftRow>(`${DRAFT_SQL} WHERE d.id=$1::uuid`,[id])).rows[0];
   if(!d) throw denied();
   const input=decideSchema.parse(raw);
   if(d.dec_result) {
    if(d.dec_key===key&&d.dec_by===p.id&&d.dec_result===input.result) return toView(d);
    throw alreadyDecided();
   }
   if(input.valueHash!==d.value_hash) throw new AppError('REVISION_CONFLICT','Nháp đã đổi. Đọc bản mới trước khi quyết định.',409);
   const role=projectRole(p,projectId);
   if(d.entity_type==='document') invariant(mayWriteDocuments(role),'READ_ONLY',READ_ONLY_MESSAGE,403);
   else if(role!=='manager') throw new AppError('MANAGER_REQUIRED','Chỉ điều phối dự án được thực hiện thao tác này.',403);
   let reason='';
   if(input.result==='rejected') {
    reason=(input.reason??'').trim();
    if(reason.length<5) throw new AppError('REASON_REQUIRED','Cần nêu lý do từ chối (ít nhất 5 ký tự).',422);
   } else reason=(input.reason??'').trim();
   let revisionId:string|null=null;
   if(input.result==='confirmed') {
    const manifest=skillManifests[d.signal_type];
    const reasons=new Set<string>();
    if(d.manifest_hash!==manifest.hash) reasons.add('MANIFEST_MISMATCH');
    let recomputed='';
    try {recomputed=sha256(d.value);} catch {recomputed='';}
    if(recomputed!==d.value_hash) reasons.add('VALUE_HASH_MISMATCH');
    let ctx:Awaited<ReturnType<typeof buildSkillContextIn>>|null=null;
    try {
     ctx=await buildSkillContextIn(tx,p,{skill:d.signal_type,projectId,...(d.entity_type==='document'?{documentId:d.entity_id}:{candidateId:d.entity_id})},this.excerptChats);
    } catch(e) {
     if(e instanceof AppError&&(e.code==='SCOPE_DENIED'||e.code==='INVALID_INPUT')) reasons.add('ENTITY_NOT_FOUND'); else throw e;
    }
    if(ctx) {
     if(ctx.pointerOnly) reasons.add('POINTER_ONLY_PROJECT');
     for(const r of checkSkillOutput({name:manifest.name,hash:manifest.hash,toolAllowlist:manifest.toolAllowlist},ctx,d.value).reasons) reasons.add(r);
    }
    if(reasons.size) throw new AppError('DRAFT_HELD',`Nháp được giữ lại, chưa xác nhận được: ${[...reasons].sort().join(', ')}.`,422);
    if(d.entity_type==='document') {
     if(!input.revision) throw new AppError('REVISION_REQUIRED','Nháp gắn tài liệu cần kèm nội dung bản đề xuất.',422);
     revisionId=(await this.documents.proposeRevisionIn(tx,p,d.entity_id,input.revision,key)).record.latest_revision_id;
    } else if(input.revision) throw new AppError('INVALID_INPUT','Nháp gắn ứng viên không kèm bản đề xuất tài liệu.',422);
   }
   const row=(await tx.query<{id:string}>(`INSERT INTO draft_decisions(tenant_id,project_id,draft_id,draft_value_hash,result,reason,document_revision_id,decided_by,command_key,request_id,trace_id)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(draft_id) DO NOTHING RETURNING id`,
    [p.tenantId,projectId,id,d.value_hash,input.result,reason,revisionId,p.id,key,requestId,randomUUID()])).rows[0];
   if(!row) throw alreadyDecided();
   return toView((await tx.query<DraftRow>(`${DRAFT_SQL} WHERE d.id=$1::uuid`,[id])).rows[0]);
  });
 }
}
