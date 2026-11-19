import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {createHash,randomUUID} from 'node:crypto';
import {readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {openHarness,type Harness} from './slice1-db';
import {outsider,pm,seedSlice1} from './slice1-fixtures';
import {bridgeConfig,chatSales,chatTransport,intakePrincipalId,messageEvent,type EventOverride} from './slice2-fixtures';
import {mapDomain,recordingDb} from './slice3-fixtures';
import {IntakeService} from '../src/server/intake';
import {InboxService} from '../src/server/inbox';
import {displayMode,listVisibleRevisions,projectHasHiddenText,threadFreshness,threadHasHiddenText,visibleThreadMessages} from '../src/server/source-text';
import {scoped,type Queryable} from '../src/server/db';
import {ids} from '../src/server/identities';

let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{await h.reset();await h.close();});

const chats=bridgeConfig.intake!.chats;
const intake=(excerptChats?:string[])=>new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,{chats,excerptChats});
const rows=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const ingest=async(o:EventOverride={},excerptChats?:string[])=>{
 const e=messageEvent(o);
 const ack=await intake(excerptChats).ingest(e);
 const id=(await rows<{id:string}>('SELECT id FROM intake_candidates WHERE root_source_event_id=$1',[ack.sourceEventId]))[0].id;
 return {id,sourceEventId:ack.sourceEventId,hash:e.contentHash};
};
const salesScope={...pm,projectIds:[ids.sales]};

describe('source-text',()=>{
 test('displayMode: only a stored excerpt under an allowing config is shown',()=>{
  expect(displayMode('excerpt',true)).toBe('excerpt');
  expect(displayMode('excerpt',false)).toBe('hidden');
  expect(displayMode('pointer_only',true)).toBe('pointer_only');
  expect(displayMode('pointer_only',false)).toBe('pointer_only');
  expect(displayMode(null,true)).toBe('pointer_only');
  expect(displayMode(null,false)).toBe('pointer_only');
 });

 test('SQL and the pure rule agree for every stored mode, flag and latest mapping',async()=>{
  const stored=await ingest({text:'SQL-RULE-EXCERPT-7731'},[chatSales]);
  const pointer=await ingest({text:'SQL-RULE-POINTER-7732'});
  // The last two inserts are out of version order (v6 before v5): the latest mapping is the highest version, not the last inserted.
  const steps:[('XECA'|'LIBERICO_BU'|'IBS_HI'),number][]=[['XECA',1],['LIBERICO_BU',2],['IBS_HI',3],['XECA',4],['IBS_HI',6],['XECA',5]];
  let latest:string|null=null,top=0;
  for(const [step,ver] of [[null,0] as const,...steps]) {
   if(step) {await mapDomain(h,ids.sales,step,ver);if(ver>top){top=ver;latest=step;}}
   for(const flags of [[chatSales],[] as string[],[chatTransport]]) {
    const flagged=flags.includes(chatSales);
    for(const [m,mode] of [[stored,'excerpt'],[pointer,'pointer_only']] as const) {
     const revs=await scoped(h.db,salesScope,tx=>listVisibleRevisions(tx,m.sourceEventId,flags));
     expect(revs.length).toBeGreaterThan(0);
     for(const r of revs) {
      const want=displayMode(mode,flagged&&latest!=='IBS_HI');
      expect(r.displayMode).toBe(want);
      expect(r.text!==null).toBe(want==='excerpt');
      expect(r.contentHash!==null).toBe(want==='excerpt');
     }
    }
   }
  }
 });

 describe.each([
  ['the group flag is removed',async()=>({flags:[] as string[],pointerOnly:false,after:async()=>{}})],
  ['the project is mapped to IBS_HI after the text was stored',async()=>({flags:[chatSales],pointerOnly:false,after:()=>mapDomain(h,ids.sales,'IBS_HI',1)})],
  ['the service is built without flags',async()=>({flags:undefined,pointerOnly:false,after:async()=>{}})],
  ['the message stored only a pointer',async()=>({flags:[chatSales],pointerOnly:true,after:async()=>{}})],
 ] as const)('no row handed to the service carries hidden or pointer-only text or hash: %s',(_n,setup)=>{
  test('hidden',async()=>{
   const marker='ZEBRA-MARKER-5521 nội dung';
   const cfg=await setup();
   const m=await ingest({text:marker},cfg.pointerOnly?undefined:[chatSales]);
   await cfg.after();
   // The scenario must start from the stored mode it names, so it cannot quietly fall back to pointer-only.
   const stored=await rows<{content_mode:string}>('SELECT content_mode FROM source_event_revisions WHERE source_event_id=$1',[m.sourceEventId]);
   expect(stored.length).toBeGreaterThan(0);
   for(const r of stored) expect(r.content_mode).toBe(cfg.pointerOnly?'pointer_only':'excerpt');
   const rec=recordingDb(h.db);
   const svc=cfg.flags===undefined?new InboxService(rec.db):new InboxService(rec.db,cfg.flags);
   await svc.list(pm,{projectId:ids.sales});
   await svc.detail(pm,m.id);
   await svc.command(pm,m.id,{kind:'confirm',expectedVersion:1,classification:'incident'},randomUUID(),randomUUID());
   const all=JSON.stringify(rec.rows());
   expect(rec.rows().length).toBeGreaterThan(0);
   expect(all).not.toContain(marker);
   expect(all).not.toContain(m.hash);
  });
 });

 test('positive control: with the flag in force the same operations do carry the text',async()=>{
  const marker='ZEBRA-MARKER-5522 nội dung';
  const m=await ingest({text:marker},[chatSales]);
  const rec=recordingDb(h.db);
  const svc=new InboxService(rec.db,[chatSales]);
  await svc.list(pm,{projectId:ids.sales});
  await svc.detail(pm,m.id);
  await svc.command(pm,m.id,{kind:'confirm',expectedVersion:1,classification:'incident'},randomUUID(),randomUUID());
  expect(JSON.stringify(rec.rows())).toContain(marker);
  expect(JSON.stringify(rec.rows())).toContain(m.hash);
 });

 test('an empty flag list hides every stored text and no RLS context returns no row',async()=>{
  const m=await ingest({text:'EMPTY-FLAG-8841'},[chatSales]);
  const none=await scoped(h.db,salesScope,tx=>listVisibleRevisions(tx,m.sourceEventId,[]));
  expect(none.length).toBeGreaterThan(0);
  for(const r of none) expect(r).toMatchObject({displayMode:'hidden',text:null,contentHash:null});
  const noCtx=await h.db.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_runtime');return listVisibleRevisions(tx,m.sourceEventId,[chatSales]);});
  expect(noCtx).toEqual([]);
 });

 test('duplicate hints are unchanged: same stored hash, same project, either visibility',async()=>{
  const text='DUP-HINT-3310 nội dung giống nhau';
  const a=await ingest({text},[chatSales]);
  const b=await ingest({text});
  const other=await ingest({text,context:{chatId:chatTransport}},[chatTransport]);
  const rec=recordingDb(h.db);
  const svc=new InboxService(rec.db,[chatSales]);
  const items=(await svc.list(pm,{projectId:ids.sales})).items;
  const ca=items.find(c=>c.candidateId===a.id)!,cb=items.find(c=>c.candidateId===b.id)!;
  expect(ca.contentMode).toBe('excerpt');
  expect(cb.contentMode).toBe('pointer_only');
  expect(ca.duplicateCandidates.map(d=>d.candidateId)).toEqual([b.id]);
  expect(cb.duplicateCandidates.map(d=>d.candidateId)).toEqual([a.id]);
  expect(items.some(c=>c.candidateId===other.id)).toBe(false);
  expect(JSON.stringify(items.flatMap(c=>c.duplicateCandidates))).not.toContain(other.id);
  expect(JSON.stringify(rec.rows())).not.toContain(a.hash);
 });

 test('visibleThreadMessages names the number of the revision it shows: the latest by edit time, not the highest number, and the number survives hidden text',async()=>{
  const e=messageEvent({text:'RN-V1'});
  const first=await intake([chatSales]).ingest(e);
  const candidateId=(await rows<{id:string}>('SELECT id FROM intake_candidates WHERE root_source_event_id=$1',[first.sourceEventId]))[0].id;
  const edit=(text:string,at:number)=>intake([chatSales]).ingest({...e,text,contentHash:createHash('sha256').update(text).digest('hex'),editedAt:new Date(at).toISOString(),traceId:randomUUID()});
  expect((await edit('RN-V2',1760099999000)).revisionNo).toBe(2);   // the latest edit time
  expect((await edit('RN-V3',1760050000000)).revisionNo).toBe(3);   // the highest number, an earlier edit time
  const shown=await scoped(h.db,salesScope,tx=>visibleThreadMessages(tx,ids.sales,candidateId,[chatSales],20));
  expect(shown).toHaveLength(1);
  expect(shown[0]).toMatchObject({sourceEventId:first.sourceEventId,revisionNo:2,displayMode:'excerpt',text:'RN-V2'});
  const hidden=await scoped(h.db,salesScope,tx=>visibleThreadMessages(tx,ids.sales,candidateId,[],20));
  expect(hidden[0]).toMatchObject({revisionNo:2,displayMode:'hidden',text:null,contentHash:null});
  // a message that was never edited is number 1
  const solo=await ingest({text:'RN-SOLO'},[chatSales]);
  const soloRead=await scoped(h.db,salesScope,tx=>visibleThreadMessages(tx,ids.sales,solo.id,[chatSales],20));
  expect(soloRead.map(m=>m.revisionNo)).toEqual([1]);
 });

 test('only source-text.ts reads revision text',()=>{
  const files:string[]=[];
  const walk=(d:string)=>{for(const e of readdirSync(d,{withFileTypes:true})) {const p=path.join(d,e.name);if(e.isDirectory()) walk(p);else if(/\.tsx?$/.test(e.name)) files.push(p);}};
  walk(path.join(process.cwd(),'src'));
  const having=(s:string)=>files.filter(f=>readFileSync(f,'utf8').includes(s)).map(f=>path.relative(process.cwd(),f).split(path.sep).join('/')).sort();
  expect(having('text_excerpt')).toEqual(['src/server/intake.ts','src/server/source-text.ts']);
  expect(having('source_event_revisions')).toEqual(['src/server/intake.ts','src/server/source-text.ts']);
 });

 test('only source-text.ts names the two tables that number a thread (OQ-53)',()=>{
  const files:string[]=[];
  const walk=(d:string)=>{for(const e of readdirSync(d,{withFileTypes:true})) {const p=path.join(d,e.name);if(e.isDirectory()) walk(p);else if(/\.tsx?$/.test(e.name)) files.push(p);}};
  walk(path.join(process.cwd(),'src'));
  const having=(s:string)=>files.filter(f=>readFileSync(f,'utf8').includes(s)).map(f=>path.relative(process.cwd(),f).split(path.sep).join('/')).sort();
  expect(having('source_revision_positions')).toEqual(['src/server/source-text.ts']);
  expect(having('intake_thread_heads')).toEqual(['src/server/source-text.ts']);
 });
});

