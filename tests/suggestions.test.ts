import {afterEach,beforeEach,describe,expect,test,vi} from 'vitest';
import {createHash,randomUUID} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {ZodError} from 'zod';
import {native,openHarness,type Harness} from './slice1-db';
import {bot,member,outsider,pm,seedSlice1,viewer} from './slice1-fixtures';
import {bridgeConfig,chatSales,chatTransport,intakePrincipalId,messageEvent} from './slice2-fixtures';
import {aiPrincipal,approver,mapDomain,proposeRev,recordingDb,registerDoc,reviewer,seedMembers,transportApprover} from './slice3-fixtures';
import {IntakeService} from '../src/server/intake';
import {DependencyService} from '../src/server/document-dependencies';
import {DocumentService} from '../src/server/documents';
import {ids} from '../src/server/identities';
import {canonicalJson,skillManifests} from '../src/server/skills';
import {AppError} from '../src/server/errors';
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
async function candidate(o:{excerpt?:boolean}={}){
 msgSeq+=1;
 const e=messageEvent({text:`Cổng thanh toán báo lỗi 500 lần ${msgSeq}`,context:{chatId:chatSales}});
 const ack=await new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,{chats:bridgeConfig.intake!.chats,excerptChats:o.excerpt===false?[]:chats}).ingest(e);
 const r=(await rows<{id:string}>('SELECT c.id FROM intake_candidates c JOIN source_events s ON s.chat_id=c.chat_id AND s.thread_key=c.thread_key AND s.project_id=c.project_id WHERE s.id=$1',[ack.sourceEventId]))[0];
 return {sourceEventId:ack.sourceEventId,candidateId:r.id,event:e};
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

 test('D5 the replay covers the whole envelope: another inputHash or another modelVersion under the same key is a conflict; identical is the same draft id',async()=>{
  const d=await doc(),key='dk-'+randomUUID(),o=out('technical_writer',[d.record.id]);
  const e=(over:R={})=>env('document',d.record.id,'technical_writer',o,{dedupeKey:key,...over});
  const first=await svc().submitDraft(ai,e());
  expect(await svc().submitDraft(ai,e())).toEqual({draftId:first.draftId,stored:false});
  const err1=await refused(svc().submitDraft(ai,e({inputHash:'d'.repeat(64)})),'IDEMPOTENCY_CONFLICT',409);
  expect(err1.message).toBe(CONFLICT);
  await refused(svc().submitDraft(ai,e({modelVersion:'synthetic-model-2'})),'IDEMPOTENCY_CONFLICT',409);
  // the trace id is per attempt and is not part of the identity of the draft
  expect(await svc().submitDraft(ai,e({traceId:randomUUID()}))).toEqual({draftId:first.draftId,stored:false});
  // the skill version and manifest hash on the stored row are compared with the current ones: a row written under an older skill is not this envelope
  for(const [col,val] of [['skill_version','0.0.1'],['manifest_hash','e'.repeat(64)]] as const) {
   const key2='dk-'+randomUUID();
   await rawDraft({entityType:'document',entityId:d.record.id,value:o,over:{dedupe_key:key2,input_hash:'c'.repeat(64),model_version:'synthetic-model-1',[col]:val}});
   await refused(svc().submitDraft(ai,e({dedupeKey:key2})),'IDEMPOTENCY_CONFLICT',409);
  }
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
  await new DependencyService(h.db).link(pm,{projectId:ids.sales,upstreamDocumentId:up.record.id,upstreamRevisionId:up.record.latest_revision_id,dependentDocumentId:dep.record.id},k(),randomUUID());
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
  await new DependencyService(h.db).link(pm,{projectId:ids.sales,upstreamDocumentId:up.record.id,upstreamRevisionId:up.record.latest_revision_id,dependentDocumentId:dep.record.id},k(),randomUUID());
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
  await links.link(pm,{projectId:ids.sales,upstreamDocumentId:up.record.id,upstreamRevisionId:up.record.latest_revision_id,dependentDocumentId:a.record.id},k(),randomUUID());
  await links.link(pm,{projectId:ids.sales,upstreamDocumentId:up.record.id,upstreamRevisionId:up.record.latest_revision_id,dependentDocumentId:b.record.id},k(),randomUUID());
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
  const d=await doc(ids.transport),{draftId,valueHash}=await docDraft({d,project:ids.transport});
  await mapDomain(h,ids.transport,'IBS_HI',1);
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
  // same person, same key, other content: the key's claim answers (round-1 fix of the Codex gate; it was DRAFT_ALREADY_DECIDED)
  await refused(decide(svc(),pm,draftId,{result:'rejected',valueHash,reason:'Không dùng nữa'},key),'IDEMPOTENCY_CONFLICT',409);
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

 test('replay after a change of role: lost project or viewer is the 404; a manager lowered to engineer gets the recorded decision without the content',async()=>{
  const c=await candDraft(),key=k(),first=await decide(svc(),pm,c.draftId,body(c.valueHash),key);
  const b=body(c.valueHash);
  await denied(decide(svc(),{...pm,projectIds:[ids.transport]},c.draftId,b,key));
  await denied(decide(svc(),{...pm,grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}]},c.draftId,b,key));
  const lowered:Principal={...pm,grants:[{projectId:ids.sales,role:'engineer',reportPermissions:[]},{projectId:ids.transport,role:'manager',reportPermissions:[]}]};
  expect(await decide(svc(),lowered,c.draftId,b,key)).toEqual({...first,sources:[],value:null,questions:null,confidence:null,skillVersion:null,modelVersion:null,valueHash:null,
   maskReasons:['CONFIRM_AUTHORITY_REQUIRED']});
  expect(await n('draft_decisions')).toBe(1);
 });
});

