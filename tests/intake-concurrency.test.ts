import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';
import {bridgeConfig,intakePrincipalId,messageEvent} from './slice2-fixtures';
import {IntakeService,type IntakeAck} from '../src/server/intake';
import {ids} from '../src/server/identities';

describe.skipIf(!native)('intake ingest concurrency (native PostgreSQL)',()=>{
 let h:Harness;
 beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
 afterEach(async()=>{await h.reset();await h.close();});
 const svc=()=>new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,bridgeConfig.intake!);
 const count=async(t:string)=>Number((await h.operator.query<{n:string}>(`SELECT count(*) n FROM ${t}`)).rows[0].n);

 test('two identical requests in parallel store exactly one source event',async()=>{
  const e=messageEvent({}),s=svc();
  let both!:Promise<PromiseSettledResult<IntakeAck>[]>;
  await h.operator.transaction(async tx=>{
   await tx.query('LOCK TABLE source_events IN SHARE ROW EXCLUSIVE MODE');
   both=Promise.allSettled([s.ingest(e),s.ingest(e)]);
   await waitForBlocked(h,2);
  });
  const res=await both;
  expect(res.map(r=>r.status)).toEqual(['fulfilled','fulfilled']);
  const v=res.map(r=>(r as PromiseFulfilledResult<IntakeAck>).value);
  expect(v[0].sourceEventId).toBe(v[1].sourceEventId);
  expect(v.filter(x=>!x.replayed)).toHaveLength(1);
  expect(await count('source_events')).toBe(1);expect(await count('source_event_revisions')).toBe(1);expect(await count('intake_candidates')).toBe(1);
 });

 test('two different edits in parallel get revision numbers 2 and 3',async()=>{
  const e=messageEvent({}),s=svc();
  await s.ingest(e);
  const edit=(n:string,t:number)=>({...e,editedAt:new Date(1760009999000+t).toISOString(),contentHash:n.repeat(64)});
  const res=await Promise.allSettled([s.ingest(edit('a',0)),s.ingest(edit('b',1000))]);
  expect(res.map(r=>r.status)).toEqual(['fulfilled','fulfilled']);
  const nos=res.map(r=>(r as PromiseFulfilledResult<IntakeAck>).value.revisionNo).sort();
  expect(nos).toEqual([2,3]);
  expect(await count('source_events')).toBe(1);expect(await count('source_event_revisions')).toBe(3);expect(await count('intake_candidates')).toBe(1);
 });
});