describe('threadHasHiddenText',()=>{
 const ask=(projectId:string,candidateId:string,list:readonly string[],scope=salesScope)=>scoped(h.db,scope,tx=>threadHasHiddenText(tx,projectId,candidateId,list));
 const edit=(e:ReturnType<typeof messageEvent>,text:string,list:string[])=>intake(list).ingest({...e,text,contentHash:'e'.repeat(64),editedAt:new Date(1760099999000).toISOString(),traceId:randomUUID()});

 test('Q5 threadHasHiddenText: every revision of every message of the thread, the current configuration, the caller\'s scope',async()=>{
  const a=await ingest({text:'Q5-STORED-1'},[chatSales]);
  expect(await ask(ids.sales,a.id,[chatSales])).toBe(false);
  expect(await ask(ids.sales,a.id,[])).toBe(true);
  const b=await ingest({text:'Q5-POINTER-1'});
  expect(await ask(ids.sales,b.id,[])).toBe(false);
  const e=messageEvent({text:'Q5-EDITED-1'});
  const ack=await intake([chatSales]).ingest(e);
  const c=(await rows<{id:string}>('SELECT id FROM intake_candidates WHERE root_source_event_id=$1',[ack.sourceEventId]))[0].id;
  await edit(e,'Q5-EDITED-2',[]);
  const modes=await rows<{content_mode:string}>('SELECT r.content_mode FROM source_event_revisions r WHERE r.source_event_id=$1 ORDER BY r.revision_no',[ack.sourceEventId]);
  expect(modes.map(m=>m.content_mode)).toEqual(['excerpt','pointer_only']);
  expect(await ask(ids.sales,c,[])).toBe(true);
  expect(await ask(ids.sales,c,[chatSales])).toBe(false);
  await mapDomain(h,ids.sales,'IBS_HI',1);
  expect(await ask(ids.sales,a.id,[chatSales])).toBe(true);
 });

 test('Q5 the caller\'s scope and a malformed id',async()=>{
  const a=await ingest({text:'Q5-SCOPE-1'},[chatSales]);
  expect(await ask(ids.transport,a.id,[],{...pm,projectIds:[ids.transport]})).toBe(false);
  expect(await ask(ids.sales,a.id,[],{...outsider,projectIds:[ids.sales]})).toBe(false);
  const trap:Queryable={query:async()=>{throw new Error('statement sent');}};
  expect(await threadHasHiddenText(trap,ids.sales,'x',[])).toBe(true);
  expect(await threadHasHiddenText(trap,'x',a.id,[])).toBe(true);
  // positive control for the scope part: the same candidate asked with its own project is true where the other project's answer is false
  expect(await ask(ids.sales,a.id,[])).toBe(true);
 });

 test('Q5 (i) a thread whose root stored no text and whose reply stored text: the reply counts, whichever message is the root',async()=>{
  const e=messageEvent({text:'Q5-ROOT-NO-TEXT'});
  const ack=await intake([]).ingest(e);
  const cid=(await rows<{id:string}>('SELECT id FROM intake_candidates WHERE root_source_event_id=$1',[ack.sourceEventId]))[0].id;
  await intake([chatSales]).ingest(messageEvent({text:'Q5-REPLY-WITH-TEXT',context:{replyToMessageId:e.context.messageId}}));
  const modes=await rows<{content_mode:string}>('SELECT r.content_mode FROM source_event_revisions r JOIN source_events s ON s.id=r.source_event_id WHERE s.thread_key=(SELECT thread_key FROM intake_candidates WHERE id=$1) ORDER BY s.created_at',[cid]);
  expect(modes.map(m=>m.content_mode)).toEqual(['pointer_only','excerpt']);
  expect(await ask(ids.sales,cid,[])).toBe(true);
  expect(await ask(ids.sales,cid,[chatSales])).toBe(false);
 });

 test('Q5 (ii) no cap: the oldest message stored text and twenty-one replies stored none',async()=>{
  const e=messageEvent({text:'Q5-OLDEST-TEXT'});
  const ack=await intake([chatSales]).ingest(e);
  const cid=(await rows<{id:string}>('SELECT id FROM intake_candidates WHERE root_source_event_id=$1',[ack.sourceEventId]))[0].id;
  for(let i=0;i<21;i++) await intake([]).ingest(messageEvent({text:`Q5-REPLY-${i}`,context:{replyToMessageId:e.context.messageId}}));
  expect(Number((await rows<{n:string}>('SELECT count(*) n FROM source_events s JOIN intake_candidates c ON c.thread_key=s.thread_key AND c.chat_id=s.chat_id WHERE c.id=$1',[cid]))[0].n)).toBe(22);
  expect(await ask(ids.sales,cid,[])).toBe(true);
  expect(await ask(ids.sales,cid,[chatSales])).toBe(false);
 });

 test('Q6 threadHasHiddenText returns one boolean and no text: the one row handed back holds no excerpt and no content hash',async()=>{
  const m=await ingest({text:'Q6-MARKER-8812'},[chatSales]);
  const rec=recordingDb(h.db);
  const got=await scoped(rec.db,salesScope,tx=>threadHasHiddenText(tx,ids.sales,m.id,[]));
  expect(got).toBe(true);
  const seen=rec.rows().filter(r=>(r as Record<string,unknown>).hidden!==undefined);
  expect(seen).toHaveLength(1);
  expect(Object.keys(seen[0] as object)).toEqual(['hidden']);
  expect(JSON.stringify(rec.rows())).not.toContain('Q6-MARKER-8812');
  expect(JSON.stringify(rec.rows())).not.toContain(m.hash);
 });

 test('Q8 threadHasHiddenText is closed when the list of flagged groups cannot be evaluated',async()=>{
  const m=await ingest({text:'Q8-STORED-1'},[chatSales]);
  const nul=[null] as unknown as string[];
  expect(await ask(ids.sales,m.id,nul)).toBe(true);
  expect(await ask(ids.sales,m.id,[null,chatTransport] as unknown as string[])).toBe(true);
  expect(await ask(ids.sales,m.id,[null,chatSales] as unknown as string[])).toBe(false);
  const p=await ingest({text:'Q8-POINTER-1'});
  expect(await ask(ids.sales,p.id,nul)).toBe(false);
 });

 test('Q10 threadHasHiddenText is closed when the statement returns no row',async()=>{
  const empty:Queryable={query:async()=>({rows:[]}) as never};
  expect(await threadHasHiddenText(empty,ids.sales,randomUUID(),[])).toBe(true);
 });

 test('Q11 the statement\'s own project condition holds for threadHasHiddenText: a principal scoped to both projects gets false for the other project',async()=>{
  const m=await ingest({text:'Q11-STORED-1'},[chatSales]);
  const both={...pm,projectIds:[ids.sales,ids.transport]};
  expect(await ask(ids.transport,m.id,[],both)).toBe(false);
  expect(await ask(ids.sales,m.id,[],both)).toBe(true);
 });
});

