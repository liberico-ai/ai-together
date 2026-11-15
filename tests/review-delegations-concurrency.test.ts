import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {native,openHarness,type Harness} from './slice1-db';
import {member,pm,seedSlice1} from './slice1-fixtures';
import {delegate,seedMembers} from './slice3-fixtures';
import {DelegationService} from '../src/server/review-delegations';
import {ids} from '../src/server/identities';
import type {Principal} from '../src/server/types';

// Two connections of the pool run the service at once; the unique index of live designations and the row lock decide, not a read before the write.
describe.skipIf(!native)('delegation concurrency (native PostgreSQL)',()=>{
 let h:Harness;
 const pm2:Principal={id:'14000000-0000-4000-8000-000000000051',tenantId:ids.tenant,projectIds:[ids.sales],name:'Điều phối đồng thời mẫu',role:'manager',
  grants:[{projectId:ids.sales,role:'manager',reportPermissions:[]}]};
 beforeEach(async()=>{
  h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);
  await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'slice3-7a-conc',$3,'manager','fixture-only') ON CONFLICT DO NOTHING`,[pm2.id,pm2.tenantId,pm2.name]);
  await h.operator.query("INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'manager') ON CONFLICT DO NOTHING",[pm2.tenantId,pm2.id,ids.sales]);
 });
 afterEach(async()=>{await h.reset();await h.close();});
 const n=async(sql:string)=>Number((await h.operator.query<{n:string}>(`SELECT count(*) n FROM ${sql}`)).rows[0].n);
 const codes=(res:PromiseSettledResult<unknown>[])=>res.map(r=>r.status==='fulfilled'?'ok':(r.reason as {code?:string}).code);

 test('two managers designating the same member at once store one active delegation',async()=>{
  const svc=new DelegationService(h.db);
  const raw={projectId:ids.sales,delegateId:member.id,docTypes:['design'],basis:'Điều phối giao nhận xét tài liệu'};
  const res=await Promise.allSettled([svc.grant(pm,raw,randomUUID(),randomUUID()),svc.grant(pm2,raw,randomUUID(),randomUUID())]);
  expect(codes(res).sort()).toEqual(['DELEGATION_EXISTS','ok']);
  expect(await n('review_delegations WHERE revoked_at IS NULL')).toBe(1);
  expect(await n('review_events')).toBe(1);
  expect(await n('document_commands')).toBe(1);
 });

 test('two managers revoking the same delegation at once store one revoke',async()=>{
  const id=await delegate(h,ids.sales,member.id);
  const svc=new DelegationService(h.db);
  const raw={expectedVersion:1,basis:'Hết nhiệm vụ nhận xét tài liệu'};
  const res=await Promise.allSettled([svc.revoke(pm,id,raw,randomUUID(),randomUUID()),svc.revoke(pm2,id,raw,randomUUID(),randomUUID())]);
  expect(codes(res).sort()).toEqual(['DELEGATION_CONFLICT','ok']);
  expect(await n('review_delegations WHERE revoked_at IS NOT NULL')).toBe(1);
  expect((await h.operator.query<{version:number}>('SELECT version FROM review_delegations WHERE id=$1',[id])).rows[0].version).toBe(2);
  expect(await n("review_events WHERE kind='delegation.revoked'")).toBe(1);
  expect(await n('document_commands')).toBe(1);
 });
});
