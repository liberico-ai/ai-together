import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {createHash,randomUUID} from 'node:crypto';
import {readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {openHarness,type Harness} from './slice1-db';
import {outsider,pm,seedSlice1} from './slice1-fixtures';
import {bridgeConfig,chatSales,chatTransport,intakePrincipalId,messageEvent,type EventOverride} from './slice2-fixtures';
import {mapDomain,nextDbInstant,recordingDb} from './slice3-fixtures';
import {IntakeService} from '../src/server/intake';
import {InboxService} from '../src/server/inbox';
import {displayMode,listVisibleRevisions,threadFreshness,threadHasHiddenText} from '../src/server/source-text';
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

 test('only source-text.ts reads revision text',()=>{
  const files:string[]=[];
  const walk=(d:string)=>{for(const e of readdirSync(d,{withFileTypes:true})) {const p=path.join(d,e.name);if(e.isDirectory()) walk(p);else if(/\.tsx?$/.test(e.name)) files.push(p);}};
  walk(path.join(process.cwd(),'src'));
  const having=(s:string)=>files.filter(f=>readFileSync(f,'utf8').includes(s)).map(f=>path.relative(process.cwd(),f).split(path.sep).join('/')).sort();
  expect(having('text_excerpt')).toEqual(['src/server/intake.ts','src/server/source-text.ts']);
  expect(having('source_event_revisions')).toEqual(['src/server/intake.ts','src/server/source-text.ts']);
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
});

describe('threadFreshness',()=>{
 const none={hasBaseline:false,newerMessage:false,laterEdit:false};
 const ask=(projectId:string,candidateId:string,named:readonly string[],scope=salesScope)=>scoped(h.db,scope,tx=>threadFreshness(tx,projectId,candidateId,named));
 const root=async(text:string)=>{
  const e=messageEvent({text});
  const ack=await intake([chatSales]).ingest(e);
  const id=(await rows<{id:string}>('SELECT id FROM intake_candidates WHERE root_source_event_id=$1',[ack.sourceEventId]))[0].id;
  return {e,id,sourceEventId:ack.sourceEventId};
 };
 const reply=async(r:{e:ReturnType<typeof messageEvent>},text:string)=>
  (await intake([chatSales]).ingest(messageEvent({text,context:{replyToMessageId:r.e.context.messageId}}))).sourceEventId;
 const editOf=(e:ReturnType<typeof messageEvent>,text:string)=>intake([chatSales]).ingest({...e,text,contentHash:'e'.repeat(64),editedAt:new Date(1760099999000).toISOString(),traceId:randomUUID()});

 test('T6 threadFreshness returns three booleans and no text: the one row handed back holds no excerpt and no content hash',async()=>{
  const r=await root('T6-MARKER-4417');
  const rec=recordingDb(h.db);
  const got=await scoped(rec.db,salesScope,tx=>threadFreshness(tx,ids.sales,r.id,[r.sourceEventId]));
  expect(got).toEqual({hasBaseline:true,newerMessage:false,laterEdit:false});
  const seen=rec.rows().filter(x=>(x as Record<string,unknown>).has_baseline!==undefined);
  expect(seen).toHaveLength(1);
  expect(Object.keys(seen[0] as object).sort()).toEqual(['has_baseline','later_edit','newer_message']);
  expect(JSON.stringify(rec.rows())).not.toContain('T6-MARKER-4417');
  expect(JSON.stringify(rec.rows())).not.toContain(createHash('sha256').update('T6-MARKER-4417').digest('hex'));
 });

 test('T7 threadFreshness: baseline, newer message, later edit, another project, malformed ids',async()=>{
  const r=await root('T7-ROOT');
  expect(await ask(ids.sales,r.id,[r.sourceEventId])).toEqual({hasBaseline:true,newerMessage:false,laterEdit:false});
  expect(await ask(ids.sales,r.id,[])).toEqual(none);
  expect(await ask(ids.sales,r.id,[randomUUID()])).toEqual(none);
  await nextDbInstant(h);
  const rp=await reply(r,'T7-REPLY');
  expect(await ask(ids.sales,r.id,[r.sourceEventId])).toEqual({hasBaseline:true,newerMessage:true,laterEdit:false});
  expect(await ask(ids.sales,r.id,[rp])).toEqual({hasBaseline:true,newerMessage:false,laterEdit:false});
  expect(await ask(ids.sales,r.id,[r.sourceEventId,rp])).toEqual({hasBaseline:true,newerMessage:false,laterEdit:false});
  await editOf(r.e,'T7-ROOT-EDITED');
  expect(await ask(ids.sales,r.id,[r.sourceEventId,rp])).toEqual({hasBaseline:true,newerMessage:false,laterEdit:true});
  expect(await ask(ids.transport,r.id,[r.sourceEventId],{...pm,projectIds:[ids.transport]})).toEqual(none);
  expect(await ask(ids.sales,r.id,['x',r.sourceEventId.toUpperCase()])).toEqual(none);
  const trap:Queryable={query:async()=>{throw new Error('statement sent');}};
  expect(await threadFreshness(trap,ids.sales,'x',[])).toEqual(none);
  expect(await threadFreshness(trap,ids.sales,r.id.toUpperCase(),[])).toEqual(none);
 });

 test('T8 threadFreshness reads nothing for a caller scoped to another tenant',async()=>{
  const r=await root('T8-ROOT');
  await editOf(r.e,'T8-ROOT-EDITED');
  expect(await ask(ids.sales,r.id,[r.sourceEventId],{...outsider,projectIds:[ids.sales]})).toEqual(none);
  expect(await ask(ids.sales,r.id,[r.sourceEventId])).toEqual({hasBaseline:true,newerMessage:false,laterEdit:true});
 });
});
