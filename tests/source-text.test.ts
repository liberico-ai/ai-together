import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {openHarness,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {bridgeConfig,chatSales,chatTransport,intakePrincipalId,messageEvent,type EventOverride} from './slice2-fixtures';
import {mapDomain,recordingDb} from './slice3-fixtures';
import {IntakeService} from '../src/server/intake';
import {InboxService} from '../src/server/inbox';
import {displayMode,listVisibleRevisions} from '../src/server/source-text';
import {scoped} from '../src/server/db';
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
  const steps:(['XECA'|'LIBERICO_BU'|'IBS_HI'|null])[]=[[null],['XECA'],['LIBERICO_BU'],['IBS_HI'],['XECA']];
  let version=0;
  for(const [latest] of steps) {
   if(latest) await mapDomain(h,ids.sales,latest,++version);
   for(const flagged of [true,false]) {
    for(const [m,mode] of [[stored,'excerpt'],[pointer,'pointer_only']] as const) {
     const revs=await scoped(h.db,salesScope,tx=>listVisibleRevisions(tx,m.sourceEventId,flagged?[chatSales]:[]));
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
  ['the group flag is removed',async()=>({flags:[] as string[],pointerOnly:false})],
  ['the project is mapped to IBS_HI',async()=>{await mapDomain(h,ids.sales,'IBS_HI',1);return {flags:[chatSales],pointerOnly:false};}],
  ['the service is built without flags',async()=>({flags:undefined,pointerOnly:false})],
  ['the message stored only a pointer',async()=>({flags:[chatSales],pointerOnly:true})],
 ] as const)('no row handed to the service carries hidden or pointer-only text or hash: %s',(_n,setup)=>{
  test('hidden',async()=>{
   const marker='ZEBRA-MARKER-5521 nội dung';
   const cfg=await setup();
   const m=await ingest({text:marker},cfg.pointerOnly?undefined:[chatSales]);
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
