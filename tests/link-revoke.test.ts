// OQ-61 B6 (2): a wrong message–work link is taken back by its own event. The link row is never changed; a revocation row says who, when and why.
import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {openHarness,type Harness} from './slice1-db';
import {member,pm,seedSlice1} from './slice1-fixtures';
import {bridgeConfig,chatSales,chatTransport,intakePrincipalId,messageEvent} from './slice2-fixtures';
import {mapDomain,reviewer,seedMembers} from './slice3-fixtures';
import {asRole,chatPool,poolOverride,seedTech,techB} from './pool-fixtures';
import {IntakeService} from '../src/server/intake';
import {PoolService} from '../src/server/intake-pool';
import {InboxService} from '../src/server/inbox';
import {ids} from '../src/server/identities';
import type {Principal} from '../src/server/types';

let h:Harness;
const otherWork='13000000-0000-4000-8000-000000000002';
beforeEach(async()=>{
 h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);await seedTech(h);
 for(const p of [pm,reviewer,member]) await h.operator.query('INSERT INTO identity.tech_roster(tenant_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[ids.tenant,p.id]);
});
afterEach(async()=>{await h.reset();await h.close();});

type R=Record<string,unknown>;
const cfg={chats:bridgeConfig.intake!.chats,excerptChats:[chatSales,chatPool],poolChats:[chatPool]};
const intake=()=>new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,cfg);
const pool=()=>new PoolService(h.db);
const inbox=()=>new InboxService(h.db,[chatSales,chatTransport]);
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const n=async(t:string)=>Number((await rows<{n:string}>(`SELECT count(*) n FROM ${t}`).catch(()=>[{n:'-1'}]))[0].n);
const rid=()=>randomUUID();
type Link={linkId?:string;revoked?:{byName:string;reasonCode:string;at:string}|null;canRevoke?:boolean;workCode:string|null};
type Card={version:number;state:string;trail:{label:string};links:Link[]};
const cmd=async(p:Principal,id:string,body:R)=>await pool().command(p,id,body,rid()) as unknown as Card;
const linkWork=(v:number,workId=ids.pilot as string)=>({kind:'link_work',expectedVersion:v,projectId:ids.sales,classification:'request',workId});
const revoke=(v:number,linkId:string|undefined,reasonCode='wrong_work')=>({kind:'revoke_link',expectedVersion:v,linkId:linkId??rid(),reasonCode});
const poolItem=async()=>(await intake().ingest(messageEvent({...poolOverride()}))).sourceEventId;
const linked=async()=>{const id=await poolItem();const card=await cmd(pm,id,linkWork(1));expect(card.links[0]?.linkId,'the card names its link').toBeTruthy();return {id,card,linkId:card.links[0].linkId!};};
const poolEventKinds=async(id:string)=>(await rows<{kind:string}>('SELECT kind FROM intake_pool_events WHERE pool_item_id=$1 ORDER BY seq',[id])).map(r=>r.kind);