describe('Z4 drafts: one idempotency claim per decision (Codex gate, round 1)',()=>{
 const claims=()=>n('document_commands');
 const confirmBody=(x:{d:DocumentDetail;valueHash:string},over:R={},rev:R={})=>body(x.valueHash,{revision:revisionBody(x.d,rev),...over});
 test('(a) the same key and the same body replay the recorded decision: one decision row, one revision, one claim',async()=>{
  const x=await docDraft(),key=k(),revs=await n('document_revisions'),b=confirmBody(x);
  const first=await decide(svc(),pm,x.draftId,b,key);
  const claimsAfter=await claims();
  const again=await decide(svc(),pm,x.draftId,b,key);
  expect(again).toEqual(first);
  expect(await n('draft_decisions')).toBe(1);expect(await n('document_revisions')).toBe(revs+1);expect(await claims()).toBe(claimsAfter);
  expect(claimsAfter).toBeGreaterThan(0);
  // the stored response is the decision's id only; the view is read again
  const stored=(await rows<{response:R}>('SELECT response FROM document_commands WHERE command_key=$1',[key]))[0].response;
  expect(Object.keys(stored)).toEqual(['decisionId']);
  expect(stored.decisionId).toBe((await rows<{id:string}>('SELECT id FROM draft_decisions'))[0].id);
 });
 test('(b) the same key with another valueHash is IDEMPOTENCY_CONFLICT, not the old decision',async()=>{
  const x=await docDraft(),key=k();
  await decide(svc(),pm,x.draftId,confirmBody(x),key);
  const before=[await n('draft_decisions'),await n('document_revisions'),await claims()];
  const e=await refused(decide(svc(),pm,x.draftId,{...confirmBody(x),valueHash:'f'.repeat(64)},key),'IDEMPOTENCY_CONFLICT',409);
  expect(e.message).toBe(CONFLICT);
  expect([await n('draft_decisions'),await n('document_revisions'),await claims()]).toEqual(before);
 });
 test('(c) the same key with a changed revision body is IDEMPOTENCY_CONFLICT',async()=>{
  const x=await docDraft(),key=k();
  await decide(svc(),pm,x.draftId,confirmBody(x),key);
  const before=[await n('draft_decisions'),await n('document_revisions'),await claims()];
  await refused(decide(svc(),pm,x.draftId,confirmBody(x,{},{changes:{summary:'Tóm tắt khác hẳn bản đầu',present:[],missing:[]}}),key),'IDEMPOTENCY_CONFLICT',409);
  expect([await n('draft_decisions'),await n('document_revisions'),await claims()]).toEqual(before);
 });
 test('(d) a rejection claims its key: the same body replays, another reason or another result is IDEMPOTENCY_CONFLICT',async()=>{
  const x=await docDraft(),key=k();
  const rej=(reason:string)=>({result:'rejected',valueHash:x.valueHash,reason});
  const base=await claims();
  const first=await decide(svc(),pm,x.draftId,rej('Không phù hợp phạm vi'),key);
  expect(await claims()).toBe(base+1);
  expect(await decide(svc(),pm,x.draftId,rej('Không phù hợp phạm vi'),key)).toEqual(first);
  await refused(decide(svc(),pm,x.draftId,rej('Một lý do hoàn toàn khác'),key),'IDEMPOTENCY_CONFLICT',409);
  await refused(decide(svc(),pm,x.draftId,confirmBody(x),key),'IDEMPOTENCY_CONFLICT',409);
  expect(await n('draft_decisions')).toBe(1);expect(await claims()).toBe(base+1);
 });
 test('(e) a rejection and a candidate confirmation now claim their key: the same person reusing it for another draft is IDEMPOTENCY_CONFLICT',async()=>{
  const a=await docDraft(),b=await docDraft(),key=k(),base=await claims();
  await decide(svc(),pm,a.draftId,{result:'rejected',valueHash:a.valueHash,reason:'Không phù hợp phạm vi'},key);
  expect(await claims()).toBe(base+1);
  await refused(decide(svc(),pm,b.draftId,{result:'rejected',valueHash:b.valueHash,reason:'Không phù hợp phạm vi'},key),'IDEMPOTENCY_CONFLICT',409);
  expect(await n('draft_decisions')).toBe(1);
  const c1=await candDraft(),c2=await candDraft(),key2=k();
  await decide(svc(),pm,c1.draftId,body(c1.valueHash),key2);
  expect(await claims()).toBe(base+2);
  await refused(decide(svc(),pm,c2.draftId,body(c2.valueHash),key2),'IDEMPOTENCY_CONFLICT',409);
  await refused(decide(svc(),pm,c2.draftId,{result:'rejected',valueHash:c2.valueHash,reason:'Không phù hợp phạm vi'},key2),'IDEMPOTENCY_CONFLICT',409);
  expect(await n('draft_decisions')).toBe(2);expect(await rows('SELECT 1 FROM draft_decisions WHERE draft_id=$1',[c2.draftId])).toHaveLength(0);
  // the key space is per person and across projects: the key of a candidate decision is taken for a manual proposal too
  const d=await doc();
  await refused(new DocumentService(h.db).proposeRevision(pm,d.record.id,revisionBody(d),key2),'IDEMPOTENCY_CONFLICT',409);
 });
 test('(f) another person sending the same key string gets DRAFT_ALREADY_DECIDED and leaves no claim',async()=>{
  const x=await docDraft(),key=k();
  await decide(svc(),pm,x.draftId,confirmBody(x),key);
  const before=await claims();
  await refused(decide(svc(),member,x.draftId,confirmBody(x),key),'DRAFT_ALREADY_DECIDED',409);
  await refused(decide(svc(),member,x.draftId,{result:'rejected',valueHash:x.valueHash,reason:'Không phù hợp phạm vi'},key),'DRAFT_ALREADY_DECIDED',409);
  expect(await claims()).toBe(before);
  // and the same person with another key: the draft is decided
  await refused(decide(svc(),pm,x.draftId,confirmBody(x),k()),'DRAFT_ALREADY_DECIDED',409);
  expect(await claims()).toBe(before);expect(await n('draft_decisions')).toBe(1);
 });
 test('(g) a held confirmation leaves its key free: the same key then works for a later valid command',async()=>{
  const d=await doc(),bad=await rawDraft({entityType:'document',entityId:d.record.id,value:out('technical_writer',[d.record.id]),over:{manifest_hash:'d'.repeat(64)}});
  const key=k(),before=await claims();
  await held(decide(svc(),pm,bad.id,body(sha(bad.value),{revision:revisionBody(d)}),key),'MANIFEST_MISMATCH');
  expect(await claims()).toBe(before);expect(await n('draft_decisions')).toBe(0);
  // other refusals roll the claim back too
  await refused(decide(svc(),pm,bad.id,{result:'rejected',valueHash:sha(bad.value),reason:'abc'},key),'REASON_REQUIRED',422);
  await refused(decide(svc(),pm,bad.id,body('f'.repeat(64),{revision:revisionBody(d)}),key),'REVISION_CONFLICT',409);
  expect(await claims()).toBe(before);
  const ok=await docDraft({d:await fresh(d.record.id)});
  expect((await decide(svc(),pm,ok.draftId,body(ok.valueHash,{revision:revisionBody(await fresh(d.record.id))}),key)).decision?.result).toBe('confirmed');
  expect(await claims()).toBe(before+1);
 });
 test('the inner proposal runs under the claim of the decision: one claim row for the key, whose payload names the draft',async()=>{
  const x=await docDraft(),key=k();
  await decide(svc(),pm,x.draftId,confirmBody(x),key);
  expect(await rows('SELECT 1 FROM document_commands WHERE command_key=$1',[key])).toHaveLength(1);
  expect(await rows("SELECT 1 FROM registry_events WHERE command_key=$1 AND kind='revision_proposed'",[key])).toHaveLength(1);
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
  expect(Object.keys(first).sort()).toEqual(['confidence','createdAt','decision','entityId','entityType','id','manifestHash','maskReasons','modelVersion','projectId','questions','skill','skillVersion','sources','value','valueHash']);
 });
});

