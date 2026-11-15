import {afterEach,beforeEach,describe,expect,test,vi} from 'vitest';
import {createHash,randomUUID} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {ZodError} from 'zod';
import {native,openHarness,type Harness} from './slice1-db';
import {bot,member,outsider,pm,seedSlice1,viewer} from './slice1-fixtures';
import {bridgeConfig,chatSales,chatTransport,intakePrincipalId,messageEvent} from './slice2-fixtures';
import {aiPrincipal,mapDomain,proposeRev,registerDoc,reviewer,seedMembers,transportApprover} from './slice3-fixtures';
import {IntakeService} from '../src/server/intake';
import {DependencyService} from '../src/server/document-dependencies';
import {DocumentService} from '../src/server/documents';
import {ids} from '../src/server/identities';
import {canonicalJson,skillManifests} from '../src/server/skills';
import {MAX_OUTPUT_BYTES,type SkillName} from '../src/server/skill-contracts';
import {buildSkillContextIn} from '../src/server/skill-context';
import {SuggestionService} from '../src/server/suggestions';
import {aiScoped} from '../src/server/ai-scope';
import type {AiPrincipal} from '../src/server/ai-scope';
import type {Database,Queryable} from '../src/server/db';
import type {DocumentDetail,Principal} from '../src/server/types';

// The context builder is wrapped, not replaced: one case reads which principal the confirmation context was built for.
vi.mock('../src/server/skill-context',async orig=>{
 const m=await orig<typeof import('../src/server/skill-context')>();
 return {...m,buildSkillContextIn:vi.fn(m.buildSkillContextIn)};
});

// Slice 3, Task 12: an AI draft goes to Z4 only; a person confirms or rejects it; only the person's act creates a Z1 row.
let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);vi.mocked(buildSkillContextIn).mockClear();});
afterEach(async()=>{await h.reset();await h.close();});

type R=Record<string,unknown>;
const NOT_FOUND='Không tìm thấy mục trong phạm vi được cấp.';
const CONFLICT='Mã thao tác đã được dùng với nội dung khác.';
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const n=async(t:string)=>Number((await rows<{n:string}>(`SELECT count(*) n FROM ${t}`))[0].n);
const sha=(v:unknown)=>createHash('sha256').update(canonicalJson(v)).digest('hex');
const k=()=>randomUUID();
const ai:AiPrincipal={id:aiPrincipal.id,tenantId:ids.tenant,projectIds:[ids.sales,ids.transport]};
const chats=[chatSales,chatTransport];
const svc=(aiDb:Database|null=h.operator,excerpt:readonly string[]=chats)=>new SuggestionService(h.db,aiDb,excerpt);
const handle:Database={query:async()=>{throw new Error('handle touched');},transaction:async()=>{throw new Error('handle touched');},close:async()=>{}};
const refused=async(promise:Promise<unknown>,code:string,status:number)=>{
 const e=await promise.then(()=>null,x=>x);
 expect(e,'expected a refusal').toBeTruthy();
 expect(e).toMatchObject({code,status});
 return e as Error;
};
const denied=async(promise:Promise<unknown>)=>{const e=await refused(promise,'SCOPE_DENIED',404);expect(e.message).toBe(NOT_FOUND);};

const RESULTS:Record<string,unknown>={
 intake_analyst:{classification:'incident',duplicateOf:null,missingFields:[]},
 technical_writer:{sections:[],terms:[]},
 ba_elicitation:{userStories:[],rules:[],acceptance:[],unknowns:[]},
};
const out=(skill:SkillName,sources:string[],over:R={}):R=>({skill,manifestHash:skillManifests[skill].hash,sources:sources.map(id=>({id})),claims:[],questions:[],conflicts:[],
 confidence:70,toolRequests:[],result:RESULTS[skill],...over});
const env=(entityType:'intake_candidate'|'document',entityId:string,skill:SkillName,output:R,over:R={}):R=>({skill,projectId:ids.sales,entityType,entityId,output,
 inputHash:'c'.repeat(64),modelVersion:'synthetic-model-1',dedupeKey:'dk-'+randomUUID(),traceId:randomUUID(),...over});

let msgSeq=0;
async function candidate(){
 msgSeq+=1;
 const e=messageEvent({text:`Cổng thanh toán báo lỗi 500 lần ${msgSeq}`,context:{chatId:chatSales}});
 const ack=await new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,{chats:bridgeConfig.intake!.chats,excerptChats:chats}).ingest(e);
 const r=(await rows<{id:string}>('SELECT c.id FROM intake_candidates c JOIN source_events s ON s.chat_id=c.chat_id AND s.thread_key=c.thread_key AND s.project_id=c.project_id WHERE s.id=$1',[ack.sourceEventId]))[0];
 return {sourceEventId:ack.sourceEventId,candidateId:r.id};
}
const fresh=(id:string)=>new DocumentService(h.db).detail(pm,id);
/** A document of the project with one proposed revision. */
async function doc(projectId:string=ids.sales):Promise<DocumentDetail>{return proposeRev(h,pm,await registerDoc(h,pm,{projectId}));}
const revisionBody=(d:DocumentDetail,over:R={}):R=>({expectedVersion:d.record.version,basedOnRevisionId:d.record.latest_revision_id,sourceRevision:null,sourceHash:null,
 sourceModifiedAt:null,changes:{summary:'Thay đổi từ nháp được xác nhận',present:[],missing:[]},sourceRefs:[],...over});