describe('revoking a link of a pool item',()=>{
 test('the creator revokes: one revocation, one event, the version moves, the trail no longer says linked, the card says who and why',async()=>{
  const {id,card,linkId}=await linked();
  expect(card.links[0]).toMatchObject({canRevoke:true,revoked:null});
  expect(card.trail.label).toContain('Đã liên kết');
  const after=await cmd(pm,id,revoke(card.version,linkId));
  expect(after.version).toBe(card.version+1);
  expect(after.trail.label).not.toContain('Đã liên kết');
  expect(after.links[0]).toMatchObject({linkId,canRevoke:false,revoked:{byName:pm.name,reasonCode:'wrong_work'}});
  expect(await n('intake_link_revocations')).toBe(1);
  expect((await poolEventKinds(id)).at(-1)).toBe('pool.link_revoked');
  // every roster member reads pool events, link readers or not: the event names no link and no reason (Codex gate, P0)
  const event=(await rows<{payload:Record<string,unknown>}>("SELECT payload FROM intake_pool_events WHERE pool_item_id=$1 AND kind='pool.link_revoked'",[id]))[0];
  expect(Object.keys(event.payload).sort()).toEqual(['project_id','version_after','version_before']);
  const seen=JSON.stringify((await pool().detail(techB,id)).events);
  expect(seen).not.toContain(linkId);
  expect(seen).not.toContain('wrong_work');
  expect(await n('intake_work_links')).toBe(1);// the link row stays as history
 });

 test('a BoM seat of the project may revoke; another Team Tech member who reads the link may not; one who cannot read it learns nothing',async()=>{
  const {id,card,linkId}=await linked();
  await expect(cmd(member,id,revoke(card.version,linkId))).rejects.toMatchObject({code:'REVOKE_DENIED',status:403});
  await expect(cmd(techB,id,revoke(card.version,linkId))).rejects.toMatchObject({code:'SCOPE_DENIED',status:404});
  expect(await n('intake_link_revocations')).toBe(0);
  await expect(cmd(reviewer,id,revoke(card.version,linkId))).resolves.toMatchObject({version:card.version+1});
 });

 test('the same revoke twice writes once; a stale version writes nothing',async()=>{
  const {id,card,linkId}=await linked();
  await expect(cmd(pm,id,revoke(card.version-1,linkId))).rejects.toMatchObject({code:'REVISION_CONFLICT'});
  expect(await n('intake_link_revocations')).toBe(0);
  const once=await cmd(pm,id,revoke(card.version,linkId));
  const twice=await cmd(pm,id,revoke(card.version,linkId));
  expect(twice.version).toBe(once.version);
  expect(await n('intake_link_revocations')).toBe(1);
  expect((await poolEventKinds(id)).filter(k=>k==='pool.link_revoked')).toHaveLength(1);
 });

 test('the revoked pair is not linked again; another work is',async()=>{
  const {id,card,linkId}=await linked();
  const after=await cmd(pm,id,revoke(card.version,linkId));
  await expect(cmd(pm,id,linkWork(after.version))).rejects.toMatchObject({code:'LINK_REVOKED',status:409});
  const relinked=await cmd(pm,id,linkWork(after.version,otherWork));
  expect(relinked.links.filter(l=>!l.revoked)).toHaveLength(1);
 });

 test('an item whose only link was revoked opens again; before the revoke it does not',async()=>{
  const {id,card,linkId}=await linked();
  await expect(cmd(pm,id,{kind:'reopen',expectedVersion:card.version})).rejects.toMatchObject({code:'POOL_ASSIGNED'});
  const after=await cmd(pm,id,revoke(card.version,linkId,'wrong_project'));
  await expect(cmd(pm,id,{kind:'reopen',expectedVersion:after.version})).resolves.toMatchObject({state:'unassigned'});
 });
});

describe('revoking a link of a candidate',()=>{
 test('the revoke writes candidate.link_revoked once for one key and the trail drops the link',async()=>{
  const ack=await intake().ingest(messageEvent({}));
  const cid=(await rows<{id:string}>('SELECT id FROM intake_candidates WHERE root_source_event_id=$1',[ack.sourceEventId]))[0].id;
  await inbox().command(pm,cid,{kind:'confirm',expectedVersion:1,classification:'incident'},rid(),rid());
  const linkedCard=await inbox().command(pm,cid,{kind:'link_work',expectedVersion:2,workId:ids.pilot},rid(),rid()) as unknown as Card;
  const linkId=linkedCard.links?.[0]?.linkId;
  expect(linkId,'the candidate card lists its links').toBeTruthy();
  const key=rid(),body=revoke(linkedCard.version,linkId,'wrong_message');
  const after=await inbox().command(pm,cid,body,key,rid()) as unknown as Card;
  await inbox().command(pm,cid,body,key,rid());
  expect(after.trail.label).not.toContain('Đã liên kết');
  expect(after.links[0]).toMatchObject({revoked:{reasonCode:'wrong_message'}});
  expect((await rows<{kind:string}>("SELECT kind FROM intake_events WHERE entity_id=$1 AND kind='candidate.link_revoked'",[cid]))).toHaveLength(1);
 });
});