describe('Z4 drafts: who reads the content (OQ-45 point 1)',()=>{
 const MARK='zq-mark-'+randomUUID().replace(/-/g,'');
 const q=(entityType:'intake_candidate'|'document',entityId:string)=>({projectId:ids.sales,entityType,entityId});
 const viewerByGrant:Principal={...member,grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}]};
 const loud=async()=>{
  const c=await candidate();
  const output=out('intake_analyst',[c.sourceEventId],{claims:[{field:'classification',value:MARK,basis:[c.sourceEventId]}],questions:[{field:'classification',question:MARK}]});
  const r=await svc().submitDraft(ai,env('intake_candidate',c.candidateId,'intake_analyst',output));
  return {...c,output,draftId:r.draftId};
 };
 const uuidFrom=(i:number)=>{const x=createHash('sha256').update(MARK+i).digest('hex');return `${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20,32)}`;};

 test('L1 a candidate draft: only the project manager reads its content; engineer, technical and business get no content, no source id and no hash',async()=>{
  const x=await loud(),m=skillManifests.intake_analyst;
  const mine=(await svc().list(pm,q('intake_candidate',x.candidateId))).items[0] as unknown as R;
  expect(mine.value).toEqual(x.output);expect(mine.maskReasons).toEqual([]);
  expect(JSON.stringify(mine.questions)).toContain(MARK);expect(mine.confidence).toBe(70);expect(mine.sources).toEqual(x.output.sources);
  expect(mine.skillVersion).toBe(m.version);expect(mine.modelVersion).toBe('synthetic-model-1');expect(mine.valueHash).toBe(sha(x.output));expect(mine.manifestHash).toBe(m.hash);
  for(const p of [member,reviewer,approver]) {
   const l=await svc().list(p,q('intake_candidate',x.candidateId));
   expect(l.total).toBe(1);
   expect(l.items[0]).toEqual({id:x.draftId,projectId:ids.sales,entityType:'intake_candidate',entityId:x.candidateId,skill:'intake_analyst',manifestHash:m.hash,createdAt:expect.any(String),
    sources:[],maskReasons:['CONFIRM_AUTHORITY_REQUIRED'],value:null,questions:null,confidence:null,skillVersion:null,modelVersion:null,valueHash:null,decision:null});
   const text=JSON.stringify(l);
   expect(text).not.toContain(MARK);expect(text).not.toContain(x.sourceEventId);
  }
 });

 test('L2 a document draft: every role that may write the ledger reads its content; viewer and bot get the not-found answer for both kinds of draft',async()=>{
  const d=await docDraft(),c=await candDraft();
  for(const p of [pm,member,reviewer,approver]) {
   const it=(await svc().list(p,q('document',d.d.record.id))).items[0] as unknown as R;
   expect(it.value).toEqual(d.output);expect(it.maskReasons).toEqual([]);
  }
  const bots={...ai,role:'bot',name:'x',projectIds:[ids.sales]} as unknown as Principal;
  for(const p of [viewerByGrant,bots,bot,outsider,transportApprover]) {
   await denied(svc().list(p,q('document',d.d.record.id)));
   await denied(svc().list(p,q('intake_candidate',c.candidateId)));
  }
 });

 test('L3 nothing the writer chose reaches the service for a reader without the authority: no value, question, confidence, version string, hash or source id in any row handed to it',async()=>{
  const x=await loud(),rec=recordingDb(h.db);
  await new SuggestionService(rec.db,h.operator,chats).list(member,q('intake_candidate',x.candidateId));
  const seen=JSON.stringify(rec.rows());
  expect(seen).not.toContain(MARK);expect(seen).not.toContain(sha(x.output));expect(seen).not.toContain('synthetic-model-1');expect(seen).not.toContain(x.sourceEventId);
 });

 test('L4 a reader without the authority gets no bits the writer chose: sources is empty and manifestHash is the current manifest\'s or null',async()=>{
  const c=await candidate(),codes=Array.from({length:100},(_,i)=>uuidFrom(i)),hex=createHash('sha256').update(MARK).digest('hex');
  const bad=await rawDraft({entityType:'intake_candidate',entityId:c.candidateId,over:{sources:JSON.stringify(codes.map(id=>({id}))),manifest_hash:hex}});
  const good=await rawDraft({entityType:'intake_candidate',entityId:c.candidateId});
  const rec=recordingDb(h.db);
  const l=await new SuggestionService(rec.db,h.operator,chats).list(member,q('intake_candidate',c.candidateId));
  const byId=(id:string)=>l.items.find(i=>i.id===id) as unknown as R;
  expect(byId(bad.id)).toMatchObject({sources:[],manifestHash:null});
  expect(byId(good.id)).toMatchObject({sources:[],manifestHash:skillManifests.intake_analyst.hash});
  for(const text of [JSON.stringify(l),JSON.stringify(rec.rows())]) {
   for(const code of codes) expect(text).not.toContain(code);
   expect(text).not.toContain(hex);
  }
 });

 test('L5 masking changes no row count and no order: the list and the total are the same for every reader',async()=>{
  const c=await candidate();
  const ids3:string[]=[];
  for(const at of ['2026-11-10T10:00:00Z','2026-11-12T10:00:00Z','2026-11-11T10:00:00Z']) ids3.push((await rawDraft({entityType:'intake_candidate',entityId:c.candidateId,over:{created_at:at}})).id);
  const a=await svc().list(pm,q('intake_candidate',c.candidateId)),b=await svc().list(member,q('intake_candidate',c.candidateId));
  expect(a.total).toBe(3);expect(b.total).toBe(3);
  expect(a.items.map(i=>i.id)).toEqual([ids3[1],ids3[2],ids3[0]]);
  expect(b.items.map(i=>i.id)).toEqual(a.items.map(i=>i.id));
 });

 test('L6 one rule for reading and deciding: a role reads the content of a draft exactly when it may decide it',async()=>{
  for(const p of [pm,member,reviewer,approver]) for(const kind of ['document','intake_candidate'] as const) {
   const x=kind==='document'?await docDraft():await candDraft();
   const entityId=kind==='document'?(x as Awaited<ReturnType<typeof docDraft>>).d.record.id:(x as Awaited<ReturnType<typeof candDraft>>).candidateId;
   const row=(await svc().list(p,q(kind,entityId))).items[0] as unknown as R;
   const e=await decide(svc(),p,x.draftId,{result:'rejected',valueHash:x.valueHash,reason:'Không phù hợp phạm vi'}).then(()=>null,y=>y as {code?:string});
   const refusedByAuthority=e!==null&&(e.code==='READ_ONLY'||e.code==='MANAGER_REQUIRED');
   expect((row.maskReasons as unknown[]|undefined)?.length===0,`${p.role} ${kind}`).toBe(!refusedByAuthority);
  }
 });

 test('L7 when the content is returned every displayed field comes from the validated value: a row whose questions, confidence and sources columns say otherwise shows the value\'s; skillVersion and manifestHash only when they are the manifest\'s in force',async()=>{
  const d=await doc(),value=out('technical_writer',[d.record.id]);
  const x=await rawDraft({entityType:'document',entityId:d.record.id,value,over:{questions:JSON.stringify([{field:'x',question:MARK}]),confidence:5,sources:JSON.stringify([{id:randomUUID()}]),
   skill_version:'9.9.9',manifest_hash:'d'.repeat(64)}});
  const l=await svc().list(pm,q('document',d.record.id));
  const it=l.items.find(i=>i.id===x.id) as unknown as R;
  expect(it.maskReasons).toEqual([]);expect(it.questions).toEqual([]);expect(it.confidence).toBe(70);expect(it.sources).toEqual(value.sources);
  expect(it.skillVersion).toBeNull();expect(it.manifestHash).toBeNull();expect(it.modelVersion).toBe('synthetic-model');
  expect(JSON.stringify(l)).not.toContain(MARK);
 });

 test('L8 decide answers a reader without the authority the same way whatever valueHash is sent and whether or not the draft is decided',async()=>{
  const x=await candDraft(),before=await n('document_commands');
  const same=async(valueHash:string)=>{
   for(const b of [{result:'confirmed',valueHash},{result:'rejected',valueHash,reason:'Không phù hợp phạm vi'}]) {
    const e=await refused(decide(svc(),member,x.draftId,b),'MANAGER_REQUIRED',403);
    expect(e.message).toBe('Chỉ điều phối dự án được thực hiện thao tác này.');
   }
  };
  await same('a'.repeat(64));await same(x.valueHash);
  expect(await n('document_commands')).toBe(before);
  await decide(svc(),pm,x.draftId,body(x.valueHash));
  const after=await n('document_commands');
  await same('a'.repeat(64));await same(x.valueHash);
  expect(await n('document_commands')).toBe(after);expect(await n('draft_decisions')).toBe(1);
 });

 test('L9 a stored value that does not fit the contract is masked as SCHEMA_INVALID even for a person who may decide',async()=>{
  const c=await candidate();
  const x=await rawDraft({entityType:'intake_candidate',entityId:c.candidateId,value:{...out('intake_analyst',[c.sourceEventId]),surprise:MARK}});
  const l=await svc().list(pm,q('intake_candidate',c.candidateId));
  const it=l.items.find(i=>i.id===x.id) as unknown as R;
  expect(it).toMatchObject({maskReasons:['SCHEMA_INVALID'],value:null,sources:[]});
  expect(JSON.stringify(l)).not.toContain(MARK);
 });
});