/** A document draft stored through submitDraft. */
async function docDraft(o:{project?:string;sources?:string[];d?:DocumentDetail;output?:R}={}){
 const d=o.d??await doc(o.project??ids.sales);
 const output=o.output??out('technical_writer',o.sources??[d.record.id]);
 const r=await svc().submitDraft(ai,env('document',d.record.id,'technical_writer',output,{projectId:o.project??ids.sales}));
 return {d,output,draftId:r.draftId,valueHash:sha(output)};
}
async function candDraft(o:{claim?:boolean}={}){
 const c=await candidate();
 const output=out('intake_analyst',[c.sourceEventId],o.claim?{claims:[{field:'classification',value:'incident',basis:[c.sourceEventId]}]}:{});
 const r=await svc().submitDraft(ai,env('intake_candidate',c.candidateId,'intake_analyst',output));
 return {...c,output,draftId:r.draftId,valueHash:sha(output)};
}
/** Raw insert by the operational login, as the pipeline would never do: any column may be set. */
async function rawDraft(o:{entityType:'intake_candidate'|'document';entityId:string;skill?:SkillName;project?:string;value?:R;over?:R}):Promise<{id:string;value:R}>{
 const skill=o.skill??(o.entityType==='document'?'technical_writer':'intake_analyst');
 const value=o.value??out(skill,[randomUUID()]);
 const v:R={tenant_id:ids.tenant,project_id:o.project??ids.sales,entity_type:o.entityType,entity_id:o.entityId,signal_type:skill,skill_version:'1.0.0',
  manifest_hash:skillManifests[skill].hash,model_version:'synthetic-model',value:JSON.stringify(value),value_hash:sha(value),sources:JSON.stringify(value.sources),questions:'[]',
  confidence:50,input_hash:'c'.repeat(64),ai_principal_id:ai.id,trace_id:randomUUID(),dedupe_key:'raw-'+randomUUID(),...o.over};
 const cols=Object.keys(v);
 const id=(await rows<{id:string}>(`INSERT INTO intelligence.ai_drafts(${cols.join(',')}) VALUES(${cols.map((c,i)=>`$${i+1}${['value','sources','questions'].includes(c)?'::jsonb':''}`).join(',')}) RETURNING id`,cols.map(c=>v[c])))[0].id;
 return {id,value};
}
const body=(valueHash:string,over:R={}):R=>({result:'confirmed',valueHash,...over});
const decide=(s:SuggestionService,p:Principal,draftId:string,b:R,key:string=k(),req:string=randomUUID())=>s.decide(p,draftId,b,key,req);
const held=async(promise:Promise<unknown>,...reasons:string[])=>{
 const e=await refused(promise,'DRAFT_HELD',422);
 for(const r of reasons) expect(e.message).toContain(r);
 expect(e.message).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/); // codes only: no id
 return e;
};
const zeroDecisions=async()=>expect(await n('draft_decisions')).toBe(0);

