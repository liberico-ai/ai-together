import { afterEach,beforeEach,expect,test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { embeddedDatabase,type Database } from '../src/server/db';
import { seed } from '../src/server/seed';
import { demoProfiles as profiles,ids } from '../src/server/identities';
import { FeedbackService } from '../src/server/feedback';

let db:Database,service:FeedbackService,a:string,b:string;
const p={...profiles.manager,grants:[{projectId:ids.sales,role:'manager' as const,reportPermissions:[]}]};
const base={projectId:ids.sales,kind:'bug',description:'Synthetic regression description of a reported issue',pagePath:'/feedback'};
const cmd=(reportId:string,requestKey:string,extra:object={})=>({projectId:ids.sales,reportId,requestKey,
 expectedVersion:1,state:'closed',reason:'Regression resolution',...extra});
const state=async(id:string)=>(await db.query<{state:string;version:number}>(
 'SELECT state,version FROM feedback_reports WHERE id=$1',[id])).rows[0];
const actions=async()=>Number((await db.query<{n:string}>('SELECT count(*) n FROM feedback_actions')).rows[0].n);

beforeEach(async()=>{
 db=await embeddedDatabase();await seed(db);service=new FeedbackService(db);
 await db.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash)
  VALUES($1,$2,'fb.idem','Idem','manager','fixture-only')`,[p.id,p.tenantId]);
 a=(await service.create(p,{...base,title:'Report Alpha',requestKey:randomUUID()})).id;
 b=(await service.create(p,{...base,title:'Report Bravo',requestKey:randomUUID()})).id;
});
afterEach(async()=>db.close());

test('resolve: same key and identical request replays without a second state change',async()=>{
 const k=randomUUID(),first=await service.resolve(p,cmd(a,k));
 expect(await service.resolve(p,cmd(a,k))).toEqual({id:first.id,replayed:true});
 expect(await state(a)).toMatchObject({state:'closed',version:2});expect(await actions()).toBe(1);
});
test('resolve: same key for a different report is FEEDBACK_KEY_CONFLICT and leaves it unchanged',async()=>{
 const k=randomUUID();await service.resolve(p,cmd(a,k));
 await expect(service.resolve(p,cmd(b,k))).rejects.toMatchObject({code:'FEEDBACK_KEY_CONFLICT',status:409});
 expect(await state(b)).toMatchObject({state:'new',version:1});expect(await actions()).toBe(1);
});
test('resolve: same key and report with different status, reason or version is FEEDBACK_KEY_CONFLICT',async()=>{
 const k=randomUUID();await service.resolve(p,cmd(a,k,{state:'reviewing'}));
 await expect(service.resolve(p,cmd(a,k,{state:'closed'}))).rejects.toMatchObject({code:'FEEDBACK_KEY_CONFLICT'});
 await expect(service.resolve(p,cmd(a,k,{state:'reviewing',reason:'Lý do khác hẳn'}))).rejects.toMatchObject({code:'FEEDBACK_KEY_CONFLICT'});
 await expect(service.resolve(p,cmd(a,k,{state:'reviewing',expectedVersion:2}))).rejects.toMatchObject({code:'FEEDBACK_KEY_CONFLICT'});
 expect(await state(a)).toMatchObject({state:'reviewing',version:2});expect(await actions()).toBe(1);
});
test('resolve: same key reused in another project is FEEDBACK_KEY_CONFLICT although RLS hides the prior action',async()=>{
 const two={...p,grants:[{projectId:ids.sales,role:'manager' as const,reportPermissions:[]},
  {projectId:ids.transport,role:'manager' as const,reportPermissions:[]}]};
 const c=(await service.create(two,{...base,projectId:ids.transport,title:'Report Charlie',requestKey:randomUUID()})).id;
 const k=randomUUID();await service.resolve(two,cmd(a,k));
 await expect(service.resolve(two,cmd(c,k,{projectId:ids.transport}))).rejects.toMatchObject({code:'FEEDBACK_KEY_CONFLICT',status:409});
 expect(await state(c)).toMatchObject({state:'new',version:1});expect(await actions()).toBe(1);
});
test('create: same key with a different payload is rejected (guard)',async()=>{
 const k=randomUUID(),first=await service.create(p,{...base,title:'Guard report',requestKey:k});
 expect(await service.create(p,{...base,title:'Guard report',requestKey:k})).toEqual({id:first.id,replayed:true});
 await expect(service.create(p,{...base,title:'Guard changed',requestKey:k})).rejects.toMatchObject({code:'FEEDBACK_KEY_CONFLICT'});
 await expect(service.create(p,{...base,title:'Guard report',kind:'idea',requestKey:k})).rejects.toMatchObject({code:'FEEDBACK_KEY_CONFLICT'});
});