describe('the database keeps revocations append-only and in the actor\'s name',()=>{
 test('no update or delete, and no row in another person\'s name',async()=>{
  const {id,card,linkId}=await linked();
  await cmd(pm,id,revoke(card.version,linkId));
  const ctx={projects:[ids.sales],person:pm.id};
  await expect(asRole(h,'libetech_runtime',ctx,tx=>tx.query("UPDATE intake_link_revocations SET reason_code='mistake'"))).rejects.toThrow(/permission denied/);
  await expect(asRole(h,'libetech_runtime',ctx,tx=>tx.query('DELETE FROM intake_link_revocations'))).rejects.toThrow(/permission denied/);
  const item=await poolItem();const second=await cmd(pm,item,linkWork(1,otherWork));
  await expect(asRole(h,'libetech_runtime',ctx,tx=>tx.query(
   `INSERT INTO intake_link_revocations(tenant_id,project_id,link_id,revoked_by,revoked_by_name,reason_code) VALUES($1,$2,$3,$4,'Tên thử','mistake')`,
   [ids.tenant,ids.sales,second.links[0].linkId,reviewer.id]))).rejects.toThrow(/row-level security/);
  await expect(h.operator.query("UPDATE intake_link_revocations SET reason_code='mistake'")).rejects.toThrow(/Append-only/);
 });

 test('a creator who left Team Tech cannot revoke a pool link, not even straight under the runtime role (Codex gate, P1)',async()=>{
  const {linkId}=await linked();
  await h.operator.query('DELETE FROM identity.tech_roster WHERE user_id=$1',[pm.id]);
  await expect(asRole(h,'libetech_runtime',{projects:[ids.sales],person:pm.id},tx=>tx.query(
   `INSERT INTO intake_link_revocations(tenant_id,project_id,link_id,revoked_by,revoked_by_name,reason_code) VALUES($1,$2,$3,$4,'Tên thử','mistake')`,
   [ids.tenant,ids.sales,linkId,pm.id]))).rejects.toThrow(/row-level security/);
 });

 test('IBS HI: a revocation holds no free text but the name of who revoked, and no refusal names a project',async()=>{
  await mapDomain(h,ids.sales,'IBS_HI');
  const {id,card,linkId}=await linked();
  const denied=await cmd(member,id,revoke(card.version,linkId)).then(()=>null,(e:Error)=>e.message);
  expect(denied).toBeTruthy();
  expect(denied!).not.toContain('Cổng bán hàng mẫu');
  const cols=(await rows<{c:string}>("SELECT column_name c FROM information_schema.columns WHERE table_name='intake_link_revocations' AND data_type='text' ORDER BY 1")).map(r=>r.c);
  expect(cols).toEqual(['reason_code','revoked_by_name']);
  await expect(cmd(pm,id,{...revoke(card.version,linkId),reasonCode:'chữ nghiệp vụ tự do'})).rejects.toThrow();
 });
});

test('migration 030 applies twice; its rollback refuses while a revocation exists, then restores 025 and runs again',async()=>{
 const sql=(p:string)=>readFile(path.join(process.cwd(),'migrations',p),'utf8').catch(()=>'');
 const exec=async(text:string)=>{try{await h.exec(text);}catch(error){await h.exec('ROLLBACK');throw error;}};
 const forward=await sql('030_intake_link_revocations.sql'),rollback=await sql('rollback/030_intake_link_revocations.sql');
 await exec(forward);await exec(forward);
 const outsideBody=async()=>(await rows<{d:string}>("SELECT pg_get_functiondef('public.intake_pool_links_outside(uuid,uuid,uuid[])'::regprocedure) d"))[0].d;
 const kinds=async()=>(await rows<{d:string}>("SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conrelid='public.intake_pool_events'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%pool.reopened%'")).map(r=>r.d);
 expect(await outsideBody()).toMatch(/intake_link_revocations/);
 expect((await kinds())[0]).toMatch(/pool\.link_revoked/);
 // the closed payload rule of 025 is not widened: no event can carry a link id or a reason
 const payloadRule=async()=>(await rows<{d:string}>("SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conrelid='public.intake_pool_events'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%dismiss_code%'"))[0].d;
 expect(await payloadRule()).not.toMatch(/link_id|reason_code/);
 const {id,card,linkId}=await linked();await cmd(pm,id,revoke(card.version,linkId));
 await expect(exec(rollback)).rejects.toThrow(/revocation/i);
 // clean the history (test copy only) and roll back: the 025 function and check come back
 await h.operator.transaction(async tx=>{await tx.query('SET LOCAL session_replication_role = replica');
  await tx.query('DELETE FROM intake_link_revocations');await tx.query("DELETE FROM intake_pool_events WHERE kind='pool.link_revoked'");});
 await exec(rollback);
 expect(await outsideBody()).not.toMatch(/intake_link_revocations/);
 expect((await kinds())[0]).not.toMatch(/pool\.link_revoked/);
 expect(await rows("SELECT to_regclass('public.intake_link_revocations')::text t")).toEqual([{t:null}]);
 await exec(rollback);await exec(forward);
});