describe('Z4 drafts: submit',()=>{
 test('DOC-05 an AI output without sources stays a draft and never reaches Z1',async()=>{
  const {d,draftId,valueHash}=await docDraft({sources:[]});
  const revs=await n('document_revisions'),events=await n('registry_events');
  await held(decide(svc(),pm,draftId,body(valueHash,{revision:revisionBody(d)})),'SOURCE_REQUIRED');
  await zeroDecisions();
  expect(await n('document_revisions')).toBe(revs);expect(await n('registry_events')).toBe(events);
  const l=await svc().list(pm,{projectId:ids.sales,entityType:'document',entityId:d.record.id});
  expect(l.total).toBe(1);expect(l.items[0]).toMatchObject({id:draftId,decision:null,sources:[]});
 });

 test('an invalid output or a foreign manifest hash is refused before anything is stored',async()=>{
  const d=await doc(),before=await n('intelligence.ai_drafts');
  const bad:R[]=[
   {...out('technical_writer',[d.record.id]),surprise:1},
   out('technical_writer',[d.record.id],{manifestHash:'e'.repeat(64)}),
   out('intake_analyst',[d.record.id]),                       // another skill's output under this envelope
   out('technical_writer',[d.record.id],{confidence:101}),
   'not an object' as unknown as R,
  ];
  for(const o of bad) await refused(svc().submitDraft(ai,env('document',d.record.id,'technical_writer',o)),'DRAFT_INVALID',422);
  expect(await n('intelligence.ai_drafts')).toBe(before);
 });

 test.each([['a NUL character','a\u0000b'],['a lone surrogate','a\ud800b']])('an output with %s answers DRAFT_INVALID before any statement reaches the database',async(_n,text)=>{
  const d=await doc();
  const o=out('technical_writer',[d.record.id],{claims:[{field:'f',value:text,basis:[d.record.id]}]});
  const e=await refused(svc(handle).submitDraft(ai,env('document',d.record.id,'technical_writer',o)),'DRAFT_INVALID',422);
  expect((e as {code?:string}).code).not.toMatch(/^22/);
 });

 /** An intake_analyst output whose JSON is exactly `bytes` long, padded by many short elements (the most separators the contract allows). */
 const padded=(sourceId:string,bytes:number):R=>{
  const base=out('intake_analyst',[sourceId]);
  const add=bytes-Buffer.byteLength(JSON.stringify(base));
  const m=Math.floor((add+1)/3),extra=add+1-3*m;
  const items=Array.from({length:m},(_,i)=>i===m-1?'x'.repeat(extra):'');
  const o=out('intake_analyst',[sourceId],{result:{classification:'incident',duplicateOf:null,missingFields:items}});
  expect(Buffer.byteLength(JSON.stringify(o))).toBe(bytes);
  return o;
 };
 test('an output one byte over the limit answers DRAFT_INVALID before any statement reaches the database',async()=>{
  const c=await candidate();
  const e=await refused(svc(handle).submitDraft(ai,env('intake_candidate',c.candidateId,'intake_analyst',padded(c.sourceEventId,MAX_OUTPUT_BYTES+1))),'DRAFT_INVALID',422);
  expect((e as {code?:string}).code).not.toBe('23514');
 });
 test('a valid output at exactly the limit is stored',async()=>{
  const c=await candidate();
  const o=padded(c.sourceEventId,MAX_OUTPUT_BYTES);
  const r=await svc().submitDraft(ai,env('intake_candidate',c.candidateId,'intake_analyst',o));
  expect(r.stored).toBe(true);
  expect((await rows<{value_hash:string}>('SELECT value_hash FROM intelligence.ai_drafts WHERE id=$1',[r.draftId]))[0].value_hash).toBe(sha(o));
 });

 test('without an AI database handle submitDraft answers AI_PIPELINE_DISABLED',async()=>{
  const d=await doc(),e=env('document',d.record.id,'technical_writer',out('technical_writer',[d.record.id]));
  await refused(new SuggestionService(h.db).submitDraft(ai,e),'AI_PIPELINE_DISABLED',503);
  await refused(svc(null).submitDraft(ai,e),'AI_PIPELINE_DISABLED',503);
  expect(await n('intelligence.ai_drafts')).toBe(0);
 });
 test.skipIf(!native)('the runtime role cannot submit a draft',async()=>{
  const d=await doc();
  await expect(new SuggestionService(h.db,h.db).submitDraft(ai,env('document',d.record.id,'technical_writer',out('technical_writer',[d.record.id])))).rejects.toThrow(/permission denied/);
  expect(await n('intelligence.ai_drafts')).toBe(0);
 });

 test('resubmitting the same dedupe key stores one draft; the columns come from the output and the manifest',async()=>{
  const d=await doc(),o=out('technical_writer',[d.record.id],{questions:[{field:'a',question:'Câu hỏi mẫu?'}],confidence:64});
  const e=env('document',d.record.id,'technical_writer',o);
  const a=await svc().submitDraft(ai,e),b=await svc().submitDraft(ai,e);
  expect(a.stored).toBe(true);expect(b).toEqual({draftId:a.draftId,stored:false});
  expect(await n('intelligence.ai_drafts')).toBe(1);
  expect((await rows(`SELECT skill_version,manifest_hash,value_hash,confidence,questions,sources,ai_principal_id FROM intelligence.ai_drafts`))[0]).toMatchObject({
   skill_version:skillManifests.technical_writer.version,manifest_hash:skillManifests.technical_writer.hash,value_hash:sha(o),confidence:64,
   questions:[{field:'a',question:'Câu hỏi mẫu?'}],sources:[{id:d.record.id}],ai_principal_id:ai.id});
 });

 test('R12-a a key used in another project is a conflict, never a success',async()=>{
  const d=await doc(),t=await doc(ids.transport);
  const key='dk-'+randomUUID();
  await svc().submitDraft(ai,env('document',d.record.id,'technical_writer',out('technical_writer',[d.record.id]),{dedupeKey:key}));
  const e=await refused(svc().submitDraft(ai,env('document',t.record.id,'technical_writer',out('technical_writer',[t.record.id]),{projectId:ids.transport,dedupeKey:key})),'IDEMPOTENCY_CONFLICT',409);
  expect(e.message).toBe(CONFLICT);
  expect(await n('intelligence.ai_drafts')).toBe(1);
 });
 test('R12-b the same key with a different output or entity is a conflict; the same content is a replay',async()=>{
  const d=await doc(),d2=await doc();
  const key='dk-'+randomUUID(),o=out('technical_writer',[d.record.id]);
  const first=await svc().submitDraft(ai,env('document',d.record.id,'technical_writer',o,{dedupeKey:key}));
  expect(await svc().submitDraft(ai,env('document',d.record.id,'technical_writer',o,{dedupeKey:key}))).toEqual({draftId:first.draftId,stored:false});
  const e1=await refused(svc().submitDraft(ai,env('document',d.record.id,'technical_writer',out('technical_writer',[d.record.id],{confidence:5}),{dedupeKey:key})),'IDEMPOTENCY_CONFLICT',409);
  expect(e1.message).toBe(CONFLICT);
  await refused(svc().submitDraft(ai,env('document',d2.record.id,'technical_writer',o,{dedupeKey:key})),'IDEMPOTENCY_CONFLICT',409);
  await refused(svc().submitDraft(ai,env('intake_candidate',d.record.id,'ba_elicitation',out('ba_elicitation',[d.record.id]),{dedupeKey:key})),'IDEMPOTENCY_CONFLICT',409);
  expect(await n('intelligence.ai_drafts')).toBe(1);
 });

 test('R12-f a skill and entity pair the context builder could never honour is refused before any statement',async()=>{
  const c=await candidate(),d=await doc();
  await refused(svc(handle).submitDraft(ai,env('intake_candidate',c.candidateId,'technical_writer',out('technical_writer',[c.sourceEventId]))),'DRAFT_INVALID',422);
  await refused(svc(handle).submitDraft(ai,env('document',d.record.id,'intake_analyst',out('intake_analyst',[d.record.id]))),'DRAFT_INVALID',422);
  const good=env('document',d.record.id,'technical_writer',out('technical_writer',[d.record.id]));
  for(const over of [{inputHash:'C'.repeat(64)},{inputHash:'c'.repeat(63)},{modelVersion:''},{modelVersion:'m'.repeat(65)},{modelVersion:'a\u0000b'},{dedupeKey:'short'},{dedupeKey:'has space in it'},{traceId:'nope'},{tenantId:ids.tenant},{aiPrincipalId:ai.id}])
   await expect(svc(handle).submitDraft(ai,{...good,...over}),JSON.stringify(over)).rejects.toBeInstanceOf(ZodError);
  await denied(svc(handle).submitDraft(ai,{...good,projectId:ids.otherProject}));
  await denied(svc(handle).submitDraft({...ai,projectIds:[ids.transport]},good));
  expect(await n('intelligence.ai_drafts')).toBe(0);
 });
 test('an uppercase id is lower-cased at parse time',async()=>{
  const d=await doc();
  const r=await svc().submitDraft(ai,env('document',d.record.id.toUpperCase(),'technical_writer',out('technical_writer',[d.record.id]),{projectId:ids.sales.toUpperCase()}));
  expect((await rows<{entity_id:string}>('SELECT entity_id FROM intelligence.ai_drafts WHERE id=$1',[r.draftId]))[0].entity_id).toBe(d.record.id);
 });
});