describe('projectHasHiddenText',()=>{
 const askP=(projectId:string,list:readonly string[],scope:Parameters<typeof scoped>[1]=salesScope)=>scoped(h.db,scope,tx=>projectHasHiddenText(tx,projectId,list));
 const bothScope={...pm,projectIds:[ids.sales,ids.transport]};
 const edit=(e:ReturnType<typeof messageEvent>,text:string,list:string[])=>intake(list).ingest({...e,text,contentHash:'e'.repeat(64),editedAt:new Date(1760099999000).toISOString(),traceId:randomUUID()});

 test('U1 projectHasHiddenText: every revision of every message of the project, the current configuration, and closed outside the caller\'s scope',async()=>{
  expect(await askP(ids.sales,[chatSales],bothScope)).toBe(false);
  await ingest({text:'U1-POINTER-1'});
  expect(await askP(ids.sales,[],bothScope)).toBe(false);
  // another project holds stored text that is hidden: this project stays false, the other is true
  await ingest({text:'U1-TRANSPORT-1',context:{chatId:chatTransport}},[chatTransport]);
  expect(await askP(ids.sales,[],bothScope)).toBe(false);
  expect(await askP(ids.transport,[],bothScope)).toBe(true);
  const e=messageEvent({text:'U1-STORED-1'});
  await intake([chatSales]).ingest(e);
  expect(await askP(ids.sales,[chatSales],bothScope)).toBe(false);
  expect(await askP(ids.sales,[],bothScope)).toBe(true);
  // a later pointer-only revision of that message does not clear the earlier stored text
  await edit(e,'U1-EDIT-1',[]);
  expect(await askP(ids.sales,[],bothScope)).toBe(true);
  expect(await askP(ids.sales,[chatSales],bothScope)).toBe(false);
  await mapDomain(h,ids.sales,'IBS_HI',1);
  expect(await askP(ids.sales,[chatSales],bothScope)).toBe(true);
  await mapDomain(h,ids.sales,'XECA',2);
  expect(await askP(ids.sales,[chatSales],bothScope)).toBe(false);
  // closed outside the caller's scope, with a list that would show the text
  expect(await askP(ids.sales,[chatSales],{...outsider,projectIds:[ids.sales]})).toBe(true);
  expect(await askP(ids.sales,[chatSales],{...pm,projectIds:[ids.transport]})).toBe(true);
  expect(await askP(randomUUID(),[chatSales],bothScope)).toBe(true);
 });

 test('U2 projectHasHiddenText returns one boolean and no text: the one row handed back holds no excerpt and no content hash',async()=>{
  const m=await ingest({text:'U2-MARKER-8812'},[chatSales]);
  const rec=recordingDb(h.db);
  const got=await scoped(rec.db,salesScope,tx=>projectHasHiddenText(tx,ids.sales,[]));
  expect(got).toBe(true);
  const seen=rec.rows().filter(r=>(r as Record<string,unknown>).hidden!==undefined);
  expect(seen).toHaveLength(1);
  expect(Object.keys(seen[0] as object)).toEqual(['hidden']);
  expect(JSON.stringify(rec.rows())).not.toContain('U2-MARKER-8812');
  expect(JSON.stringify(rec.rows())).not.toContain(m.hash);
 });

 test('U3 projectHasHiddenText is closed: a list that cannot be evaluated, a statement that returns no row, a malformed project id',async()=>{
  await ingest({text:'U3-STORED-1'},[chatSales]);
  expect(await askP(ids.sales,[null] as unknown as string[])).toBe(true);
  expect(await askP(ids.sales,[null,chatSales] as unknown as string[])).toBe(false);
  const empty:Queryable={query:async()=>({rows:[]}) as never};
  expect(await projectHasHiddenText(empty,ids.sales,[])).toBe(true);
  const trap:Queryable={query:async()=>{throw new Error('statement sent');}};
  expect(await projectHasHiddenText(trap,'x',[])).toBe(true);
 });
});

