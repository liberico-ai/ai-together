import {afterEach,beforeEach,expect,test,describe} from 'vitest';
import {randomUUID} from 'node:crypto';
import {FeedbackService} from '../src/server/feedback';
import {ids} from '../src/server/identities';
import {native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';

describe.skipIf(!native)('feedback resolve concurrency (native PostgreSQL)',()=>{
 let h:Harness;
 beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
 afterEach(async()=>{await h.reset();await h.close();});

 test('resolve: two identical concurrent requests apply once and replay once',async()=>{
  const service=new FeedbackService(h.db);
  const a=(await service.create(pm,{projectId:ids.sales,kind:'bug',title:'Concurrent report',
   description:'Synthetic concurrency description of a reported issue',pagePath:'/feedback',requestKey:randomUUID()})).id;
  const k=randomUUID();
  const cmd={projectId:ids.sales,reportId:a,requestKey:k,expectedVersion:1,state:'closed',reason:'Concurrent resolution'};
  let both!:Promise<PromiseSettledResult<{id:string;replayed:boolean}>[]>;
  await h.operator.transaction(async tx=>{
   await tx.query('SELECT id FROM feedback_reports WHERE id=$1 FOR UPDATE',[a]);
   both=Promise.allSettled([service.resolve(pm,cmd),service.resolve(pm,cmd)]);
   await waitForBlocked(h,2); // both resolves wait on the row lock; commit releases it
  });
  const res=await both;
  expect(res.map(r=>r.status)).toEqual(['fulfilled','fulfilled']);
  const v=res.map(r=>(r as PromiseFulfilledResult<{id:string;replayed:boolean}>).value);
  expect(v[0].id).toBe(v[1].id);
  expect(v.filter(x=>!x.replayed)).toHaveLength(1);expect(v.filter(x=>x.replayed)).toHaveLength(1);
  expect((await h.operator.query('SELECT state,version FROM feedback_reports WHERE id=$1',[a])).rows[0]).toMatchObject({state:'closed',version:2});
  expect(Number((await h.operator.query<{n:string}>('SELECT count(*) n FROM feedback_actions')).rows[0].n)).toBe(1);
 });
});