describe('Z4 drafts: decide',()=>{
 test('a confirmed document draft creates exactly one revision through the document service and one decision',async()=>{
  const up=await doc(),dep=await doc();
  await new DependencyService(h.db).link(pm,{projectId:ids.sales,upstreamDocumentId:up.record.id,dependentDocumentId:dep.record.id},k(),randomUUID());
  const {draftId,valueHash}=await docDraft({d:up});
  const revs=await n('document_revisions'),key=k(),req=randomUUID();
  const view=await decide(svc(),pm,draftId,body(valueHash,{revision:revisionBody(await fresh(up.record.id))}),key,req);
  expect(await n('document_revisions')).toBe(revs+1);
  const rev=(await rows<{id:string;proposed_by:string}>('SELECT id,proposed_by FROM document_revisions WHERE document_id=$1 ORDER BY revision_no DESC LIMIT 1',[up.record.id]))[0];
  expect(rev.proposed_by).toBe(pm.id);
  const dec=await rows<R>('SELECT * FROM draft_decisions');
  expect(dec).toHaveLength(1);
  expect(dec[0]).toMatchObject({draft_id:draftId,result:'confirmed',document_revision_id:rev.id,decided_by:pm.id,command_key:key,request_id:req,draft_value_hash:valueHash});
  expect(dec[0].trace_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(view.decision).toMatchObject({result:'confirmed',decidedBy:pm.id,documentRevisionId:rev.id});
  expect(await n(`registry_events WHERE kind='revision_proposed' AND entity_id='${rev.id}'`)).toBe(1);
  const flag=await rows<{actor_id:string}>("SELECT actor_id FROM review_events WHERE kind='dependency.flagged'");
  expect(flag).toHaveLength(1);expect(flag[0].actor_id).toBe(pm.id);
  // no event row for the decision itself: the decision row is the record
  expect(await rows("SELECT 1 FROM registry_events WHERE kind LIKE '%draft%'")).toHaveLength(0);
 });

 test('W8 the dependency.flagged event of a confirmed draft carries the decision\'s request id',async()=>{
  const up=await doc(),dep=await doc();
  await new DependencyService(h.db).link(pm,{projectId:ids.sales,upstreamDocumentId:up.record.id,dependentDocumentId:dep.record.id},k(),randomUUID());
  const {draftId,valueHash}=await docDraft({d:up});
  const req=randomUUID();
  await decide(svc(),pm,draftId,body(valueHash,{revision:revisionBody(await fresh(up.record.id))}),k(),req);
  const flag=await rows<{request_id:string}>("SELECT request_id FROM review_events WHERE kind='dependency.flagged'");
  expect(flag).toHaveLength(1);
  const dec=await rows<{request_id:string}>('SELECT request_id FROM draft_decisions');
  expect(dec[0].request_id).toBe(req);
  expect(flag[0].request_id).toBe(dec[0].request_id);
 });

 test('W8 a manual proposal keeps one generated request id for the flag events of its transaction',async()=>{
  const up=await doc(),a=await doc(),b=await doc();
  const links=new DependencyService(h.db);
  await links.link(pm,{projectId:ids.sales,upstreamDocumentId:up.record.id,dependentDocumentId:a.record.id},k(),randomUUID());
  await links.link(pm,{projectId:ids.sales,upstreamDocumentId:up.record.id,dependentDocumentId:b.record.id},k(),randomUUID());
  await proposeRev(h,pm,await new DocumentService(h.db).detail(pm,up.record.id));
  const flags=await rows<{request_id:string}>("SELECT request_id FROM review_events WHERE kind='dependency.flagged'");
  expect(flags).toHaveLength(2);
  expect(flags[0].request_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(flags[1].request_id).toBe(flags[0].request_id);
 });

 test('the confirmer\'s own scope decides: a draft citing a source the confirmer cannot read, a source of another project, or a message whose text is now hidden is held',async()=>{
  const other=await doc(ids.transport),d=await doc();
  const a=await docDraft({d,sources:[other.record.id]});
  const e1=await held(decide(svc(),pm,a.draftId,body(a.valueHash,{revision:revisionBody(d)})),'SOURCE_OUT_OF_CONTEXT');
  expect(e1.message).not.toContain(other.record.id);
  const ghost=randomUUID(),b=await docDraft({d:await doc(),sources:[ghost]});
  await held(decide(svc(),pm,b.draftId,body(b.valueHash,{revision:revisionBody(b.d)})),'SOURCE_OUT_OF_CONTEXT');
  const c=await candidate();
  const co=out('intake_analyst',[c.sourceEventId],{claims:[{field:'classification',value:'incident',basis:[c.sourceEventId]}]});
  const cd=await svc().submitDraft(ai,env('intake_candidate',c.candidateId,'intake_analyst',co));
  // the confirmer's service no longer shows the group's text
  const e3=await held(decide(svc(h.operator,[]),pm,cd.draftId,body(sha(co))),'TEXT_NOT_VISIBLE');
  expect(e3.message).not.toContain(c.sourceEventId);
  await zeroDecisions();
  await decide(svc(),pm,cd.draftId,body(sha(co))); // with the text visible the same draft is confirmed
  expect(await n('draft_decisions')).toBe(1);
 });
 test('the context is built under the confirming person, not a wider principal',async()=>{
  const {d,draftId,valueHash}=await docDraft();
  await decide(svc(),member,draftId,body(valueHash,{revision:revisionBody(await fresh(d.record.id))}));
  const calls=vi.mocked(buildSkillContextIn).mock.calls;
  expect(calls).toHaveLength(1);
  const given=calls[0][1];
  expect(given.id).toBe(member.id);expect(given.role).toBe('engineer');expect(given.projectIds).toEqual(member.projectIds);
  expect(calls[0][2]).toMatchObject({skill:'technical_writer',projectId:ids.sales,documentId:d.record.id});
 });

 test('a draft of an IBS HI project cannot be confirmed',async()=>{
  await mapDomain(h,ids.transport,'IBS_HI',1);
  const d=await doc(ids.transport),{draftId,valueHash}=await docDraft({d,project:ids.transport});
  await held(decide(svc(),pm,draftId,body(valueHash,{revision:revisionBody(d)})),'POINTER_ONLY_PROJECT');
  await zeroDecisions();
 });
 test('a draft built with an older manifest hash is held',async()=>{
  const d=await doc(),r=await rawDraft({entityType:'document',entityId:d.record.id,value:out('technical_writer',[d.record.id]),over:{manifest_hash:'d'.repeat(64)}});
  await held(decide(svc(),pm,r.id,body(sha(r.value),{revision:revisionBody(d)})),'MANIFEST_MISMATCH');
  await zeroDecisions();
 });
 test('R12-g a stored draft whose value_hash does not describe its value is never confirmed',async()=>{
  const d=await doc(),r=await rawDraft({entityType:'document',entityId:d.record.id,value:out('technical_writer',[d.record.id]),over:{value_hash:'f'.repeat(64)}});
  await held(decide(svc(),pm,r.id,body('f'.repeat(64),{revision:revisionBody(d)})),'VALUE_HASH_MISMATCH');
  await refused(decide(svc(),pm,r.id,body('a'.repeat(64),{revision:revisionBody(d)})),'REVISION_CONFLICT',409);
  await zeroDecisions();
 });
 test('R12-i an entity not in the project, or a pair the builder refuses, is held as ENTITY_NOT_FOUND with codes only',async()=>{
  const d=await doc(),t=await doc(ids.transport);
  const gone=await rawDraft({entityType:'document',entityId:randomUUID()});
  const foreign=await rawDraft({entityType:'document',entityId:t.record.id});
  const pair=await rawDraft({entityType:'intake_candidate',entityId:randomUUID(),skill:'technical_writer'});
  for(const x of [gone,foreign,pair]) await held(decide(svc(),pm,x.id,body(sha(x.value),{revision:revisionBody(d)})),'ENTITY_NOT_FOUND');
  await zeroDecisions();
 });

 test('the AI principal cannot decide a draft; bot and viewer cannot list or decide; another project\'s member gets the not-found answer',async()=>{
  const {d,draftId,valueHash}=await docDraft(),tr=await docDraft({project:ids.transport});
  const q={projectId:ids.sales,entityType:'document',entityId:d.record.id};
  const viewerByGrant:Principal={...member,grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}]};
  const b=body(valueHash,{revision:revisionBody(d)});
  await denied(decide(svc(),aiPrincipal as unknown as Principal,draftId,b));
  await denied(decide(svc(),{...ai,role:'bot',name:'x'} as unknown as Principal,draftId,b));
  for(const p of [bot,viewer,viewerByGrant,transportApprover,outsider]) {
   await denied(decide(svc(),p,draftId,b));
   await denied(svc().list(p,q));
  }
  await denied(decide(svc(),viewer,tr.draftId,body(tr.valueHash,{revision:revisionBody(tr.d)})));
  await denied(decide(svc(),pm,'not-a-uuid',b));
  await denied(decide(svc(),pm,randomUUID(),b));
  await denied(svc().list(pm,{...q,projectId:ids.otherProject}));
  await denied(svc().list(pm,{...q,entityId:'nope'}));
  await zeroDecisions();
 });

 test('replaying the same key returns the same decision; a different key answers DRAFT_ALREADY_DECIDED and leaves one decision and one revision',async()=>{
  const {d,draftId,valueHash}=await docDraft(),key=k(),revs=await n('document_revisions');
  const b=body(valueHash,{revision:revisionBody(d)});
  const first=await decide(svc(),pm,draftId,b,key);
  const again=await decide(svc(),pm,draftId,b,key);
  expect(again).toEqual(first);
  await refused(decide(svc(),pm,draftId,b,k()),'DRAFT_ALREADY_DECIDED',409);
  await refused(decide(svc(),pm,draftId,{result:'rejected',valueHash,reason:'Không dùng nữa'},key),'DRAFT_ALREADY_DECIDED',409);
  await refused(decide(svc(),member,draftId,b,key),'DRAFT_ALREADY_DECIDED',409);
  expect(await n('draft_decisions')).toBe(1);expect(await n('document_revisions')).toBe(revs+1);
 });
 test('rejecting needs a reason and creates no revision',async()=>{
  const {d,draftId,valueHash}=await docDraft(),revs=await n('document_revisions'),events=await n('registry_events');
  for(const reason of [undefined,'','abc','    x   ']) await refused(decide(svc(),pm,draftId,{result:'rejected',valueHash,...(reason===undefined?{}:{reason})}),'REASON_REQUIRED',422);
  await expect(decide(svc(),pm,draftId,{result:'rejected',valueHash,reason:'Không dùng nữa',revision:revisionBody(d)})).rejects.toBeInstanceOf(ZodError);
  await zeroDecisions();
  const v=await decide(svc(),pm,draftId,{result:'rejected',valueHash,reason:'  Không phù hợp phạm vi  '});
  expect(v.decision).toMatchObject({result:'rejected',documentRevisionId:null});
  expect(await rows('SELECT reason,document_revision_id FROM draft_decisions')).toEqual([{reason:'Không phù hợp phạm vi',document_revision_id:null}]);
  expect(await n('document_revisions')).toBe(revs);expect(await n('registry_events')).toBe(events);
 });
 test('forged fields are rejected',async()=>{
  const {d,draftId,valueHash}=await docDraft();
  for(const forged of [{decidedBy:pm.id},{tenantId:ids.tenant},{aiPrincipalId:ai.id},{projectId:ids.sales},{requestId:randomUUID()}])
   await expect(decide(svc(),pm,draftId,body(valueHash,{revision:revisionBody(d),...forged})),JSON.stringify(forged)).rejects.toBeInstanceOf(ZodError);
  await expect(decide(svc(),pm,draftId,body(valueHash,{revision:{...revisionBody(d),proposedBy:member.id}}))).rejects.toBeInstanceOf(ZodError);
  await expect(decide(svc(),pm,draftId,body('A'.repeat(64),{revision:revisionBody(d)}))).rejects.toBeInstanceOf(ZodError);
  await expect(decide(svc(),pm,draftId,{result:'maybe',valueHash})).rejects.toBeInstanceOf(ZodError);
  await zeroDecisions();
 });

 test('R12-e authority: a document draft needs the document ledger rule, a candidate draft needs the project manager, for both results',async()=>{
  // document draft: every reading role that may write the ledger passes; the result is the person's own act
  for(const p of [member,reviewer]) {
   const x=await docDraft();
   const v=await decide(svc(),p,x.draftId,body(x.valueHash,{revision:revisionBody(x.d)}));
   expect(v.decision).toMatchObject({result:'confirmed',decidedBy:p.id});
   expect((await rows<{proposed_by:string}>('SELECT proposed_by FROM document_revisions WHERE id=$1',[v.decision!.documentRevisionId]))[0].proposed_by).toBe(p.id);
   const y=await docDraft();
   expect((await decide(svc(),p,y.draftId,{result:'rejected',valueHash:y.valueHash,reason:'Không phù hợp'})).decision?.result).toBe('rejected');
  }
  // a person who cannot write the ledger is answered as a person outside the scope (a viewer is a non-reader, R12-d)
  const w=await docDraft();
  const viewerByGrant:Principal={...member,grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}]};
  await denied(decide(svc(),viewerByGrant,w.draftId,{result:'rejected',valueHash:w.valueHash,reason:'Không phù hợp'}));
  // candidate draft: manager only, confirmed and rejected alike
  const c=await candDraft();
  const decisions=await n('draft_decisions');
  for(const p of [member,reviewer]) {
   const e1=await refused(decide(svc(),p,c.draftId,body(c.valueHash)),'MANAGER_REQUIRED',403);
   expect(e1.message).toBe('Chỉ điều phối dự án được thực hiện thao tác này.');
   await refused(decide(svc(),p,c.draftId,{result:'rejected',valueHash:c.valueHash,reason:'Không phù hợp'}),'MANAGER_REQUIRED',403);
  }
  expect(await n('draft_decisions')).toBe(decisions);
  const ok=await decide(svc(),pm,c.draftId,body(c.valueHash));
  expect(ok.decision).toMatchObject({result:'confirmed',documentRevisionId:null});
  const c2=await candDraft();
  expect((await decide(svc(),pm,c2.draftId,{result:'rejected',valueHash:c2.valueHash,reason:'Không phù hợp'})).decision?.result).toBe('rejected');
  // a candidate draft takes no revision
  const c3=await candDraft();
  await refused(decide(svc(),pm,c3.draftId,body(c3.valueHash,{revision:revisionBody(await doc())})),'INVALID_INPUT',422);
 });
 test('a confirmed document draft needs a revision body',async()=>{
  const {draftId,valueHash}=await docDraft();
  await refused(decide(svc(),pm,draftId,body(valueHash)),'REVISION_REQUIRED',422);
  await zeroDecisions();
 });

 test('step 6 a decision that lost the race answers DRAFT_ALREADY_DECIDED and rolls back the revision it created',async()=>{
  const {d,draftId,valueHash}=await docDraft(),revs=await n('document_revisions'),events=await n('registry_events');
  let fired=false;
  const wrap=(q:Queryable):Queryable=>({query:async<T=R>(sql:string,params?:unknown[])=>{
   if(!fired&&/INSERT INTO draft_decisions/.test(sql)){
    fired=true; // a rival decision lands, inside the same scope, just before ours
    await q.query(`INSERT INTO draft_decisions(tenant_id,project_id,draft_id,draft_value_hash,result,reason,decided_by,command_key,request_id,trace_id)
     VALUES($1,$2,$3,$4,'rejected','Quyết định đối thủ',$5,'rival-key-0001',$6,$7)`,[ids.tenant,ids.sales,draftId,valueHash,pm.id,randomUUID(),randomUUID()]);
   }
   return q.query<T>(sql,params);
  }});
  const racing=new SuggestionService({query:h.db.query.bind(h.db),transaction:fn=>h.db.transaction(tx=>fn(wrap(tx))),close:()=>h.db.close()},h.operator,chats);
  await refused(decide(racing,pm,draftId,body(valueHash,{revision:revisionBody(d)})),'DRAFT_ALREADY_DECIDED',409);
  expect(fired).toBe(true);
  await zeroDecisions();
  expect(await n('document_revisions')).toBe(revs);expect(await n('registry_events')).toBe(events);
 });
});

