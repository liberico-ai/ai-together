import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {aiScoped,type AiPrincipal} from './ai-scope';
import {scoped,type Database,type Queryable} from './db';
import {claimDocumentCommand} from './document-commands';
import {READ_ROLES} from './document-review';
import {DocumentService,mayWriteDocuments,proposeSchema,READ_ONLY_MESSAGE} from './documents';
import {AppError,invariant} from './errors';
import {buildSkillContextIn,CONTEXT_KINDS} from './skill-context';
import {checkSkillOutput,MAX_OUTPUT_BYTES,outputFits,outputSchemas,SKILLS,type SkillContext,type SkillName,type SkillOutput} from './skill-contracts';
import {canonicalJson,skillManifests} from './skills';
import {storable} from './text-safety';
import {projectRole} from './types';
import type {Principal,Role} from './types';

// Slice 3, Task 12 (AR-03, E-AI-04): an AI output is written to Z4 (intelligence.ai_drafts) and only there. A person confirms or rejects it;
// the draft's content is never copied into Z1 by this module: the one Z1 content row is the revision the person's own proposal creates.
// No route uses this module and nothing constructs it with an AI database handle (Z4 is not switched on). Nothing here logs a draft.
const NOT_FOUND='Không tìm thấy mục trong phạm vi được cấp.';
const denied=()=>new AppError('SCOPE_DENIED',NOT_FOUND,404);
const draftInvalid=()=>new AppError('DRAFT_INVALID','Đầu ra của kỹ năng không hợp lệ nên không được lưu.',422);
const idempotencyConflict=()=>new AppError('IDEMPOTENCY_CONFLICT','Mã thao tác đã được dùng với nội dung khác.',409);
/** SQLSTATE raised by the pointer-only guard of migration 022. */
export const POINTER_ONLY_SQLSTATE='LTZ01';
const pointerOnlyRefused=()=>new AppError('POINTER_ONLY_PROJECT','Dự án này chỉ nhận con trỏ nên nháp AI không được lưu.',422);
const alreadyDecided=()=>new AppError('DRAFT_ALREADY_DECIDED','Nháp này đã có quyết định.',409);
/** Namespace of the two-integer advisory lock «decision of one draft» (0x44524654, "DRFT"); intake.ts takes the one-bigint form, a different key space. */
export const DRAFT_DECISION_LOCK=0x44524654;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX64=/^[a-f0-9]{64}$/;
const uuidIn=z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).transform(s=>s.toLowerCase());
const lower=z.string().transform(s=>s.toLowerCase());
const ENTITY_TYPES=['intake_candidate','document'] as const;
type EntityType=typeof ENTITY_TYPES[number];

