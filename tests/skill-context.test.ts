import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {openHarness,type Harness} from './slice1-db';
import {bot,member,pm,seedSlice1,viewer} from './slice1-fixtures';
import {bridgeConfig,chatSales,chatTransport,intakePrincipalId,messageEvent,type EventOverride} from './slice2-fixtures';
import {mapDomain,proposeRev,recordingDb,registerDoc} from './slice3-fixtures';
import {IntakeService} from '../src/server/intake';
import {ids} from '../src/server/identities';
import {scoped,type Queryable} from '../src/server/db';
import {visibleThreadMessages} from '../src/server/source-text';
import {contextSchema,SKILLS,type SkillContext,type SkillName} from '../src/server/skill-contracts';
import {buildSkillContext,buildSkillContextIn,CONTEXT_KINDS} from '../src/server/skill-context';
import type {Principal} from '../src/server/types';

// Slice 3 Task 10: the permission-scoped context handed to the six PM/BA skills.
let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{await h.reset();await h.close();});

const chats=bridgeConfig.intake!.chats;
const both=[chatSales,chatTransport];
const chatTwo='-1000000000077'; // a second group of the same project, used only to make two threads share a thread_key
const rows=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const NOT_FOUND='Không tìm thấy mục trong phạm vi được cấp.';
type Src<K extends SkillContext['sources'][number]['kind']>=Extract<SkillContext['sources'][number],{kind:K}>;

/** Ingests one message with the flags given; replies join the thread of `replyTo`. Returns ids as the database stores them. */
async function msg(o:{chat?:string;text:string;replyTo?:string;flags?:string[];messageId?:string}):Promise<{messageId:string;sourceEventId:string;candidateId:string;hash:string}> {
 const ev:EventOverride={text:o.text,context:{chatId:o.chat??chatSales,...(o.messageId?{messageId:o.messageId}:{}),...(o.replyTo?{replyToMessageId:o.replyTo}:{})}};
 const e=messageEvent(ev);
 const ack=await new IntakeService(h.operator,ids.tenant,intakePrincipalId,{...bridgeConfig.chatScopes,[chatTwo]:[ids.sales]},{chats:[...chats,chatTwo],excerptChats:o.flags??[...both,chatTwo]}).ingest(e);
 const sourceEventId=ack.sourceEventId;
 const r=(await rows<{id:string}>(`SELECT c.id FROM intake_candidates c JOIN source_events s ON s.chat_id=c.chat_id AND s.thread_key=c.thread_key AND s.project_id=c.project_id WHERE s.id=$1`,[sourceEventId]))[0];
 return {messageId:e.context.messageId,sourceEventId,candidateId:r.id,hash:e.contentHash};
}
const build=async(p:Principal,input:Record<string,unknown>,excerpt:readonly string[]=both,db=h.db):Promise<SkillContext>=>{
 const c=await buildSkillContext(db,p,input,excerpt);
 expect(()=>contextSchema.parse(c)).not.toThrow();
 return c;
};
const kinds=(c:SkillContext,k:string)=>c.sources.filter(s=>s.kind===k);
const refused=async(promise:Promise<unknown>,code:string,status:number)=>{
 const e=await promise.then(()=>null,x=>x);
 expect(e,'expected a refusal').toBeTruthy();
 expect(e).toMatchObject({code,status});
 return e as Error;
};
const denied=async(promise:Promise<unknown>)=>{
 const e=await refused(promise,'SCOPE_DENIED',404);
 expect(e.message).toBe(NOT_FOUND);
};
const approve=(docId:string,revisionId:string)=>h.operator.transaction(async tx=>{
 // the operational login points the approval; the runtime guard needs a decision row, which is not under test here
 await tx.query('SET LOCAL session_replication_role=replica');
 await tx.query('UPDATE document_records SET approved_revision_id=$1 WHERE id=$2',[revisionId,docId]);
});