describe('Z4 drafts: fix round 1',()=>{
 test('F12-1 (i) one key for two drafts about one document, same revision body: the second is IDEMPOTENCY_CONFLICT and writes nothing',async()=>{
  const d=await doc(),a=await docDraft({d}),b=await docDraft({d}),key=k();
  const rev=revisionBody(d);
  await decide(svc(),pm,a.draftId,body(a.valueHash,{revision:rev}),key);
  const revs=await n('document_revisions'),events=await n('registry_events');
  const e=await refused(decide(svc(),pm,b.draftId,body(b.valueHash,{revision:rev}),key),'IDEMPOTENCY_CONFLICT',409);
  expect(e.message).toBe(CONFLICT);
  expect(await n('draft_decisions')).toBe(1);expect(await n('document_revisions')).toBe(revs);expect(await n('registry_events')).toBe(events);
  expect(await rows('SELECT 1 FROM draft_decisions WHERE draft_id=$1',[b.draftId])).toHaveLength(0);
 });
 test('F12-1 (ii) a key first used by a manual proposal, then a draft confirmation with the same body: conflict, no decision',async()=>{
  const d=await doc(),a=await docDraft({d}),key=k(),rev=revisionBody(d);
  await new DocumentService(h.db).proposeRevision(pm,d.record.id,rev,key);
  const revs=await n('document_revisions');
  await refused(decide(svc(),pm,a.draftId,body(a.valueHash,{revision:rev}),key),'IDEMPOTENCY_CONFLICT',409);
  expect(await n('draft_decisions')).toBe(0);expect(await n('document_revisions')).toBe(revs);
 });
 test('F12-1 (iii) a key first used by a draft confirmation, then a manual proposal with the same body: conflict, no second revision',async()=>{
  const d=await doc(),a=await docDraft({d}),key=k(),rev=revisionBody(d);
  await decide(svc(),pm,a.draftId,body(a.valueHash,{revision:rev}),key);
  const revs=await n('document_revisions');
  await refused(new DocumentService(h.db).proposeRevision(pm,d.record.id,rev,key),'IDEMPOTENCY_CONFLICT',409);
  expect(await n('document_revisions')).toBe(revs);expect(await n('draft_decisions')).toBe(1);
 });

 test('F12-2 a message cited only in sources, or only through duplicateOf, is held once its text is hidden; with the text shown the same drafts are confirmed',async()=>{
  const dd=await doc();
  for(const via of ['sources','duplicateOf']) {
   const c=await candidate();
   const o=via==='sources'?out('intake_analyst',[c.sourceEventId])
    :out('intake_analyst',[dd.record.id],{result:{classification:'incident',duplicateOf:c.sourceEventId,missingFields:[]}});
   const r=await svc().submitDraft(ai,env('intake_candidate',c.candidateId,'intake_analyst',o));
   const e=await held(decide(svc(h.operator,[]),pm,r.draftId,body(sha(o))),'TEXT_NOT_VISIBLE');
   expect(e.message).not.toContain(c.sourceEventId);
   expect(await rows('SELECT 1 FROM draft_decisions WHERE draft_id=$1',[r.draftId]),via).toHaveLength(0);
   const ok=await decide(svc(),pm,r.draftId,body(sha(o)));
   expect(ok.decision?.result,via).toBe('confirmed');
  }
 });

 test('M12-2 a stored value that cannot be hashed is VALUE_HASH_MISMATCH; any other error is not swallowed',async()=>{
  const d=await doc(),x=await rawDraft({entityType:'document',entityId:d.record.id,value:out('technical_writer',[d.record.id])});
  const tamper=(make:(row:R)=>void):Database=>({query:h.db.query.bind(h.db),close:()=>h.db.close(),transaction:fn=>h.db.transaction(tx=>fn({query:async<T=R>(sql:string,params?:unknown[])=>{
   const r=await tx.query<T>(sql,params);
   if(/FROM intelligence\.ai_drafts d LEFT JOIN/.test(sql)&&/WHERE d\.id=/.test(sql)) for(const row of r.rows) make(row as R);
   return r;
  }}))});
  // a value that is not a plain object (JSON cannot carry it): the hash does not match
  await held(decide(new SuggestionService(tamper(row=>{row.value=Object.assign(Object.create({}),x.value);}),h.operator,chats),pm,x.id,body(sha(x.value),{revision:revisionBody(d)})),'VALUE_HASH_MISMATCH');
  // an error that is not a TypeError is not swallowed: a toJSON-free value whose key getter throws a RangeError
  const boom=new RangeError('unexpected');
  const hostile=()=>{const o:R={};Object.defineProperty(o,'x',{enumerable:true,get(){throw boom;}});return o;};
  await expect(decide(new SuggestionService(tamper(row=>{row.value=hostile();}),h.operator,chats),pm,x.id,body(sha(x.value),{revision:revisionBody(d)}))).rejects.toBe(boom);
  await zeroDecisions();
 });

 test('M12-5 a malformed id of the AI principal is the module\'s 404, never a raw database error',async()=>{
  const d=await doc(),good=env('document',d.record.id,'technical_writer',out('technical_writer',[d.record.id]));
  for(const bad of [{...ai,id:'not-a-uuid'},{...ai,tenantId:'x'},{...ai,projectIds:[ids.sales,'bad']},{...ai,projectIds:[ids.sales,"x'--"]}])
   await denied(svc().submitDraft(bad,good));
  for(const bad of [{...ai,id:'not-a-uuid'},{...ai,tenantId:'x'},{...ai,projectIds:['bad']}]) await denied(aiScoped(handle,bad,async()=>1));
  await refused(aiScoped(handle,{...ai,projectIds:[]},async()=>1),'UNAUTHENTICATED',401);
  expect(await n('intelligence.ai_drafts')).toBe(0);
 });

 test('replay after a change of role: lost project or viewer is the 404; a manager lowered to engineer gets the recorded view',async()=>{
  const c=await candDraft(),key=k(),first=await decide(svc(),pm,c.draftId,body(c.valueHash),key);
  const b=body(c.valueHash);
  await denied(decide(svc(),{...pm,projectIds:[ids.transport]},c.draftId,b,key));
  await denied(decide(svc(),{...pm,grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}]},c.draftId,b,key));
  const lowered:Principal={...pm,grants:[{projectId:ids.sales,role:'engineer',reportPermissions:[]},{projectId:ids.transport,role:'manager',reportPermissions:[]}]};
  expect(await decide(svc(),lowered,c.draftId,b,key)).toEqual(first);
  expect(await n('draft_decisions')).toBe(1);
 });
});