describe('Z4 drafts: the content is re-checked at read time (OQ-45 point 2)',()=>{
 const MARK='zq-read-'+randomUUID().replace(/-/g,'');
 const q=(entityType:'intake_candidate'|'document',entityId:string)=>({projectId:ids.sales,entityType,entityId});
 const loudOut=(c:{sourceEventId:string})=>out('intake_analyst',[c.sourceEventId],{claims:[{field:'classification',value:MARK,basis:[c.sourceEventId]}],questions:[{field:'classification',question:MARK}]});
 const loudDraft=async(o:{excerpt?:boolean}={})=>{
  const c=await candidate(o),output=loudOut(c);
  const r=await svc().submitDraft(ai,env('intake_candidate',c.candidateId,'intake_analyst',output));
  return {...c,output,draftId:r.draftId,valueHash:sha(output)};
 };
 const one=async(s:SuggestionService,p:Principal,entityType:'intake_candidate'|'document',entityId:string)=>{
  const l=await s.list(p,q(entityType,entityId));
  return {l,it:l.items[0] as unknown as R};
 };

 test('M1 the content is masked when the reader cannot read the text of a message the draft cites',async()=>{
  const a=await loudDraft({excerpt:false});
  const {l,it}=await one(svc(),pm,'intake_candidate',a.candidateId);
  expect(it).toMatchObject({maskReasons:['TEXT_NOT_VISIBLE'],value:null,questions:null,confidence:null,skillVersion:null,modelVersion:null,sources:[],valueHash:sha(a.output)});
  expect(JSON.stringify(l)).not.toContain(MARK);expect(JSON.stringify(l)).not.toContain(a.sourceEventId);
  const b=await loudDraft();
  for(const s of [svc(h.operator,[]),new SuggestionService(h.db)]) {
   const x=await one(s,pm,'intake_candidate',b.candidateId);
   expect(x.it.maskReasons).toContain('TEXT_NOT_VISIBLE');expect(x.it.value).toBeNull();
   expect(JSON.stringify(x.l)).not.toContain(MARK);
  }
  const ok=await one(svc(),pm,'intake_candidate',b.candidateId);
  expect(ok.it.maskReasons).toEqual([]);expect(JSON.stringify(ok.it.value)).toContain(MARK);
 });

 test('M2 the content is masked once the project is pointer-only: mapped to IBS_HI after the draft was stored, for a document draft and a candidate draft; the latest row decides',async()=>{
  const d=await docDraft(),c=await candDraft();
  await mapDomain(h,ids.sales,'IBS_HI',1);
  for(const [t,id] of [['document',d.d.record.id],['intake_candidate',c.candidateId]] as const) {
   const {it}=await one(svc(),pm,t,id);
   expect(it.value,t).toBeNull();expect(it.maskReasons,t).toContain('POINTER_ONLY_PROJECT');
  }
  await mapDomain(h,ids.sales,'XECA',2);
  for(const [t,id] of [['document',d.d.record.id],['intake_candidate',c.candidateId]] as const) {
   const {it}=await one(svc(),pm,t,id);
   expect(it.maskReasons,t).toEqual([]);expect(it.value,t).not.toBeNull();
  }
 });

 test('M3 what cannot be proven readable is masked: an id outside the rebuilt context, a source of another project, an entity that is gone, a pair the builder refuses',async()=>{
  const d1=await doc(),d2=await doc(),t=await doc(ids.transport),c=await candidate(),gone=randomUUID();
  await rawDraft({entityType:'document',entityId:d1.record.id,value:out('technical_writer',[d1.record.id,randomUUID()])});
  await rawDraft({entityType:'document',entityId:d2.record.id,value:out('technical_writer',[d2.record.id,t.record.id])});
  await rawDraft({entityType:'document',entityId:gone});
  await rawDraft({entityType:'intake_candidate',entityId:c.candidateId,skill:'technical_writer'});
  const cases:[string,'intake_candidate'|'document',string,string][]=[['i','document',d1.record.id,'SOURCE_OUT_OF_CONTEXT'],['ii','document',d2.record.id,'SOURCE_OUT_OF_CONTEXT'],
   ['iii','document',gone,'ENTITY_NOT_FOUND'],['iv','intake_candidate',c.candidateId,'ENTITY_NOT_FOUND']];
  for(const [name,type,id,reason] of cases) {
   const {it}=await one(svc(),pm,type,id);
   expect(it.maskReasons,name).toEqual([reason]);expect(it.value,name).toBeNull();expect(it.sources,name).toEqual([]);
  }
 });

 test('M4 for a document draft a reason that is not about what the reader may read does not mask: an older manifest hash, a value hash that does not describe the value, an unsourced claim, a draft without sources',async()=>{
  const mk=async(value:R|undefined,over:R={})=>{const d=await doc();const v=value??out('technical_writer',[d.record.id]);await rawDraft({entityType:'document',entityId:d.record.id,value:v,over});return d;};
  const a=await mk(undefined,{manifest_hash:'d'.repeat(64)});
  const b=await mk(undefined,{value_hash:'f'.repeat(64)});
  const c=await doc();await rawDraft({entityType:'document',entityId:c.record.id,value:out('technical_writer',[c.record.id],{claims:[{field:'f',value:'v',basis:[]}]})});
  const e=await doc();await rawDraft({entityType:'document',entityId:e.record.id,value:out('technical_writer',[])});
  for(const [name,x] of [['manifest',a],['value hash',b],['unsourced',c],['no sources',e]] as const) {
   const {it}=await one(svc(),pm,'document',x.record.id);
   expect(it.maskReasons,name).toEqual([]);expect(it.value,name).not.toBeNull();
  }
 });

 test('M5 the read context is built under the reader, once per skill, and never for a reader without the authority',async()=>{
  const c=await candidate();
  for(let i=0;i<3;i++) await rawDraft({entityType:'intake_candidate',entityId:c.candidateId,value:out('intake_analyst',[c.sourceEventId])});
  vi.mocked(buildSkillContextIn).mockClear();
  await svc().list(pm,q('intake_candidate',c.candidateId));
  const calls=vi.mocked(buildSkillContextIn).mock.calls;
  expect(calls).toHaveLength(1);
  expect(calls[0][1].id).toBe(pm.id);
  expect(calls[0][2]).toMatchObject({skill:'intake_analyst',projectId:ids.sales,candidateId:c.candidateId});
  expect(calls[0][3]).toEqual(chats);
  const d=await doc();
  await rawDraft({entityType:'document',entityId:d.record.id,value:out('technical_writer',[d.record.id])});
  await rawDraft({entityType:'document',entityId:d.record.id,skill:'ba_elicitation',value:out('ba_elicitation',[d.record.id])});
  vi.mocked(buildSkillContextIn).mockClear();
  await svc().list(pm,q('document',d.record.id));
  expect(vi.mocked(buildSkillContextIn).mock.calls).toHaveLength(2);
  vi.mocked(buildSkillContextIn).mockClear();
  await svc().list(member,q('intake_candidate',c.candidateId));
  expect(vi.mocked(buildSkillContextIn).mock.calls).toHaveLength(0);
 });

 test('M6 an error the service does not understand is not turned into a mask: the read fails and returns nothing',async()=>{
  const c=await candDraft();
  const boom=new AppError('CONTEXT_TOO_LARGE','x',500);
  vi.mocked(buildSkillContextIn).mockRejectedValueOnce(boom);
  await expect(svc().list(pm,q('intake_candidate',c.candidateId))).rejects.toBe(boom);
 });

 test('M7 decide answers with the same masked view: a rejection by a manager who cannot read the cited text is recorded, and its answer carries no content',async()=>{
  const a=await loudDraft();
  const r=await decide(svc(h.operator,[]),pm,a.draftId,{result:'rejected',valueHash:a.valueHash,reason:'Không đọc được nguồn'});
  expect(r.decision?.result).toBe('rejected');expect(r.maskReasons).toContain('TEXT_NOT_VISIBLE');expect(r.value).toBeNull();
  expect(JSON.stringify(r)).not.toContain(MARK);
  expect(await n('draft_decisions')).toBe(1);
 });

 test('M8 under a mask sources is empty whatever the sources column names: ids of the rebuilt context, repeated and reordered, do not come back',async()=>{
  const c=await candidate(),d=await doc();
  const strangers=Array.from({length:30},()=>randomUUID());
  const col=[d.record.id,...Array.from({length:60},()=>c.sourceEventId),...strangers];
  const x=await rawDraft({entityType:'intake_candidate',entityId:c.candidateId,value:out('intake_analyst',[c.sourceEventId]),over:{sources:JSON.stringify(col.map(id=>({id})))}});
  const rec=recordingDb(h.db);
  const l=await new SuggestionService(rec.db,h.operator,[]).list(pm,q('intake_candidate',c.candidateId));
  const it=l.items.find(i=>i.id===x.id) as unknown as R;
  expect(it).toMatchObject({value:null,sources:[]});
  for(const text of [JSON.stringify(l)]) for(const code of [c.sourceEventId,d.record.id,...strangers]) expect(text).not.toContain(code);
  const seen=JSON.stringify(rec.rows());
  for(const code of strangers) expect(seen).not.toContain(code);
  const gone=randomUUID(),many=Array.from({length:50},()=>randomUUID());
  const y=await rawDraft({entityType:'document',entityId:gone,over:{sources:JSON.stringify(many.map(id=>({id})))}});
  const l2=await svc().list(pm,q('document',gone));
  expect((l2.items.find(i=>i.id===y.id) as unknown as R).sources).toEqual([]);
  for(const code of many) expect(JSON.stringify(l2)).not.toContain(code);
 });

 test('M9 a replayed decision on a project that became pointer-only answers with the recorded decision and no content',async()=>{
  const x=await docDraft(),key=k(),b={result:'rejected',valueHash:x.valueHash,reason:'Không phù hợp phạm vi'};
  const first=await decide(svc(),pm,x.draftId,b,key);
  await mapDomain(h,ids.sales,'IBS_HI',1);
  const again=await decide(svc(),pm,x.draftId,b,key);
  expect(again.decision?.result).toBe('rejected');expect(again.decision?.decidedAt).toBe(first.decision?.decidedAt);
  expect(again.maskReasons).toEqual(['POINTER_ONLY_PROJECT']);expect(again.value).toBeNull();
  expect(await n('draft_decisions')).toBe(1);
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

describe('Z4 drafts: IBS HI is refused at write (OQ-45 point 3)',()=>{
 const POINTER='Dự án này chỉ nhận con trỏ nên nháp AI không được lưu.';
 test('a draft for an IBS HI project is refused when it is written: POINTER_ONLY_PROJECT, nothing stored, no database error text',async()=>{
  await mapDomain(h,ids.transport,'IBS_HI',1);
  const d=await doc(ids.transport);
  const e=await refused(svc().submitDraft(ai,env('document',d.record.id,'technical_writer',out('technical_writer',[d.record.id]),{projectId:ids.transport})),'POINTER_ONLY_PROJECT',422);
  expect(e.message).toBe(POINTER);
  for(const s of [d.record.id,ids.transport,'pointer-only']) expect(e.message).not.toContain(s);
  expect(await n('intelligence.ai_drafts')).toBe(0);
  // a candidate draft: the sales project is mapped to IBS_HI
  await mapDomain(h,ids.sales,'IBS_HI',1);
  const c=await candidate();
  const e2=await refused(svc().submitDraft(ai,env('intake_candidate',c.candidateId,'intake_analyst',out('intake_analyst',[c.sourceEventId]))),'POINTER_ONLY_PROJECT',422);
  expect(e2.message).toBe(POINTER);
  for(const s of [c.candidateId,c.sourceEventId,ids.sales,'pointer-only']) expect(e2.message).not.toContain(s);
  expect(await n('intelligence.ai_drafts')).toBe(0);
 });

 test('the refusal comes before the replay: an envelope first stored before the mapping is refused afterwards, and one draft stays',async()=>{
  const d=await doc(ids.transport);
  const e=env('document',d.record.id,'technical_writer',out('technical_writer',[d.record.id]),{projectId:ids.transport});
  expect(await svc().submitDraft(ai,e)).toMatchObject({stored:true});
  await mapDomain(h,ids.transport,'IBS_HI',1);
  await refused(svc().submitDraft(ai,e),'POINTER_ONLY_PROJECT',422);
  expect(await n('intelligence.ai_drafts')).toBe(1);
 });

 test('an unmapped project, a project under another label and a project that left IBS_HI still store',async()=>{
  const t=await doc(ids.transport);
  expect(await svc().submitDraft(ai,env('document',t.record.id,'technical_writer',out('technical_writer',[t.record.id]),{projectId:ids.transport}))).toMatchObject({stored:true});
  await mapDomain(h,ids.sales,'XECA',1);
  const s=await doc(ids.sales);
  expect(await svc().submitDraft(ai,env('document',s.record.id,'technical_writer',out('technical_writer',[s.record.id])))).toMatchObject({stored:true});
  await mapDomain(h,ids.transport,'IBS_HI',1);
  await mapDomain(h,ids.transport,'LIBERICO_BU',2);
  const t2=await doc(ids.transport);
  expect(await svc().submitDraft(ai,env('document',t2.record.id,'technical_writer',out('technical_writer',[t2.record.id]),{projectId:ids.transport}))).toMatchObject({stored:true});
  expect(await n('intelligence.ai_drafts')).toBe(3);
 });

 test("the pipeline's own project list answers first: an IBS HI project outside ai.projectIds is the not-found answer, before any statement",async()=>{
  await mapDomain(h,ids.transport,'IBS_HI',1);
  const d=await doc(ids.transport);
  await denied(svc(handle).submitDraft({...ai,projectIds:[ids.sales]},env('document',d.record.id,'technical_writer',out('technical_writer',[d.record.id]),{projectId:ids.transport})));
 });
});

describe('Z4 drafts: OQ-55 placeholder — a thread with stored text that is no longer shown',()=>{
 const MARK='zq-thread-'+randomUUID().replace(/-/g,'');
 const none=()=>svc(h.operator,[]);
 const q=(entityId:string)=>({projectId:ids.sales,entityType:'intake_candidate' as const,entityId});
 const first=async(s:SuggestionService,p:Principal,entityId:string)=>(await s.list(p,q(entityId))).items[0] as unknown as R;
 /** A candidate draft that names no message: the claim has no basis and the one source is a document of the project. */
 const quiet=async(c:{candidateId:string},d:DocumentDetail,over:R={})=>{
  const value=out('intake_analyst',[d.record.id],{claims:[{field:'classification',value:MARK,basis:[]}],...over});
  const x=await rawDraft({entityType:'intake_candidate',entityId:c.candidateId,value});
  return {...x,valueHash:sha(value)};
 };
 /** A clean draft: one document source and no claims. */
 const clean=async(c:{candidateId:string},d:DocumentDetail)=>{
  const value=out('intake_analyst',[d.record.id]);
  const x=await rawDraft({entityType:'intake_candidate',entityId:c.candidateId,value});
  return {...x,valueHash:sha(value)};
 };

 test('dừng tại OQ-55: a candidate draft that names no message is masked once the stored text of its thread is no longer shown',async()=>{
  const c=await candidate(),d=await doc();
  const x=await quiet(c,d);
  const it=await first(none(),pm,c.candidateId);
  expect(it.maskReasons).toEqual(['THREAD_TEXT_HIDDEN']);
  expect(it.value).toBeNull();expect(it.sources).toEqual([]);
  expect(JSON.stringify(it)).not.toContain(MARK);expect(JSON.stringify(it)).not.toContain(d.record.id);
  expect((await first(none(),member,c.candidateId)).maskReasons).toEqual(['CONFIRM_AUTHORITY_REQUIRED']);
  const ok=await first(svc(),pm,c.candidateId);
  expect(ok.maskReasons).toEqual([]);expect(JSON.stringify(ok.value)).toContain(MARK);
  expect(x.id).toBe(ok.id);
 });

 test('dừng tại OQ-55: a thread whose newest revision is pointer-only but an earlier revision stored text still masks its candidate drafts when the group is not flagged',async()=>{
  const c=await candidate(),d=await doc();
  await new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,{chats:bridgeConfig.intake!.chats,excerptChats:[]})
   .ingest({...c.event,text:'Bản sửa chỉ con trỏ',contentHash:'e'.repeat(64),editedAt:new Date(1760099999000).toISOString(),traceId:randomUUID()});
  const modes=await rows<{content_mode:string}>('SELECT content_mode FROM source_event_revisions WHERE source_event_id=$1 ORDER BY revision_no',[c.sourceEventId]);
  expect(modes.map(m=>m.content_mode)).toEqual(['excerpt','pointer_only']);
  await clean(c,d);
  expect((await first(none(),pm,c.candidateId)).maskReasons).toEqual(['THREAD_TEXT_HIDDEN']);
 });

 test('dừng tại OQ-55: what is masked for that reason cannot be confirmed either',async()=>{
  const c=await candidate(),d=await doc();
  const x=await clean(c,d);
  const decisions=await n('document_commands');
  await held(decide(none(),pm,x.id,body(x.valueHash)),'THREAD_TEXT_HIDDEN');
  await zeroDecisions();
  expect(await n('document_commands')).toBe(decisions);
  const r=await decide(none(),pm,x.id,{result:'rejected',valueHash:x.valueHash,reason:'Không đủ căn cứ'});
  expect(r.decision?.result).toBe('rejected');
  expect(await n('draft_decisions')).toBe(1);
  // a raw row whose value is off the contract is held for that reason as well
  const c2=await candidate();
  const bad=out('intake_analyst',[d.record.id],{confidence:'cao'});
  const y=await rawDraft({entityType:'intake_candidate',entityId:c2.candidateId,value:bad});
  await held(decide(none(),pm,y.id,body(sha(bad))),'SCHEMA_INVALID');
  expect(await n('draft_decisions')).toBe(1);
 });

 test('a draft that cites a message of such a thread carries both reasons',async()=>{
  const c=await candidate();
  const value=out('intake_analyst',[c.sourceEventId],{claims:[{field:'classification',value:MARK,basis:[c.sourceEventId]}]});
  await rawDraft({entityType:'intake_candidate',entityId:c.candidateId,value});
  const it=await first(none(),pm,c.candidateId);
  expect(it.maskReasons).toEqual(['TEXT_NOT_VISIBLE','THREAD_TEXT_HIDDEN']);
  expect(it.value).toBeNull();expect(JSON.stringify(it)).not.toContain(MARK);
 });

 test('dừng tại OQ-55: a replayed confirmation of a candidate draft answers with the recorded decision and no content once the group\'s flag is gone',async()=>{
  const c=await candidate();
  const value=out('intake_analyst',[c.sourceEventId],{claims:[{field:'classification',value:MARK,basis:[c.sourceEventId]}]});
  const x=await rawDraft({entityType:'intake_candidate',entityId:c.candidateId,value});
  const key=k(),b=body(sha(value));
  const firstAns=await decide(svc(),pm,x.id,b,key);
  expect(firstAns.decision?.result).toBe('confirmed');
  const again=await decide(none(),pm,x.id,b,key);
  expect(again.decision?.result).toBe('confirmed');expect(again.decision?.decidedAt).toBe(firstAns.decision?.decidedAt);
  expect(again.maskReasons).toContain('THREAD_TEXT_HIDDEN');
  expect(again.value).toBeNull();expect(again.sources).toEqual([]);
  expect(JSON.stringify(again)).not.toContain(MARK);
  expect(await n('draft_decisions')).toBe(1);
 });

 test('dừng tại OQ-55: a document draft is not touched by the placeholder',async()=>{
  await candidate();
  const x=await docDraft();
  const l=(await none().list(pm,{projectId:ids.sales,entityType:'document',entityId:x.d.record.id})).items[0] as unknown as R;
  expect(l.maskReasons).toEqual([]);expect(l.value).not.toBeNull();
  const r=await decide(none(),pm,x.draftId,body(x.valueHash,{revision:revisionBody(x.d)}));
  expect(r.decision?.result).toBe('confirmed');
 });
});