export type MaskReason='CONFIRM_AUTHORITY_REQUIRED'|'ENTITY_NOT_FOUND'|'POINTER_ONLY_PROJECT'|'SCHEMA_INVALID'|'SOURCE_OUT_OF_CONTEXT'|'TEXT_NOT_VISIBLE'|'THREAD_TEXT_HIDDEN';
export type DraftView={
  id:string;projectId:string;entityType:'intake_candidate'|'document';entityId:string;skill:SkillName;createdAt:string;
  manifestHash:string|null;        // the hash of the manifest in force for this skill, or null: never a value the writer chose
  maskReasons:MaskReason[];        // sorted; empty exactly when the content is returned
  sources:{id:string}[];           // value.sources when the content is returned; [] under every mask
  value:SkillOutput|null;questions:{field:string;question:string}[]|null;confidence:number|null;   // from the schema-validated value, or null
  skillVersion:string|null;        // the version of the manifest in force when the row carries exactly it and the content is returned, else null
  modelVersion:string|null;        // as stored, only when the content is returned
  valueHash:string|null;           // null only for a reader who may not decide the draft
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

type DraftRow={id:string;project_id:string;entity_type:EntityType;entity_id:string;signal_type:SkillName;skill_version:string|null;manifest_hash:string|null;model_version:string|null;
  value:unknown;value_hash:string|null;created_at:unknown;
  dec_result:'confirmed'|'rejected'|null;dec_by:string|null;dec_at:unknown;dec_revision:string|null;dec_key:string|null};
/** OQ-45 point 1 (b): the one rule for who may decide a draft, which is also who may read its content. */
const mayDecide=(role:Role,entityType:EntityType)=>entityType==='document'?mayWriteDocuments(role):role==='manager';

/** The hold reasons of the output gate that are about what the reader may read; the others never mask (OQ-45 point 2 (b)). */
const VISIBILITY:ReadonlySet<string>=new Set(['SCHEMA_INVALID','SOURCE_OUT_OF_CONTEXT','TEXT_NOT_VISIBLE']);

const HEAD='d.id,d.project_id,d.entity_type,d.entity_id,d.signal_type,d.created_at';
const DECISION='x.result AS dec_result,x.decided_by AS dec_by,x.created_at AS dec_at,x.document_revision_id AS dec_revision,x.command_key AS dec_key';
const FROM_DRAFTS='FROM intelligence.ai_drafts d LEFT JOIN draft_decisions x ON x.draft_id=d.id';
/** The whole row: for a person who may decide, and for decide itself. The columns `sources`, `questions` and `confidence` are not read by any statement: the value is the one source. */
const DRAFT_SQL=`SELECT ${HEAD},d.manifest_hash,d.skill_version,d.model_version,d.value,d.value_hash,${DECISION} ${FROM_DRAFTS}`;
/** skill → hash of the manifest in force: the one jsonb parameter ($6) of DRAFT_META_SQL. */
const MANIFESTS_IN_FORCE=JSON.stringify(Object.fromEntries(SKILLS.map(s=>[s,skillManifests[s].hash])));
/** For a reader who may not decide: no content column leaves the database, and the manifest hash only when it is the one in force. */
const DRAFT_META_SQL=`SELECT ${HEAD},CASE WHEN d.manifest_hash = ($6::jsonb ->> d.signal_type) THEN d.manifest_hash END AS manifest_hash,
  NULL::text AS skill_version,NULL::text AS model_version,NULL::jsonb AS value,NULL::text AS value_hash,${DECISION} ${FROM_DRAFTS}`;

/** The one place a DraftView is built. With an empty mask `shown` is the schema-validated value and every content field comes from it, never from a column the writer chose. */
const toView=(r:DraftRow,mask:MaskReason[],shown:SkillOutput|null):DraftView=>{
 const m=skillManifests[r.signal_type];
 const head={id:r.id,projectId:r.project_id,entityType:r.entity_type,entityId:r.entity_id,skill:r.signal_type,createdAt:iso(r.created_at),
  manifestHash:r.manifest_hash===m.hash?r.manifest_hash:null,maskReasons:mask,
  decision:r.dec_result?{result:r.dec_result,decidedBy:r.dec_by!,decidedAt:iso(r.dec_at),documentRevisionId:r.dec_revision}:null};
 if(mask.length===0&&shown) return {...head,value:shown,questions:shown.questions,confidence:shown.confidence,sources:shown.sources,
  skillVersion:r.skill_version===m.version?r.skill_version:null,modelVersion:r.model_version,valueHash:r.value_hash};
 return {...head,value:null,questions:null,confidence:null,sources:[],skillVersion:null,modelVersion:null,
  valueHash:mask.includes('CONFIRM_AUTHORITY_REQUIRED')?null:r.value_hash};
};

export class SuggestionService {
 private documents:DocumentService;
 constructor(private db:Database,private aiDb:Database|null=null,private excerptChats:readonly string[]=[]) {this.documents=new DocumentService(db);}

 /** The pipeline's write: one insert under the AI role. Everything that can be refused is refused before the database is touched. */
 async submitDraft(ai:AiPrincipal,raw:unknown):Promise<{draftId:string;stored:boolean}> {
  if(!this.aiDb) throw new AppError('AI_PIPELINE_DISABLED','Đường ghi nháp AI chưa được bật.',503);
  if(!ai||!UUID.test(String(ai.id).toLowerCase())||!UUID.test(String(ai.tenantId).toLowerCase())||!Array.isArray(ai.projectIds)
   ||ai.projectIds.some(x=>!UUID.test(String(x).toLowerCase()))) throw denied();
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
  try {
  return await aiScoped(this.aiDb,{...ai,projectIds:[input.projectId]},async tx=>{
   const row=(await tx.query<{id:string}>(`INSERT INTO intelligence.ai_drafts(tenant_id,project_id,entity_type,entity_id,signal_type,skill_version,manifest_hash,model_version,value,value_hash,
     sources,questions,confidence,input_hash,ai_principal_id,trace_id,dedupe_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17)
     ON CONFLICT(tenant_id,dedupe_key) DO NOTHING RETURNING id`,
    [ai.tenantId,input.projectId,input.entityType,input.entityId,input.skill,manifest.version,manifest.hash,input.modelVersion,JSON.stringify(output),valueHash,
     JSON.stringify(output.sources),JSON.stringify(output.questions),output.confidence,input.inputHash,ai.id,input.traceId,input.dedupeKey])).rows[0];
   if(row) return {draftId:row.id,stored:true};
   // Nothing stored: the key is taken. It is a replay only if the row is visible to this principal and says the same thing: the whole parsed envelope that identifies the
   // draft (project, skill, entity, value hash, input hash, model version) and the skill version and manifest hash the row was written under against the current ones.
   // The trace id belongs to the attempt, not to the draft. The key is unique per tenant across projects.
   const old=(await tx.query<{id:string;project_id:string;signal_type:string;entity_type:string;entity_id:string;value_hash:string;input_hash:string;model_version:string;skill_version:string;manifest_hash:string}>(
    'SELECT id,project_id,signal_type,entity_type,entity_id,value_hash,input_hash,model_version,skill_version,manifest_hash FROM intelligence.ai_drafts WHERE tenant_id=$1 AND dedupe_key=$2',[ai.tenantId,input.dedupeKey])).rows[0];
   if(!old||old.project_id!==input.projectId||old.signal_type!==input.skill||old.entity_type!==input.entityType||old.entity_id!==input.entityId||old.value_hash!==valueHash
    ||old.input_hash!==input.inputHash||old.model_version!==input.modelVersion||old.skill_version!==manifest.version||old.manifest_hash!==manifest.hash) throw idempotencyConflict();
   return {draftId:old.id,stored:false};
  });
  } catch(e) {
   if((e as {code?:string}|null)?.code===POINTER_ONLY_SQLSTATE) throw pointerOnlyRefused();
   throw e;
  }
 }

 /** The context of one draft under this person's rights, or null when the entity is not in the project or the pair cannot be built. Any other error propagates. */
 private async contextFor(tx:Queryable,p:Principal,projectId:string,r:{signal_type:SkillName;entity_type:EntityType;entity_id:string}):Promise<SkillContext|null> {
  try {
   return await buildSkillContextIn(tx,p,{skill:r.signal_type,projectId,...(r.entity_type==='document'?{documentId:r.entity_id}:{candidateId:r.entity_id})},this.excerptChats);
  } catch(e) {
   if(e instanceof AppError&&(e.code==='SCOPE_DENIED'||e.code==='INVALID_INPUT')) return null;
   throw e;
  }
 }

 /**
  * Every DraftView leaves the service through here. A person who may not decide a draft gets one mask reason and no content and no context is built for them.
  * For a person who may, the content is re-checked against the context rebuilt under their own rights: the reasons of the output gate that are about what they may read
  * (and a pointer-only project, a missing entity, a value off the contract) mask it. The context only yields reasons; it never supplies a source id to the answer.
  */
 private async present(tx:Queryable,p:Principal,projectId:string,rows:DraftRow[],contexts:Map<string,SkillContext|null>=new Map()):Promise<DraftView[]> {
  const views:DraftView[]=[];
  for(const r of rows) {
   if(!mayDecide(projectRole(p,projectId),r.entity_type)) {views.push(toView(r,['CONFIRM_AUTHORITY_REQUIRED'],null));continue;}
   const reasons=new Set<MaskReason>();
   const parsed=outputFits(r.value)?outputSchemas[r.signal_type].safeParse(r.value):null;
   if(!parsed?.success) reasons.add('SCHEMA_INVALID');
   const key=`${r.signal_type}:${r.entity_type}:${r.entity_id}`;
   if(!contexts.has(key)) contexts.set(key,await this.contextFor(tx,p,projectId,r));
   const ctx=contexts.get(key)??null;
   if(!ctx) reasons.add('ENTITY_NOT_FOUND');
   else {
    if(ctx.pointerOnly) reasons.add('POINTER_ONLY_PROJECT');
    const m=skillManifests[r.signal_type];
    for(const x of checkSkillOutput({name:m.name,hash:m.hash,toolAllowlist:m.toolAllowlist},ctx,r.value).reasons) if(VISIBILITY.has(x)) reasons.add(x as MaskReason);
   }
   views.push(reasons.size===0&&parsed?.success?toView(r,[],parsed.data):toView(r,[...reasons].sort(),null));
  }
  return views;
 }

 async list(p:Principal,raw:unknown):Promise<{items:DraftView[];total:number}> {
  if(!p||p.role==='bot'||!p.id||!Array.isArray(p.projectIds)) throw denied();
  const peek=(raw as {projectId?:unknown}|null)?.projectId;
  const own=typeof peek==='string'?p.projectIds.find(x=>x.toLowerCase()===peek.toLowerCase()):undefined;
  if(own===undefined||!UUID.test(own.toLowerCase())||!READ_ROLES.has(projectRole(p,own))) throw denied();
  const q=listSchema.parse(raw);
  if(!UUID.test(q.entityId)) throw denied();
  return scoped(this.db,{...p,projectIds:[own]},async tx=>{
   const content=mayDecide(projectRole(p,own),q.entityType);
   const rows=(await tx.query<DraftRow>(`${content?DRAFT_SQL:DRAFT_META_SQL} WHERE d.project_id=$1 AND d.entity_type=$2 AND d.entity_id=$3 ORDER BY d.created_at DESC, d.id DESC LIMIT $4 OFFSET $5`,
    content?[own,q.entityType,q.entityId,q.limit,q.offset]:[own,q.entityType,q.entityId,q.limit,q.offset,MANIFESTS_IN_FORCE])).rows;
   const total=(await tx.query<{n:number}>('SELECT count(*)::int AS n FROM intelligence.ai_drafts WHERE project_id=$1 AND entity_type=$2 AND entity_id=$3',[own,q.entityType,q.entityId])).rows[0].n;
   return {items:await this.present(tx,p,own,rows),total};
  });
 }

 /**
  * Order inside the one scoped transaction: (1) locate the draft in the person's scope, then narrow the scope to its project, lock on the draft id;
  * (2) for a confirmed document draft the document row is locked; (3) the one idempotency claim (replay = the recorded decision, other content = IDEMPOTENCY_CONFLICT);
  * under it: (4) authority first, then already decided, then the caller's valueHash; (5) reason for a rejection, or the holds for a confirmation (nothing is written yet);
  * (6) a document draft: the person's own revision proposal, under the same claim; (7) the decision row. A failure at any point rolls back everything, claim included.
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
   await tx.query('SELECT pg_advisory_xact_lock($1::int,hashtext($2))',[DRAFT_DECISION_LOCK,id]);
   const d=(await tx.query<DraftRow>(`${DRAFT_SQL} WHERE d.id=$1::uuid`,[id])).rows[0];
   if(!d) throw denied();
   const input=decideSchema.parse(raw);
   // a confirmation of a document draft locks the document row before the claim, the order a manual proposal has (row, then claim): two commands with one key cannot wait on each other
   if(d.entity_type==='document'&&input.result==='confirmed') await tx.query('SELECT 1 FROM document_records WHERE id=$1::uuid AND project_id=$2::uuid FOR UPDATE',[d.entity_id,projectId]);
   // ONE idempotency claim for every decision. The fingerprint is the operation, the draft and the whole parsed command (result, valueHash, reason, revision):
   // the same person, key and content replay the recorded outcome (the decision's id; the view is read again); the same key with other content is IDEMPOTENCY_CONFLICT.
   // Anything thrown below rolls the claim back with the rest, so a refusal or a hold leaves the key free.
   // the context built to hold or confirm is reused for the answer; a rejection or a replay has none and present builds its own
   const contexts=new Map<string,SkillContext|null>();
   await claimDocumentCommand(tx,p,projectId,key,{op:'draft.decide',draftId:id,...input},async()=>{
    // authority first: a person who may not decide learns nothing from the draft's state or from the hash they sent (OQ-45 point 1)
    if(!mayDecide(projectRole(p,projectId),d.entity_type)) {
     if(d.entity_type==='document') throw new AppError('READ_ONLY',READ_ONLY_MESSAGE,403);
     throw new AppError('MANAGER_REQUIRED','Chỉ điều phối dự án được thực hiện thao tác này.',403);
    }
    if(d.dec_result) throw alreadyDecided();
    if(input.valueHash!==d.value_hash) throw new AppError('REVISION_CONFLICT','Nháp đã đổi. Đọc bản mới trước khi quyết định.',409);
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
     try {recomputed=sha256(d.value);} catch(e) {
      // canonicalJson throws TypeError for a value JSON cannot carry (not a plain object, non-finite number): a stored value that cannot be hashed does not match its hash.
      // Anything else is not understood here and propagates.
      if(!(e instanceof TypeError)) throw e;
     }
     if(recomputed!==d.value_hash) reasons.add('VALUE_HASH_MISMATCH');
     const ctx=await this.contextFor(tx,p,projectId,d);
     contexts.set(`${d.signal_type}:${d.entity_type}:${d.entity_id}`,ctx);
     if(!ctx) reasons.add('ENTITY_NOT_FOUND');
     if(ctx) {
      if(ctx.pointerOnly) reasons.add('POINTER_ONLY_PROJECT');
      for(const r of checkSkillOutput({name:manifest.name,hash:manifest.hash,toolAllowlist:manifest.toolAllowlist},ctx,d.value).reasons) reasons.add(r);
     }
     if(reasons.size) throw new AppError('DRAFT_HELD',`Nháp được giữ lại, chưa xác nhận được: ${[...reasons].sort().join(', ')}.`,422);
     if(d.entity_type==='document') {
      if(!input.revision) throw new AppError('REVISION_REQUIRED','Nháp gắn tài liệu cần kèm nội dung bản đề xuất.',422);
      // the inner proposal runs under the claim held above and claims nothing itself
      revisionId=(await this.documents.proposeRevisionIn(tx,p,d.entity_id,input.revision,key,{draftId:id},requestId,{claimHeld:true})).record.latest_revision_id;
     } else if(input.revision) throw new AppError('INVALID_INPUT','Nháp gắn ứng viên không kèm bản đề xuất tài liệu.',422);
    }
    const row=(await tx.query<{id:string}>(`INSERT INTO draft_decisions(tenant_id,project_id,draft_id,draft_value_hash,result,reason,document_revision_id,decided_by,command_key,request_id,trace_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(draft_id) DO NOTHING RETURNING id`,
     [p.tenantId,projectId,id,d.value_hash,input.result,reason,revisionId,p.id,key,requestId,randomUUID()])).rows[0];
    if(!row) throw alreadyDecided();
    return {decisionId:row.id};
   });
   // the stored idempotent response holds the decision's id only; the view is always read again
   const view=(await tx.query<DraftRow>(`${DRAFT_SQL} WHERE d.id=$1::uuid`,[id])).rows[0];
   if(!view||!view.dec_result) throw denied();
   return (await this.present(tx,p,projectId,[view],contexts))[0];
  });
 }
}