describe('Z4 drafts: list',()=>{
 test('R12-k strict query, deterministic order, a total over the same filter',async()=>{
  const d=await doc(),d2=await doc();
  const at=(s:string)=>({created_at:s});
  const mk=(e:string,over:R)=>rawDraft({entityType:'document',entityId:e,value:out('technical_writer',[e]),over});
  const a=await mk(d.record.id,at('2026-11-10T10:00:00Z')),b=await mk(d.record.id,at('2026-11-11T10:00:00Z'));
  const c=await mk(d.record.id,at('2026-11-11T10:00:00Z')),other=await mk(d2.record.id,at('2026-11-12T10:00:00Z'));
  const q={projectId:ids.sales,entityType:'document',entityId:d.record.id};
  const all=await svc().list(pm,q);
  const tied=[b.id,c.id].sort().reverse();
  expect(all.total).toBe(3);expect(all.items.map(i=>i.id)).toEqual([...tied,a.id]);
  expect(all.items.map(i=>i.id)).not.toContain(other.id);
  const page=await svc().list(pm,{...q,limit:2,offset:1});
  expect(page.total).toBe(3);expect(page.items.map(i=>i.id)).toEqual([tied[1],a.id]);
  expect(await svc().list(member,q)).toMatchObject({total:3});
  for(const bad of [{...q,limit:0},{...q,limit:201},{...q,offset:-1},{...q,extra:1},{...q,tenantId:ids.tenant},{...q,entityType:'work'}])
   await expect(svc().list(pm,bad),JSON.stringify(bad)).rejects.toBeInstanceOf(ZodError);
  const first=all.items[0];
  expect(Object.keys(first).sort()).toEqual(['confidence','createdAt','decision','entityId','entityType','id','manifestHash','modelVersion','projectId','questions','skill','skillVersion','sources','value','valueHash']);
 });
});

describe('Z4 drafts: boundaries',()=>{
 test('no route imports the suggestion service, and nothing in src builds it with an AI handle',async()=>{
  const walk=async(dir:string):Promise<string[]>=>(await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();
  for(const f of await walk(path.join(process.cwd(),'src/app'))) {
   const t=await readFile(f,'utf8');
   expect(t,f).not.toMatch(/suggestions|ai-scope/);
  }
  for(const f of (await walk(path.join(process.cwd(),'src'))).filter(x=>/\.tsx?$/.test(x)&&!x.endsWith('suggestions.ts'))) {
   expect(await readFile(f,'utf8'),f).not.toMatch(/new SuggestionService\(/);
  }
 });
});