describe('skill context',()=>{
 test('(7) a record of an IBS HI project never enters the context of a Xeca project',async()=>{
  await mapDomain(h,ids.sales,'XECA',1);
  await mapDomain(h,ids.transport,'IBS_HI',1);
  const sm=await msg({chat:chatSales,text:'SALES-MARK-4471 tin bán hàng'});
  const tm=await msg({chat:chatTransport,text:'TRANSPORT-MARK-9983 tin vận tải'});
  const sd=await registerDoc(h,pm,{projectId:ids.sales,title:'SALES-DOC-TITLE-1102'});
  const td=await registerDoc(h,pm,{projectId:ids.transport,title:'TRANSPORT-DOC-TITLE-7731'});
  await proposeRev(h,pm,td,{changes:{summary:'TRANSPORT-SUMMARY-5520 nội dung',present:['TRANSPORT-PRESENT-1'],missing:['TRANSPORT-MISSING-2']}});
  await proposeRev(h,pm,sd,{changes:{summary:'SALES-SUMMARY-3301 nội dung',present:['SALES-PRESENT-1'],missing:[]}});
  const salesCtx=await build(pm,{skill:'ba_elicitation',projectId:ids.sales,candidateId:sm.candidateId,documentId:sd.record.id});
  const salesJson=JSON.stringify(salesCtx);
  expect(salesCtx.pointerOnly).toBe(false);
  expect(salesJson).toContain('SALES-MARK-4471');
  expect(salesJson).toContain('SALES-DOC-TITLE-1102');
  expect(salesJson).toContain('SALES-SUMMARY-3301');
  const foreign=['TRANSPORT-MARK-9983','TRANSPORT-DOC-TITLE-7731','TRANSPORT-SUMMARY-5520','TRANSPORT-PRESENT-1','TRANSPORT-MISSING-2',td.record.id,tm.hash,tm.sourceEventId];
  for(const m of foreign) expect(salesJson,m).not.toContain(m);
  const trCtx=await build(pm,{skill:'ba_elicitation',projectId:ids.transport,candidateId:tm.candidateId,documentId:td.record.id});
  const trJson=JSON.stringify(trCtx);
  expect(trCtx.pointerOnly).toBe(true);
  for(const m of ['TRANSPORT-MARK-9983','TRANSPORT-DOC-TITLE-7731','TRANSPORT-SUMMARY-5520','TRANSPORT-PRESENT-1','TRANSPORT-MISSING-2',tm.hash]) expect(trJson,m).not.toContain(m);
  // pointers stay (R10-h)
  const doc=kinds(trCtx,'document')[0] as Src<'document'>;
  expect(doc).toMatchObject({id:td.record.id,refCode:td.record.ref_code,title:null});
  const rev=kinds(trCtx,'document_revision')[0] as Src<'document_revision'>;
  expect(rev).toMatchObject({documentId:td.record.id,summary:null,present:[],missing:[],revisionNo:1});
  const ev=kinds(trCtx,'source_event')[0] as Src<'source_event'>;
  expect(ev).toMatchObject({id:tm.sourceEventId,text:null,hash:null,forwarded:false});
  expect(ev.ref).toBeTruthy();
  expect(ev.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
 });

 describe.each([
  ['the group flag is removed',[] as string[],false],
  ['the project is mapped to IBS_HI after the text was stored',both,true],
  ['the message stored only a pointer',both,false],
 ] as const)('hidden and pointer-only message text and hash never enter a context: %s',(name,flags,remap)=>{
  test('hidden',async()=>{
   const marker='ZEBRA-CTX-5521 nội dung';
   const stored=name.includes('only a pointer')?[]:both;
   const m=await msg({text:marker,flags:stored});
   if(remap) await mapDomain(h,ids.sales,'IBS_HI',1);
   const modes=await rows<{content_mode:string}>('SELECT content_mode FROM source_event_revisions WHERE source_event_id=$1',[m.sourceEventId]);
   expect(modes.length).toBeGreaterThan(0);
   for(const r of modes) expect(r.content_mode).toBe(stored.length?'excerpt':'pointer_only');
   const rec=recordingDb(h.db);
   const c=await build(pm,{skill:'intake_analyst',projectId:ids.sales,candidateId:m.candidateId},flags,rec.db);
   const ev=kinds(c,'source_event') as Src<'source_event'>[];
   expect(ev).toHaveLength(1);
   expect(ev[0].text).toBeNull();
   expect(ev[0].hash).toBeNull();
   expect(ev[0].mode).not.toBe('excerpt');
   const all=JSON.stringify(rec.rows());
   expect(rec.rows().length).toBeGreaterThan(0);
   expect(all).not.toContain(marker);
   expect(all).not.toContain(m.hash);
   expect(JSON.stringify(c)).not.toContain(m.hash);
  });
 });

 test('defence in depth: a row that wrongly carries text under a pointer-only project or a non-excerpt mode is still nulled',async()=>{
  await mapDomain(h,ids.sales,'IBS_HI',1);
  const m=await msg({text:'DEEP-MARK',flags:[]});
  const leaky=(db:typeof h.db,mode:'excerpt'|'hidden'):typeof h.db=>{
   const wrap=(q:Queryable):Queryable=>({query:async<T=Record<string,unknown>>(sql:string,params?:unknown[])=>{
    const r=await q.query<T>(sql,params);
    if(sql.includes('visible_text')) return {rows:r.rows.map(x=>({...x,display_mode:mode,visible_text:'LEAK-TEXT',visible_hash:'LEAK-HASH'})) as T[]};
    return r;
   }});
   return {...wrap(db),transaction:fn=>db.transaction(tx=>fn(wrap(tx))),close:()=>db.close()};
  };
  const c=await build(pm,{skill:'intake_analyst',projectId:ids.sales,candidateId:m.candidateId},both,leaky(h.db,'excerpt'));
  expect(c.pointerOnly).toBe(true);
  expect(JSON.stringify(c)).not.toContain('LEAK');
  await mapDomain(h,ids.sales,'XECA',2); // append-only: the latest row is now XECA
  const c2=await build(pm,{skill:'intake_analyst',projectId:ids.sales,candidateId:m.candidateId},both,leaky(h.db,'hidden'));
  expect(c2.pointerOnly).toBe(false);
  expect(JSON.stringify(c2)).not.toContain('LEAK');
 });

 test('positive control: with the flag in force the same read carries the text and the hash',async()=>{
  const marker='ZEBRA-CTX-5522 nội dung';
  const m=await msg({text:marker});
  const c=await build(pm,{skill:'intake_analyst',projectId:ids.sales,candidateId:m.candidateId});
  expect(kinds(c,'source_event')[0]).toMatchObject({mode:'excerpt',text:marker,hash:m.hash,id:m.sourceEventId});
 });

 test('revoked access: a principal that lost the project gets the not-found answer and no source',async()=>{
  const m=await msg({text:'REVOKED-MARK-1'});
  const d=await registerDoc(h,pm,{projectId:ids.sales,title:'REVOKED-DOC-1'});
  const input={skill:'pm_planning',projectId:ids.sales,candidateId:m.candidateId,documentId:d.record.id};
  await build(pm,input);
  const lost:Principal={...pm,projectIds:[ids.transport],grants:[{projectId:ids.transport,role:'manager',reportPermissions:[]}]};
  await denied(buildSkillContext(h.db,lost,input,both));
  // the same answer for every other denial
  const cases:[Principal,Record<string,unknown>][]=[
   [pm,{...input,projectId:randomUUID()}],            // unknown project
   [lost,input],                                       // project outside the scope
   [pm,{...input,candidateId:randomUUID()}],           // candidate not found
   [pm,{...input,documentId:randomUUID()}],            // document not found
   [pm,{...input,projectId:'not-an-id'}],              // malformed ids
   [pm,{...input,candidateId:'not-an-id'}],
   [pm,{...input,documentId:'not-an-id'}],
   [viewer,{skill:'pm_planning',projectId:ids.transport}],
  ];
  for(const [p,i] of cases) await denied(buildSkillContext(h.db,p,i,both));
 });

 test('viewer and bot are refused',async()=>{
  await mapDomain(h,ids.sales,'XECA',1);
  const m=await msg({text:'VB-MARK-1'});
  const asViewer:Principal={...member,role:'viewer',grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}]};
  const asBot:Principal={...member,role:'bot',grants:undefined};
  const asBotAll:Principal={...pm,role:'bot',grants:undefined};
  for(const skill of SKILLS) {
   for(const p of [asViewer,asBot,asBotAll,viewer,bot]) {
    await denied(buildSkillContext(h.db,p,{skill,projectId:ids.sales},both));
    await denied(buildSkillContext(h.db,p,{skill,projectId:ids.transport},both));
   }
  }
  // a grant of each reading role in the project is accepted (positive control)
  for(const role of ['manager','engineer','technical','business'] as const) {
   const p:Principal={...pm,role,projectIds:[ids.sales],grants:[{projectId:ids.sales,role,reportPermissions:[]}]};
   const c=await build(p,{skill:'intake_analyst',projectId:ids.sales,candidateId:m.candidateId});
   expect(kinds(c,'source_event')).toHaveLength(1);
  }
 });

 test('same name, other BU: two projects with the same document title yield only the in-scope document id',async()=>{
  const title='TÀI LIỆU TRÙNG TÊN 6612';
  const a=await registerDoc(h,pm,{projectId:ids.sales,title});
  const b=await registerDoc(h,pm,{projectId:ids.transport,title});
  const c=await build(member,{skill:'technical_writer',projectId:ids.sales});
  expect(kinds(c,'document').map(s=>s.id)).toEqual([a.record.id]);
  expect(JSON.stringify(c)).not.toContain(b.record.id);
  await denied(buildSkillContext(h.db,member,{skill:'technical_writer',projectId:ids.transport},both));
  await denied(buildSkillContext(h.db,member,{skill:'doc_reviewer',projectId:ids.sales,documentId:b.record.id},both));
  const ct=await build(pm,{skill:'technical_writer',projectId:ids.transport});
  expect(kinds(ct,'document').map(s=>s.id)).toEqual([b.record.id]);
 });

 test('each skill receives only its kinds and the caps hold',async()=>{
  await mapDomain(h,ids.sales,'XECA',1);
  const root=await msg({text:'CAP-ROOT'});
  for(let i=0;i<24;i++) await msg({text:`CAP-REPLY-${i}`,replyTo:root.messageId});
  const named=await registerDoc(h,pm,{projectId:ids.sales,title:'CAP-NAMED',refCode:'ZZ-NAMED-LAST'});
  // bulk fixtures by the operational login: 59 more documents and 39 more revisions of the named one
  await h.operator.transaction(async tx=>{
   await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[ids.tenant,ids.sales]);
   await tx.query(`INSERT INTO document_records(tenant_id,project_id,ref_code,doc_type,title,source_type,canonical_uri,registered_by)
    SELECT $1,$2,'AA-'||lpad(g::text,3,'0'),'design','Tài liệu số '||g,'drive','https://docs.google.com/cap/'||g,$3 FROM generate_series(1,59) g`,[ids.tenant,ids.sales,pm.id]);
   await tx.query(`INSERT INTO document_revisions(tenant_id,project_id,document_id,revision_no,source_id,source_type,proposed_by)
    SELECT $1,$2,$3,g,'https://docs.google.com/cap/named','drive',$4 FROM generate_series(2,40) g`,[ids.tenant,ids.sales,named.record.id,pm.id]);
  });
  for(const skill of SKILLS) {
   const allowed=CONTEXT_KINDS[skill];
   const input:Record<string,unknown>={skill,projectId:ids.sales};
   if(allowed.includes('source_event')) input.candidateId=root.candidateId;
   if(allowed.includes('document_revision')) input.documentId=named.record.id;
   const c=await build(pm,input);
   for(const s of c.sources) expect(allowed,`${skill} got ${s.kind}`).toContain(s.kind);
   expect(c.sources.length).toBeLessThanOrEqual(100);
   expect(kinds(c,'document')).toHaveLength(50);
   if(input.documentId) expect(kinds(c,'document').some(s=>s.id===named.record.id),'the named document is kept when the cap cuts').toBe(true);
   expect(kinds(c,'source_event')).toHaveLength(allowed.includes('source_event')?20:0);
   if(skill==='release_librarian') expect(kinds(c,'document_revision')).toHaveLength(0);
   else expect(kinds(c,'document_revision')).toHaveLength(allowed.includes('document_revision')?30:0);
  }
  const full=await build(pm,{skill:'ba_elicitation',projectId:ids.sales,candidateId:root.candidateId,documentId:named.record.id});
  expect(full.sources).toHaveLength(100);
  // newest revisions first
  expect(kinds(full,'document_revision').map(s=>(s as Src<'document_revision'>).revisionNo)).toEqual(Array.from({length:30},(_,i)=>40-i));
 });

 test('R10-e: more than 20 messages in the thread give exactly the newest 20, oldest first',async()=>{
  const root=await msg({text:'ORD-ROOT'});
  const all=[root];
  for(let i=0;i<24;i++) all.push(await msg({text:`ORD-REPLY-${i}`,replyTo:root.messageId}));
  // a message of another thread and another chat must not enter
  const other=await msg({text:'ORD-OTHER-THREAD'});
  await msg({chat:chatTransport,text:'ORD-OTHER-CHAT'});
  const c=await build(pm,{skill:'intake_analyst',projectId:ids.sales,candidateId:root.candidateId});
  const got=kinds(c,'source_event').map(s=>s.id);
  expect(got).toEqual(all.slice(5).map(m=>m.sourceEventId));
  expect(got).not.toContain(other.sourceEventId);
  const times=kinds(c,'source_event').map(s=>(s as Src<'source_event'>).observedAt);
  expect([...times].sort()).toEqual(times);
  // a second read gives the same bytes (the context is hashed later)
  expect(JSON.stringify(await build(pm,{skill:'intake_analyst',projectId:ids.sales,candidateId:root.candidateId}))).toBe(JSON.stringify(c));
  // visibleThreadMessages directly: the limit and the project filter
  const direct=await scoped(h.db,{...pm,projectIds:[ids.sales]},tx=>visibleThreadMessages(tx,ids.sales,root.candidateId,both,3));
  expect(direct.map(m=>m.sourceEventId)).toEqual(all.slice(-3).map(m=>m.sourceEventId));
  const wrongProject=await scoped(h.db,{...pm,projectIds:[ids.transport]},tx=>visibleThreadMessages(tx,ids.transport,root.candidateId,both,20));
  expect(wrongProject).toEqual([]);
 });

 test('the thread is the candidate\'s own chat: the same message id in another chat of the same project does not join it',async()=>{
  const a=await msg({chat:chatSales,text:'CHAT-A-ROOT',messageId:'5001'});
  const b=await msg({chat:chatTwo,text:'CHAT-B-ROOT',messageId:'5001'});
  expect(a.candidateId).not.toBe(b.candidateId);
  const rowsKey=await rows<{thread_key:string}>('SELECT DISTINCT thread_key FROM source_events WHERE id IN ($1,$2)',[a.sourceEventId,b.sourceEventId]);
  expect(rowsKey).toHaveLength(1); // the premise: both events carry the same thread_key
  const ca=await build(pm,{skill:'intake_analyst',projectId:ids.sales,candidateId:a.candidateId},[chatSales,chatTwo]);
  expect(kinds(ca,'source_event').map(s=>s.id)).toEqual([a.sourceEventId]);
  const cb=await build(pm,{skill:'intake_analyst',projectId:ids.sales,candidateId:b.candidateId},[chatSales,chatTwo]);
  expect(kinds(cb,'source_event').map(s=>s.id)).toEqual([b.sourceEventId]);
 });

 test('every statement filters by project even when the transaction is scoped to two projects',async()=>{
  const sd=await registerDoc(h,pm,{projectId:ids.sales,title:'TWO-SALES-DOC'});
  const td=await registerDoc(h,pm,{projectId:ids.transport,title:'TWO-TRANSPORT-DOC'});
  const tm=await msg({chat:chatTransport,text:'TWO-TRANSPORT-MSG'});
  await proposeRev(h,pm,td,{});
  const inTwo=<T,>(fn:(tx:Queryable)=>Promise<T>)=>scoped(h.db,pm,fn); // pm is scoped to sales AND transport
  const c=await inTwo(tx=>buildSkillContextIn(tx,pm,{skill:'ba_elicitation',projectId:ids.sales,documentId:sd.record.id},both));
  expect(kinds(c,'document').map(s=>s.id)).toEqual([sd.record.id]);
  expect(JSON.stringify(c)).not.toContain(td.record.id);
  // a document or candidate of the other project is not found when named under this project
  await denied(inTwo(tx=>buildSkillContextIn(tx,pm,{skill:'ba_elicitation',projectId:ids.sales,documentId:td.record.id},both)));
  await denied(inTwo(tx=>buildSkillContextIn(tx,pm,{skill:'ba_elicitation',projectId:ids.sales,candidateId:tm.candidateId},both)));
 });

 test('R10-g: the release librarian gets only the approved revision; none when nothing is approved',async()=>{
  const d0=await registerDoc(h,pm,{projectId:ids.sales,title:'LIB-DOC'});
  const d1=await proposeRev(h,pm,d0,{changes:{summary:'Bản một của tài liệu',present:[],missing:[]}});
  const d2=await proposeRev(h,pm,d1,{changes:{summary:'Bản hai của tài liệu',present:[],missing:[]}});
  const d3=await proposeRev(h,pm,d2,{changes:{summary:'Bản ba của tài liệu',present:[],missing:[]}});
  const revs=await rows<{id:string;revision_no:number}>('SELECT id,revision_no FROM document_revisions WHERE document_id=$1 ORDER BY revision_no',[d3.record.id]);
  expect(revs).toHaveLength(3);
  const input=(skill:SkillName)=>({skill,projectId:ids.sales,documentId:d3.record.id});
  const none=await build(pm,input('release_librarian'));
  expect(kinds(none,'document_revision')).toHaveLength(0);
  expect(kinds(none,'document')[0]).toMatchObject({approvedRevisionId:null});
  await approve(d3.record.id,revs[1].id);
  const lib=await build(pm,input('release_librarian'));
  expect(kinds(lib,'document_revision').map(s=>s.id)).toEqual([revs[1].id]);
  expect(kinds(lib,'document')[0]).toMatchObject({approvedRevisionId:revs[1].id,latestRevisionId:revs[2].id});
  const rev=await build(pm,input('doc_reviewer'));
  expect(kinds(rev,'document_revision').map(s=>(s as Src<'document_revision'>).revisionNo)).toEqual([3,2,1]);
  expect(kinds(await build(pm,input('technical_writer')),'document_revision')).toHaveLength(3);
  // an approved revision of ANOTHER document never enters the librarian's context
  const o0=await registerDoc(h,pm,{projectId:ids.sales,title:'LIB-OTHER'});
  const o1=await proposeRev(h,pm,o0,{});
  const orev=(await rows<{id:string}>('SELECT id FROM document_revisions WHERE document_id=$1',[o1.record.id]))[0].id;
  await approve(o1.record.id,orev);
  const lib2=await build(pm,input('release_librarian'));
  expect(kinds(lib2,'document_revision').map(s=>s.id)).toEqual([revs[1].id]);
 });

 test('R10-i: an input that cannot be honoured is a 422, not silently ignored',async()=>{
  const m=await msg({text:'R10I-MARK'});
  const d=await registerDoc(h,pm,{projectId:ids.sales,title:'R10I-DOC'});
  for(const skill of SKILLS) {
   if(!CONTEXT_KINDS[skill].includes('source_event'))
    await refused(buildSkillContext(h.db,pm,{skill,projectId:ids.sales,candidateId:m.candidateId},both),'INVALID_INPUT',422);
   if(!CONTEXT_KINDS[skill].includes('document_revision'))
    await refused(buildSkillContext(h.db,pm,{skill,projectId:ids.sales,documentId:d.record.id},both),'INVALID_INPUT',422);
  }
  expect(SKILLS.some(s=>!CONTEXT_KINDS[s].includes('source_event'))).toBe(true);
  expect(SKILLS.some(s=>!CONTEXT_KINDS[s].includes('document_revision'))).toBe(true);
 });

 test('CONTEXT_KINDS is the table of the brief',()=>{
  expect(CONTEXT_KINDS).toEqual({
   intake_analyst:['source_event','document'],ba_elicitation:['source_event','document','document_revision'],pm_planning:['source_event','document','document_revision'],
   technical_writer:['document','document_revision'],doc_reviewer:['document','document_revision'],release_librarian:['document','document_revision'],
  });
 });

 test('forged fields are rejected',async()=>{
  const base={skill:'technical_writer',projectId:ids.sales};
  for(const forged of [{tenantId:ids.otherTenant},{actorId:randomUUID()},{projectIds:[ids.sales,ids.transport]},{extra:1}])
   await expect(buildSkillContext(h.db,pm,{...base,...forged},both)).rejects.toMatchObject({name:'ZodError'});
  await expect(buildSkillContext(h.db,pm,{skill:'unknown_skill',projectId:ids.sales},both)).rejects.toMatchObject({name:'ZodError'});
  await expect(buildSkillContext(h.db,pm,{skill:'technical_writer',projectId:7},both)).rejects.toMatchObject({name:'ZodError'});
  await expect(buildSkillContext(h.db,pm,{skill:'technical_writer'},both)).rejects.toMatchObject({name:'ZodError'});
  await expect(buildSkillContext(h.db,pm,null,both)).rejects.toMatchObject({name:'ZodError'});
 });

 test('identifiers are lower-cased at parse time and compared with the database ids',async()=>{
  const m=await msg({text:'LOWER-MARK'});
  const d=await registerDoc(h,pm,{projectId:ids.sales,title:'LOWER-DOC'});
  const c=await build(pm,{skill:'ba_elicitation',projectId:ids.sales.toUpperCase(),candidateId:m.candidateId.toUpperCase(),documentId:d.record.id.toUpperCase()});
  expect(c.projectId).toBe(ids.sales);
  expect(kinds(c,'document')[0].id).toBe(d.record.id);
  expect(kinds(c,'source_event')).toHaveLength(1);
 });

 test("buildSkillContextIn works inside a transaction the caller opened, under that transaction's rights",async()=>{
  const m=await msg({text:'IN-MARK'});
  const c=await scoped(h.db,{...pm,projectIds:[ids.sales]},tx=>buildSkillContextIn(tx,pm,{skill:'intake_analyst',projectId:ids.sales,candidateId:m.candidateId},both));
  expect(()=>contextSchema.parse(c)).not.toThrow();
  expect(kinds(c,'source_event')[0]).toMatchObject({text:'IN-MARK'});
  // a transaction scoped to another project sees no such project: the same answer
  await denied(scoped(h.db,{...pm,projectIds:[ids.transport]},tx=>buildSkillContextIn(tx,pm,{skill:'intake_analyst',projectId:ids.sales,candidateId:m.candidateId},both)));
 });

 test('the context module names no revision table and holds no second copy of the mapping rule',async()=>{
  const src=await readFile(path.join(process.cwd(),'src/server/skill-context.ts'),'utf8');
  for(const s of ['source_event_revisions','text_excerpt','content_hash','project_domain_mappings','IBS_HI','DUPLICATE_HINT_SQL']) expect(src,s).not.toContain(s);
  const contracts=await readFile(path.join(process.cwd(),'src/server/skill-contracts.ts'),'utf8');
  expect(contracts).not.toMatch(/skill-context|from '\.\/db'/);
 });
});
