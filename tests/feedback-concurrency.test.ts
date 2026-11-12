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

 // Behaviour-preserving case: may already be green before the ON CONFLICT claim, via the 23505 catch.
 test('resolve: one key raced across two reports applies once and conflicts once',async()=>{
  const service=new FeedbackService(h.db);
  const mk=async(t:string)=>(await service.create(pm,{projectId:ids.sales,kind:'bug',title:t,
   description:'Synthetic concurrency description of a reported issue',pagePath:'/feedback',requestKey:randomUUID()})).id;
  const a=await mk('Race report A'),b=await mk('Race report B'),k=randomUUID();
  const c=(reportId:string)=>({projectId:ids.sales,reportId,requestKey:k,expectedVersion:1,state:'closed',reason:'Concurrent resolution'});
  let both!:Promise<PromiseSettledResult<{id:string;replayed:boolean}>[]>;
  await h.operator.transaction(async tx=>{
   await tx.query('SELECT id FROM feedback_reports WHERE id=ANY($1::uuid[]) FOR UPDATE',[[a,b]]);
   both=Promise.allSettled([service.resolve(pm,c(a)),service.resolve(pm,c(b))]);
   await waitForBlocked(h,2);
  });
  const res=await both;
  const ok=res.filter(r=>r.status==='fulfilled') as PromiseFulfilledResult<{id:string;replayed:boolean}>[];
  const bad=res.filter(r=>r.status==='rejected') as PromiseRejectedResult[];
  expect(ok).toHaveLength(1);expect(ok[0].value.replayed).toBe(false);
  expect(bad).toHaveLength(1);expect(bad[0].reason).toMatchObject({code:'FEEDBACK_KEY_CONFLICT',status:409});
  const st=async(id:string)=>(await h.operator.query('SELECT state,version FROM feedback_reports WHERE id=$1',[id])).rows[0];
  const [sa,sb]=[await st(a),await st(b)];
  const closed=[sa,sb].filter(r=>r.state==='closed'),fresh=[sa,sb].filter(r=>r.state==='new');
  expect(closed).toEqual([{state:'closed',version:2}]);expect(fresh).toEqual([{state:'new',version:1}]);
  expect(Number((await h.operator.query<{n:string}>('SELECT count(*) n FROM feedback_actions')).rows[0].n)).toBe(1);
 });

 test('resolve: one key reused in another project conflicts although RLS hides the prior action (native)',async()=>{
  const service=new FeedbackService(h.db);
  const mk=async(projectId:string,t:string)=>(await service.create(pm,{projectId,kind:'bug',title:t,
   description:'Synthetic concurrency description of a reported issue',pagePath:'/feedback',requestKey:randomUUID()})).id;
  const a=await mk(ids.sales,'Cross report A'),c=await mk(ids.transport,'Cross report C'),k=randomUUID();
  const cmd=(projectId:string,reportId:string)=>({projectId,reportId,requestKey:k,expectedVersion:1,state:'closed',reason:'Cross project resolution'});
  await service.resolve(pm,cmd(ids.sales,a));
  await expect(service.resolve(pm,cmd(ids.transport,c))).rejects.toMatchObject({code:'FEEDBACK_KEY_CONFLICT',status:409});
  expect((await h.operator.query('SELECT state,version FROM feedback_reports WHERE id=$1',[c])).rows[0]).toMatchObject({state:'new',version:1});
  expect(Number((await h.operator.query<{n:string}>('SELECT count(*) n FROM feedback_actions')).rows[0].n)).toBe(1);
 });
});