describe('threadFreshness',()=>{
 // OQ-53 (1 (b), 2 (a), 3 (b)): the draft states the pairs (message, revision number) it read; the check compares them with the numbers the database gave to the revisions of the thread.
 // hasBaseline:false is the whole answer for a draft with no baseline: `changed` and `position` then mean nothing and are false and null.
 const none={hasBaseline:false,changed:false,position:null};
 // T21: the most blocks of the shared buffers the statement may touch on a thread of 600 messages with 100 pairs. Measured (PostgreSQL 16 and PGlite): about 28 000 for the statement as it is;
 // about 930 000 to 970 000 for the statement that ran one pass over the thread for each pair. The bound sits between the two, away from both.
 const BLOCKS_LIMIT=100000;
 type Pair={id:string;revisionNo:number};
 const pair=(id:string,revisionNo=1):Pair=>({id,revisionNo});
 const ask=(projectId:string,candidateId:string,named:readonly string[],pairs:readonly Pair[],scope:Parameters<typeof scoped>[1]=salesScope)=>
  scoped(h.db,scope,tx=>threadFreshness(tx,projectId,candidateId,named,pairs));
 const sha=(t:string)=>createHash('sha256').update(t).digest('hex');
 const root=async(text:string)=>{
  const e=messageEvent({text});
  const ack=await intake([chatSales]).ingest(e);
  const id=(await rows<{id:string}>('SELECT id FROM intake_candidates WHERE root_source_event_id=$1',[ack.sourceEventId]))[0].id;
  return {e,id,sourceEventId:ack.sourceEventId};
 };
 const reply=async(r:{e:ReturnType<typeof messageEvent>},text:string)=>
  (await intake([chatSales]).ingest(messageEvent({text,context:{replyToMessageId:r.e.context.messageId}}))).sourceEventId;
 /** An edit of a message: the revision number it takes is the next one; `at` is Telegram's edit time, which decides which revision is the latest. */
 const editOf=(e:ReturnType<typeof messageEvent>,text:string,at=1760099999000)=>
  intake([chatSales]).ingest({...e,text,contentHash:sha(text),editedAt:new Date(at).toISOString(),traceId:randomUUID()});
 let rawSeq=0;
 /**
  * One more message of the thread of `r`, inserted by the operational login, bypassing the service. `anHourAgo`: the rows say they were recorded an hour ago, the shape of a message whose
  * transaction began before the draft was read and committed after it. `unnumbered`: the numbering trigger is off for this one insert (inside the transaction, so a failure puts it back).
  */
 const rawMessage=async(r:{id:string},o:{anHourAgo?:boolean;unnumbered?:boolean}={})=>{
  rawSeq+=1;
  const key=(await rows<{thread_key:string}>('SELECT thread_key FROM intake_candidates WHERE id=$1',[r.id]))[0].thread_key;
  const when=o.anHourAgo?"now() - interval '1 hour'":'now()';
  const messageId=String(7200000+rawSeq);
  return h.operator.transaction(async tx=>{
   if(o.unnumbered) await tx.query('ALTER TABLE source_event_revisions DISABLE TRIGGER source_event_revisions_thread_position');
   const id=(await tx.query<{id:string}>(
    `INSERT INTO source_events(tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,trace_id,correlation_id,created_at)
     VALUES($1,$2,$3,'telegram_gateway',50,$4,$5,$6,'synthetic-actor',${when},false,true,$7,$8,${when}) RETURNING id`,
    [ids.tenant,ids.sales,'synthetic:'+messageId,chatSales,messageId,key,randomUUID(),randomUUID()])).rows[0].id;
   await tx.query(
    `INSERT INTO source_event_revisions(tenant_id,project_id,source_event_id,revision_no,revision_key,edited_at,content_hash,content_mode,text_excerpt,text_truncated,created_at)
     VALUES($1,$2,$3,1,$4,NULL,$5,'pointer_only',NULL,false,${when})`,[ids.tenant,ids.sales,id,sha('raw-key-'+messageId),sha('raw-text-'+messageId)]);
   if(o.unnumbered) await tx.query('ALTER TABLE source_event_revisions ENABLE TRIGGER source_event_revisions_thread_position');
   return id;
  });
 };
 const numberOf=async(sourceEventId:string,revisionNo:number)=>(await rows<{s:string}>(
  'SELECT p.thread_seq::text s FROM source_revision_positions p JOIN source_event_revisions r ON r.id=p.revision_id WHERE r.source_event_id=$1 AND r.revision_no=$2',[sourceEventId,revisionNo]))[0]?.s??null;
 const headOf=async(candidateId:string)=>(await rows<{s:string}>(
  'SELECT h.last_seq::text s FROM intake_thread_heads h JOIN intake_candidates c ON c.project_id=h.project_id AND c.chat_id=h.chat_id AND c.thread_key=h.thread_key WHERE c.id=$1',[candidateId]))[0]?.s??null;

 test('T6′ threadFreshness hands back five columns and no text, in one statement: no excerpt, no content hash',async()=>{
  const r=await root('T6-MARKER-4417');
  const rec=recordingDb(h.db);
  const sent:string[]=[];
  const counting=(q:Queryable):Queryable=>({query:async<T=Record<string,unknown>>(sql:string,p?:unknown[])=>{sent.push(sql);return q.query<T>(sql,p);}});
  const got=await scoped(rec.db,salesScope,tx=>threadFreshness(counting(tx),ids.sales,r.id,[r.sourceEventId],[pair(r.sourceEventId)]));
  expect(got).toEqual({hasBaseline:true,changed:false,position:'1'});
  expect(sent).toHaveLength(1);
  const seen=rec.rows().filter(x=>(x as Record<string,unknown>).has_baseline!==undefined);
  expect(seen).toHaveLength(1);
  expect(Object.keys(seen[0] as object).sort()).toEqual(['baseline','has_baseline','head','not_latest','unnumbered']);
  expect(JSON.stringify(rec.rows())).not.toContain('T6-MARKER-4417');
  expect(JSON.stringify(rec.rows())).not.toContain(sha('T6-MARKER-4417'));
 });

 // T7′: the table of limit cases of section 8 of the plan, one case for each row that this function decides. The rows about a lock held by a transaction in flight belong to the
 // trigger of the decision table (tests/thread-order.test.ts, Task 2) and to the confirmation (Task 7); the rows about the answer of `decide` are in tests/suggestions.test.ts.
 test('T7′ (row 1) the draft names the revision of the message it read and nothing was recorded since: nothing changed, and the number to write down is the head of the thread',async()=>{
  const r=await root('T7-ROOT');
  expect(await numberOf(r.sourceEventId,1)).toBe('1');
  expect(await ask(ids.sales,r.id,[r.sourceEventId],[pair(r.sourceEventId)])).toEqual({hasBaseline:true,changed:false,position:'1'});
 });

 test('T7′ (rows 2, 3, 4) an edit the draft read does not change it; the revision before the edit does, whether the edit came before the draft or after it',async()=>{
  const r=await root('T7-EDIT-ROOT');
  // row 4: the draft names (message, 1), and then the message is edited
  expect(await ask(ids.sales,r.id,[r.sourceEventId],[pair(r.sourceEventId,1)])).toEqual({hasBaseline:true,changed:false,position:'1'});
  expect((await editOf(r.e,'T7-EDIT-ROOT-V2')).revisionNo).toBe(2);
  expect(await ask(ids.sales,r.id,[r.sourceEventId],[pair(r.sourceEventId,1)])).toEqual({hasBaseline:true,changed:true,position:'2'});
  // rows 2 and 3: the edit was there before the draft was written; naming revision 2 is fresh, naming revision 1 is not
  expect(await ask(ids.sales,r.id,[r.sourceEventId],[pair(r.sourceEventId,2)])).toEqual({hasBaseline:true,changed:false,position:'2'});
 });

 test('T7′ (rows 5, 7) a draft that names no message of the thread, or names the message and states no revision of it, has no baseline',async()=>{
  const r=await root('T7-NONE-ROOT');
  expect(await ask(ids.sales,r.id,[],[])).toEqual(none);
  expect(await ask(ids.sales,r.id,[randomUUID()],[])).toEqual(none);
  expect(await ask(ids.sales,r.id,[randomUUID()],[pair(randomUUID())])).toEqual(none);
  // row 5: named in `sources`, nothing in `messageRevisions`
  expect(await ask(ids.sales,r.id,[r.sourceEventId],[])).toEqual(none);
  // positive control: the same message with its revision
  expect(await ask(ids.sales,r.id,[r.sourceEventId],[pair(r.sourceEventId)])).toMatchObject({hasBaseline:true});
 });

 test('T7′ (row 8) a message the draft does not name, recorded before the newest one it names, adds no change',async()=>{
  const r=await root('T7-ROW8-ROOT');
  const rp=await reply(r,'T7-ROW8-REPLY');
  expect(await numberOf(r.sourceEventId,1)).toBe('1');expect(await numberOf(rp,1)).toBe('2');
  expect(await ask(ids.sales,r.id,[rp],[pair(rp)])).toEqual({hasBaseline:true,changed:false,position:'2'});
  expect(await ask(ids.sales,r.id,[r.sourceEventId,rp],[pair(r.sourceEventId),pair(rp)])).toEqual({hasBaseline:true,changed:false,position:'2'});
  // but the draft that names only the older message is behind the reply
  expect(await ask(ids.sales,r.id,[r.sourceEventId],[pair(r.sourceEventId)])).toEqual({hasBaseline:true,changed:true,position:'2'});
 });

 test('T7′ (row 9) a message whose rows say it was recorded before the draft read the thread, but which was committed after it, still changes the draft: the number decides, not the time',async()=>{
  const r=await root('T7-ROW9-ROOT');
  const asked=()=>ask(ids.sales,r.id,[r.sourceEventId],[pair(r.sourceEventId)]);
  expect(await asked()).toEqual({hasBaseline:true,changed:false,position:'1'});
  const late=await rawMessage(r,{anHourAgo:true});
  const times=await rows<{older:boolean}>('SELECT (m.created_at<b.created_at) older FROM source_events m,source_events b WHERE m.id=$1 AND b.id=$2',[late,r.sourceEventId]);
  expect(times[0].older).toBe(true);   // the row of the late message is older than the row the draft read
  expect(await numberOf(late,1)).toBe('2');
  expect(await asked()).toEqual({hasBaseline:true,changed:true,position:'2'});
 });

 test('T7′ an edit of a message the draft does not name counts: every revision of every message of the thread has a number, and the head moves',async()=>{
  const r=await root('T7-OTHER-ROOT');
  const rp=await reply(r,'T7-OTHER-REPLY');
  expect(await ask(ids.sales,r.id,[rp],[pair(rp)])).toEqual({hasBaseline:true,changed:false,position:'2'});
  await editOf(r.e,'T7-OTHER-ROOT-EDITED');
  expect(await ask(ids.sales,r.id,[rp],[pair(rp)])).toEqual({hasBaseline:true,changed:true,position:'3'});
  expect(await ask(ids.sales,r.id,[r.sourceEventId,rp],[pair(r.sourceEventId,2),pair(rp)])).toEqual({hasBaseline:true,changed:false,position:'3'});
 });

 test('T7′ (row 12, limit L1) a late edit that is older than the revision now shown holds the draft until a message arrives; naming the highest number does not help',async()=>{
  const r=await root('T7-L1-ROOT');
  expect((await editOf(r.e,'T7-L1-V2',1760099999000)).revisionNo).toBe(2);   // the latest edit time: the revision the context shows
  const named=[r.sourceEventId];
  expect(await ask(ids.sales,r.id,named,[pair(r.sourceEventId,2)])).toEqual({hasBaseline:true,changed:false,position:'2'});
  expect((await editOf(r.e,'T7-L1-V3',1760050000000)).revisionNo).toBe(3);   // arrives later, an older edit time: the highest number, not the revision shown
  // a draft that read revision 2 (the one shown) is now behind the head; so is one that names revision 3, which is not the latest by edit time
  expect(await ask(ids.sales,r.id,named,[pair(r.sourceEventId,2)])).toEqual({hasBaseline:true,changed:true,position:'3'});
  expect(await ask(ids.sales,r.id,named,[pair(r.sourceEventId,3)])).toEqual({hasBaseline:true,changed:true,position:'3'});
  // a message that comes later ends it for a draft that names it next to the revision shown
  const rp=await reply(r,'T7-L1-REPLY');
  expect(await ask(ids.sales,r.id,[...named,rp],[pair(r.sourceEventId,2),pair(rp)])).toEqual({hasBaseline:true,changed:false,position:'4'});
 });

 test('T8′ threadFreshness reads nothing for a caller scoped to another tenant',async()=>{
  const r=await root('T8-ROOT');
  await editOf(r.e,'T8-ROOT-EDITED');
  const mine=[pair(r.sourceEventId,2)];
  expect(await ask(ids.sales,r.id,[r.sourceEventId],mine,{...outsider,projectIds:[ids.sales]})).toEqual(none);
  expect(await ask(ids.sales,r.id,[r.sourceEventId],mine)).toEqual({hasBaseline:true,changed:false,position:'2'});
 });

 test('T12′ the statement\'s own project condition holds without row-level security narrowing it: a principal scoped to both projects gets nothing for the other project, and the counter of the other project is not read',async()=>{
  const r=await root('T12-ROOT');
  const both={...pm,projectIds:[ids.sales,ids.transport]};
  expect(await ask(ids.transport,r.id,[r.sourceEventId],[pair(r.sourceEventId)],both)).toEqual(none);
  expect(await ask(ids.sales,r.id,[r.sourceEventId],[pair(r.sourceEventId)],both)).toEqual({hasBaseline:true,changed:false,position:'1'});
  // the same chat and thread key in the other project, with a counter of its own that stands higher: a statement that matched the counter without the project would read two rows
  const key=(await rows<{thread_key:string}>('SELECT thread_key FROM intake_candidates WHERE id=$1',[r.id]))[0].thread_key;
  await h.operator.transaction(async tx=>{
   const ev=(await tx.query<{id:string}>(
    `INSERT INTO source_events(tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,trace_id,correlation_id)
     VALUES($1,$2,'synthetic:7300001','telegram_gateway',50,$3,'7300001',$4,'synthetic-actor',now(),false,true,$5,$6) RETURNING id`,[ids.tenant,ids.transport,chatSales,key,randomUUID(),randomUUID()])).rows[0].id;
   for(const no of [1,2,3]) await tx.query(
    `INSERT INTO source_event_revisions(tenant_id,project_id,source_event_id,revision_no,revision_key,edited_at,content_hash,content_mode,text_excerpt,text_truncated)
     VALUES($1,$2,$3,$4,$5,NULL,$6,'pointer_only',NULL,false)`,[ids.tenant,ids.transport,ev,no,sha('t12-key-'+no),sha('t12-hash-'+no)]);
  });
  const other=await rows<{project_id:string;last_seq:string}>('SELECT project_id,last_seq::text FROM intake_thread_heads WHERE chat_id=$1 AND thread_key=$2 ORDER BY last_seq',[chatSales,key]);
  expect(other).toHaveLength(2);
  expect(other.map(x=>x.last_seq)).toEqual(['1','3']);
  expect(await ask(ids.sales,r.id,[r.sourceEventId],[pair(r.sourceEventId)],both)).toEqual({hasBaseline:true,changed:false,position:'1'});
 });

 test('T13′ a project id or a candidate id that is not a lower-case uuid gives the answer for no baseline without a statement',async()=>{
  const r=await root('T13-ROOT');
  const trap:Queryable={query:async()=>{throw new Error('statement sent');}};
  const named=[r.sourceEventId],pairs=[pair(r.sourceEventId)];
  expect(await threadFreshness(trap,'x',r.id,named,pairs)).toEqual(none);
  expect(await threadFreshness(trap,'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',r.id,named,pairs)).toEqual(none);
  expect(await threadFreshness(trap,ids.sales,'x',named,pairs)).toEqual(none);
  expect(await threadFreshness(trap,ids.sales,r.id.toUpperCase(),named,pairs)).toEqual(none);
 });

 test('T14′ (row 13, limit L2) no cap: in a thread of more than twenty messages a late message outside any window still changes the draft, until a message that the draft names arrives',async()=>{
  const r=await root('T14-ROOT');
  const named=[r.sourceEventId];
  for(let i=0;i<21;i++) named.push(await reply(r,`T14-REPLY-${i}`));
  const pairs=named.map(x=>pair(x));
  expect(await ask(ids.sales,r.id,named,pairs)).toEqual({hasBaseline:true,changed:false,position:'22'});
  const late=(await intake([chatSales]).ingest(messageEvent({text:'T14-LATE',observedAt:new Date(1600000000000).toISOString(),context:{replyToMessageId:r.e.context.messageId}}))).sourceEventId;
  expect(named).not.toContain(late);
  expect(await ask(ids.sales,r.id,named,pairs)).toEqual({hasBaseline:true,changed:true,position:'23'});
  const next=await reply(r,'T14-NEXT');
  expect(await ask(ids.sales,r.id,[next],[pair(next)])).toEqual({hasBaseline:true,changed:false,position:'24'});
 });

 test('T16 a revision of the thread that has no number counts as a change, though the head stands where the draft read it',async()=>{
  const r=await root('T16-ROOT');
  const named=[r.sourceEventId],pairs=[pair(r.sourceEventId)];
  expect(await ask(ids.sales,r.id,named,pairs)).toEqual({hasBaseline:true,changed:false,position:'1'});
  // a revision stored while the numbering trigger was off (a restore, session_replication_role = replica): it has no row in the table of numbers and the head did not move
  const un=await rawMessage(r,{unnumbered:true});
  expect(await numberOf(un,1)).toBeNull();
  expect(await headOf(r.id)).toBe('1');
  expect((await rows<{tgenabled:string}>("SELECT tgenabled FROM pg_trigger WHERE tgname='source_event_revisions_thread_position' AND NOT tgisinternal"))[0].tgenabled).toBe('O');
  expect(await ask(ids.sales,r.id,named,pairs)).toEqual({hasBaseline:true,changed:true,position:'1'});
  // also when the draft names the unnumbered message itself: its pair has no number, the other pair does
  expect(await ask(ids.sales,r.id,[...named,un],[...pairs,pair(un)])).toEqual({hasBaseline:true,changed:true,position:'1'});
  // the next revision stored with the trigger on is numbered, and the unnumbered one still holds the thread
  const rp=await reply(r,'T16-REPLY');
  expect(await numberOf(rp,1)).toBe('2');
  expect(await ask(ids.sales,r.id,[rp],[pair(rp)])).toEqual({hasBaseline:true,changed:true,position:'2'});
 });

 test('T17 a pair that names a revision number the message does not have, a number that is not the latest by edit time, and a pair for a message of another thread (row 16)',async()=>{
  const r=await root('T17-ROOT');
  await editOf(r.e,'T17-V2',1760099999000);   // revision 2: the latest edit time, the revision shown
  await editOf(r.e,'T17-V3',1760050000000);   // revision 3: the highest number and number 3 of the thread, an earlier edit time
  const m=r.sourceEventId;
  // (a) a number that is not the latest by edit time: the number is the head, so this is the rule of the latest revision alone
  expect(await ask(ids.sales,r.id,[m],[pair(m,3)])).toEqual({hasBaseline:true,changed:true,position:'3'});
  const rp=await reply(r,'T17-REPLY');   // number 4
  // the reply is named and stands at the head: the draft is fresh with the revision shown (2) ...
  expect(await ask(ids.sales,r.id,[m,rp],[pair(m,2),pair(rp)])).toEqual({hasBaseline:true,changed:false,position:'4'});
  // ... and not with revision 3, whatever stands at the head (b)
  expect(await ask(ids.sales,r.id,[m,rp],[pair(m,3),pair(rp)])).toEqual({hasBaseline:true,changed:true,position:'4'});
  // (c) a number the message does not have, next to a reply that stands at the head
  expect(await ask(ids.sales,r.id,[m,rp],[pair(m,7),pair(rp)])).toEqual({hasBaseline:true,changed:true,position:'4'});
  // (d) the pair of a message of another thread does not count in the baseline. The other thread has five revisions, numbered 1 to 5 in its own thread: its number 4 is the head of this one.
  const other=await root('T17-OTHER-ROOT');
  for(const v of [2,3,4,5]) await editOf(other.e,`T17-OTHER-V${v}`);
  expect(await numberOf(other.sourceEventId,4)).toBe('4');expect(await numberOf(other.sourceEventId,5)).toBe('5');
  // a draft that read only revision 2 of the first message cannot look as if it read the head by adding that pair
  expect(await ask(ids.sales,r.id,[m,other.sourceEventId],[pair(m,2),pair(other.sourceEventId,4)])).toEqual({hasBaseline:true,changed:true,position:'4'});
  // and one that does stand at the head is not made stale by a pair of another thread whose number is higher than the head
  expect(await ask(ids.sales,r.id,[m,rp,other.sourceEventId],[pair(m,2),pair(rp),pair(other.sourceEventId,5)])).toEqual({hasBaseline:true,changed:false,position:'4'});
 });

 test('T18 (row 6) a named message without a pair gives no baseline even when another named message has one',async()=>{
  const r=await root('T18-ROOT');
  const rp=await reply(r,'T18-REPLY');
  expect(await ask(ids.sales,r.id,[r.sourceEventId,rp],[pair(r.sourceEventId)])).toEqual(none);
  expect(await ask(ids.sales,r.id,[r.sourceEventId,rp],[pair(rp)])).toEqual(none);
  expect(await ask(ids.sales,r.id,[r.sourceEventId,rp],[pair(r.sourceEventId),pair(rp)])).toEqual({hasBaseline:true,changed:false,position:'2'});
  // a message of another thread that is named without a pair does not count for this thread
  const other=await root('T18-OTHER-ROOT');
  expect(await ask(ids.sales,r.id,[r.sourceEventId,rp,other.sourceEventId],[pair(r.sourceEventId),pair(rp)])).toEqual({hasBaseline:true,changed:false,position:'2'});
 });

 test('T19 ids and numbers that are not well formed never reach the database',async()=>{
  const r=await root('T19-ROOT');
  const m=r.sourceEventId;
  const sentParams:unknown[][]=[];
  const spy:Queryable={query:async<T=Record<string,unknown>>(_sql:string,p?:unknown[])=>{sentParams.push(p??[]);return {rows:[{has_baseline:true,not_latest:false,unnumbered:false,baseline:'1',head:'1'}]} as never as {rows:T[]};}};
  const bad=[
   {id:m.toUpperCase(),revisionNo:1},{id:'x',revisionNo:1},{id:m,revisionNo:2147483648},{id:m,revisionNo:0},{id:m,revisionNo:-1},{id:m,revisionNo:1.5},
   {id:m,revisionNo:'1'},{id:m,revisionNo:Number.NaN},{id:m,revisionNo:Number.POSITIVE_INFINITY},{id:7,revisionNo:1},null,undefined,'1',{id:m},
  ] as unknown as Pair[];
  await threadFreshness(spy,ids.sales,r.id,[m,m.toUpperCase(),'x',7 as unknown as string],bad);
  expect(sentParams).toHaveLength(1);
  const [,, named,pairIds,pairNumbers]=sentParams[0];
  expect(named).toEqual([m]);
  expect(pairIds).toEqual([]);expect(pairNumbers).toEqual([]);
  // the limits themselves are well formed, and 2147483647 fits the column it is compared with
  await threadFreshness(spy,ids.sales,r.id,[m],[pair(m,1),pair(m,2147483647)]);
  expect(sentParams[1][3]).toEqual([m,m]);expect(sentParams[1][4]).toEqual([1,2147483647]);
  // the real database: the same list of bad pairs leaves the named message without a pair; the two limits reach it and answer without an error
  expect(await ask(ids.sales,r.id,[m],bad)).toEqual(none);
  expect(await ask(ids.sales,r.id,[m],[pair(m,2147483647)])).toEqual({hasBaseline:true,changed:true,position:'1'});
  expect(await ask(ids.sales,r.id,[m],[pair(m,1)])).toEqual({hasBaseline:true,changed:false,position:'1'});
  // a list that is not a list names nothing
  expect(await ask(ids.sales,r.id,[m],undefined as unknown as Pair[])).toEqual(none);
 });

 test('T20 a message of the thread that has no revision at all is not one a pair can name: the pair is a change, whatever number it carries',async()=>{
  const r=await root('T20-ROOT');
  const key=(await rows<{thread_key:string}>('SELECT thread_key FROM intake_candidates WHERE id=$1',[r.id]))[0].thread_key;
  // a message row with no revision row, as only a raw insert makes it: the intake stores the two together
  const bare=(await h.operator.query<{id:string}>(
   `INSERT INTO source_events(tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,trace_id,correlation_id)
    VALUES($1,$2,'synthetic:7500001','telegram_gateway',50,$3,'7500001',$4,'synthetic-actor',now(),false,true,$5,$6) RETURNING id`,[ids.tenant,ids.sales,chatSales,key,randomUUID(),randomUUID()])).rows[0].id;
  expect(await rows('SELECT 1 FROM source_event_revisions WHERE source_event_id=$1',[bare])).toHaveLength(0);
  // control: the message and its revision alone are fresh; the bare message has no revision to be unnumbered
  expect(await ask(ids.sales,r.id,[r.sourceEventId],[pair(r.sourceEventId)])).toEqual({hasBaseline:true,changed:false,position:'1'});
  // the draft names the bare message with a number: no revision carries it, and the counter stands where the draft read it, so only the rule of the latest revision can say so
  expect(await ask(ids.sales,r.id,[r.sourceEventId,bare],[pair(r.sourceEventId),pair(bare)])).toEqual({hasBaseline:true,changed:true,position:'1'});
 });

 /**
  * A thread of `count` messages in two statements by the operational login (the numbering trigger is on): the root is the message the service stores; every fifth message has a second revision, the
  * latest by edit time, inserted after all the first ones, so the revisions with the highest numbers are the second revisions. Returns the candidate, and the pairs (message, latest revision)
  * of the `size` revisions with the highest numbers, newest first, with the number of each.
  */
 const bulkThread=async(count:number,size:number)=>{
  const r=await root('BULK-ROOT');
  const key=(await rows<{thread_key:string}>('SELECT thread_key FROM intake_candidates WHERE id=$1',[r.id]))[0].thread_key;
  await h.operator.transaction(async tx=>{
   await tx.query(
    `INSERT INTO source_events(tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,trace_id,correlation_id)
     SELECT $1,$2,'synthetic:'||(7600000+g),'telegram_gateway',50,$3,(7600000+g)::text,$4,'synthetic-actor',now(),false,true,gen_random_uuid(),gen_random_uuid() FROM generate_series(1,$5::int) g`,
    [ids.tenant,ids.sales,chatSales,key,count-1]);
   await tx.query(
    `INSERT INTO source_event_revisions(tenant_id,project_id,source_event_id,revision_no,revision_key,edited_at,content_hash,content_mode,text_excerpt,text_truncated)
     SELECT $1,$2,e.id,1,encode(sha256(convert_to('k1'||e.id::text,'UTF8')),'hex'),NULL,encode(sha256(convert_to('h1'||e.id::text,'UTF8')),'hex'),'pointer_only',NULL,false
       FROM source_events e WHERE e.thread_key=$3 AND e.id<>$4`,[ids.tenant,ids.sales,key,r.sourceEventId]);
   await tx.query(
    `INSERT INTO source_event_revisions(tenant_id,project_id,source_event_id,revision_no,revision_key,edited_at,content_hash,content_mode,text_excerpt,text_truncated)
     SELECT $1,$2,e.id,2,encode(sha256(convert_to('k2'||e.id::text,'UTF8')),'hex'),now()+interval '1 minute',encode(sha256(convert_to('h2'||e.id::text,'UTF8')),'hex'),'pointer_only',NULL,false
       FROM source_events e WHERE e.thread_key=$3 AND substr(e.message_id,7,1) IN ('0','5')`,[ids.tenant,ids.sales,key]);
  });
  const latest=await rows<{event_id:string;revision_no:number;seq:string}>(
   `SELECT e.id event_id,l.revision_no,q.thread_seq::text seq FROM source_events e
    JOIN LATERAL (SELECT x.id,x.revision_no FROM source_event_revisions x WHERE x.source_event_id=e.id ORDER BY x.edited_at DESC NULLS LAST,x.revision_no DESC LIMIT 1) l ON true
    JOIN source_revision_positions q ON q.revision_id=l.id WHERE e.thread_key=$1 ORDER BY q.thread_seq DESC LIMIT $2`,[key,size]);
  return {r,latest};
 };
 /** The work of the statement that `threadFreshness` sends, as the database counts it: the blocks of the shared buffers that it touched, in the cache or not. Not a time. */
 const blocksOf=async(tx:Queryable,sql:string,params:unknown[])=>{
  const raw=(await tx.query<{'QUERY PLAN':unknown}>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,params)).rows[0]['QUERY PLAN'];
  const plan=(typeof raw==='string'?JSON.parse(raw):raw) as {Plan:Record<string,number>}[];
  return plan[0].Plan['Shared Hit Blocks']+plan[0].Plan['Shared Read Blocks'];
 };

 test('T21 many pairs on a long thread: the answer is right (one older revision among a hundred pairs is a change; a hundred latest revisions are not), and the work does not grow with the product of pairs and messages',async()=>{
  const {r,latest}=await bulkThread(600,100);
  expect(latest).toHaveLength(100);
  // every revision among the hundred is a second revision; the first of the list holds the highest number, which is the head of the thread
  expect(latest.every(x=>x.revision_no===2)).toBe(true);
  const head=await headOf(r.id);
  expect(latest[0].seq).toBe(head);
  const named=latest.map(x=>x.event_id),pairs=latest.map(x=>pair(x.event_id,x.revision_no));
  const sent:{sql:string;params:unknown[]}[]=[];
  await scoped(h.db,salesScope,async tx=>{
   const spy:Queryable={query:async<T=Record<string,unknown>>(sql:string,p?:unknown[])=>{sent.push({sql,params:p??[]});return tx.query<T>(sql,p);}};
   // all of them are the latest revision of their message, and the one with the highest number is the head: nothing changed
   expect(await threadFreshness(spy,ids.sales,r.id,named,pairs)).toEqual({hasBaseline:true,changed:false,position:head});
   // the work: far above what one probe of the index for each pair and one pass over the thread cost, and far below the product of the two
   const blocks=await blocksOf(tx,sent[0].sql,sent[0].params);
   expect(blocks,'blocks touched: '+blocks).toBeLessThan(BLOCKS_LIMIT);
   // one of them names the first revision of its message instead (not the one of the head): changed, by the rule of the latest revision alone, the baseline still being the head
   const old=pairs.map((x,i)=>i===1?pair(x.id,1):x);
   expect(await threadFreshness(tx,ids.sales,r.id,named,old)).toEqual({hasBaseline:true,changed:true,position:head});
  });
 });
});
