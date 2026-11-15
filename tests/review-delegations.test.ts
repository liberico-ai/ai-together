import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {ZodError} from 'zod';
import {openHarness,type Harness} from './slice1-db';
import {bot,member,outsider,pm,seedSlice1,viewer} from './slice1-fixtures';
import {approver,delegate,frozenRevision,grantDocApproval,registerDoc,reviewer,revokeDelegation,seedMembers,transportApprover} from './slice3-fixtures';
import {DelegationService} from '../src/server/review-delegations';
import {ReviewService} from '../src/server/document-review';
import type {Database,Queryable} from '../src/server/db';
import {ids} from '../src/server/identities';
import type {Principal} from '../src/server/types';

// Slice 3 Task 7a: a manager of the project designates a member as commenter for named document types; any manager of that project revokes.
// Authority is read from the database inside the writing transaction; the two guards (LTR02, LTR03) are the last line. Nothing here approves anything.
let h:Harness;
const mk=(id:string,name:string,grants:{projectId:string;role:string}[],role:string):Principal=>({id,tenantId:ids.tenant,projectIds:grants.map(g=>g.projectId),name,role:role as Principal['role'],
 grants:grants.map(g=>({projectId:g.projectId,role:g.role as NonNullable<Principal['grants']>[number]['role'],reportPermissions:[]}))});
const pm2=mk('14000000-0000-4000-8000-000000000041','Điều phối thứ hai mẫu',[{projectId:ids.sales,role:'manager'}],'manager');           // second manager of sales
const tm=mk('14000000-0000-4000-8000-000000000042','Điều phối Vận tải mẫu',[{projectId:ids.transport,role:'manager'}],'manager');          // manager of transport only
const split=mk('14000000-0000-4000-8000-000000000043','Điều phối tách vai mẫu',[{projectId:ids.transport,role:'manager'},{projectId:ids.sales,role:'engineer'}],'manager');
const salesViewer=mk('14000000-0000-4000-8000-000000000044','Người xem Bán hàng mẫu',[{projectId:ids.sales,role:'viewer'}],'viewer');
const disabled=mk('14000000-0000-4000-8000-000000000045','Tài khoản khoá mẫu',[{projectId:ids.sales,role:'engineer'}],'engineer');
const business2=mk('14000000-0000-4000-8000-000000000046','Nghiệp vụ thứ hai mẫu',[{projectId:ids.sales,role:'business'}],'business');
const technical2=mk('14000000-0000-4000-8000-000000000047','Kỹ thuật thứ hai mẫu',[{projectId:ids.sales,role:'technical'}],'technical');
const NAMES=[pm,pm2,tm,split,salesViewer,disabled,member,reviewer,approver,transportApprover,business2,technical2].map(p=>p.name);

beforeEach(async()=>{
 h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);
 for(const [i,p] of [pm2,tm,split,salesViewer,disabled,business2,technical2].entries()) {
  await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,$4,$5,'fixture-only') ON CONFLICT DO NOTHING`,[p.id,p.tenantId,'slice3-7a-'+i,p.name,p.role]);
  for(const g of p.grants!) await h.operator.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[p.tenantId,p.id,g.projectId,g.role]);
 }
 await h.operator.query('UPDATE identity.users SET active=false WHERE id=$1',[disabled.id]);
});
afterEach(async()=>{await h.reset();await h.close();});

type R=Record<string,unknown>;
const svc=(db:Database=h.db)=>new DelegationService(db);
const k=()=>randomUUID();
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const n=async(t:string)=>Number((await rows<{n:string}>(`SELECT count(*) n FROM ${t}`))[0].n);
const NOT_FOUND='Không tìm thấy mục trong phạm vi được cấp.';
const BASIS='Điều phối giao nhận xét tài liệu thiết kế';
const G=(over:R={}):R=>({projectId:ids.sales,delegateId:member.id,docTypes:['design'],basis:BASIS,...over});
const V=(version:number,over:R={}):R=>({expectedVersion:version,basis:'Thu hồi vì hết nhiệm vụ nhận xét',...over});
const grant=(p:Principal,raw:unknown,key:string=k(),db?:Database)=>svc(db).grant(p,raw,key,k());
const revoke=(p:Principal,id:string,raw:unknown,key:string=k(),db?:Database)=>svc(db).revoke(p,id,raw,key,k());
const refused=async(p:Promise<unknown>,code:string,status:number)=>{
 const e=await p.then(()=>null,x=>x);
 expect(e,'expected a refusal').toBeTruthy();
 expect(e).toMatchObject({code,status});
 for(const name of NAMES) expect((e as Error).message).not.toContain(name);
 return e as Error;
};
const zodRefused=async(p:Promise<unknown>)=>{const e=await p.then(()=>null,x=>x);expect(e).toBeInstanceOf(ZodError);};
const snap=async()=>({delegations:await rows('SELECT * FROM review_delegations ORDER BY id'),events:await n('review_events'),commands:await n('document_commands'),decisions:await n('review_decisions'),comments:await n('review_comments')});
const setDbRole=(userId:string,project:string,role:string)=>h.operator.query('UPDATE identity.memberships SET project_role=$3 WHERE user_id=$1 AND project_id=$2',[userId,project,role]);
/** The service's own read of a person's project role answers `role` while the database says otherwise: the guard trigger must still refuse. */
function staleRead(db:Database,personId:string,role:string):Database {
 const wrap=(q:Queryable):Queryable=>({query:async<T=Record<string,unknown>>(sql:string,params?:unknown[])=>{
  if(/bom_eligible_members/.test(sql)&&params?.[1]===personId) return {rows:[{user_id:personId,project_role:role}] as T[]};
  return q.query<T>(sql,params);
 }});
 return {...wrap(db),transaction:fn=>db.transaction(tx=>fn(wrap(tx))),close:()=>db.close()};
}
function failOn(db:Database,pattern:RegExp,code:string):Database {
 const wrap=(q:Queryable):Queryable=>({query:async<T=Record<string,unknown>>(sql:string,params?:unknown[])=>{
  if(pattern.test(sql)) throw Object.assign(new Error('synthetic database refusal'),{code});
  return q.query<T>(sql,params);
 }});
 return {...wrap(db),transaction:fn=>db.transaction(tx=>fn(wrap(tx))),close:()=>db.close()};
}

describe('designating a commenter',()=>{
 test('a project manager designates a member as reviewer for named document types, once',async()=>{
  const key=k(),req=k();
  const v=await svc().grant(pm,G({docTypes:['plan','design']}),key,req);
  expect(v).toMatchObject({projectId:ids.sales,delegateId:member.id,docTypes:['design','plan'],grantedBy:pm.id,basis:BASIS,revokedAt:null,revokedBy:null,revokeBasis:null,version:1});
  expect(await n('review_delegations')).toBe(1);expect(await n('review_events')).toBe(1);
  const ev=(await rows<{entity_type:string;kind:string;actor_id:string;entity_id:string;payload:R}>('SELECT entity_type,kind,actor_id,entity_id,payload FROM review_events'))[0];
  expect(ev).toMatchObject({entity_type:'review_delegation',kind:'delegation.granted',actor_id:pm.id,entity_id:v.id});
  expect(ev.payload).toEqual({delegateId:member.id,docTypes:['design','plan']});
  expect(JSON.stringify(ev.payload)).not.toContain(BASIS);
  const again=await svc().grant(pm,G({docTypes:['plan','design']}),key,k());
  expect(again).toEqual(v);expect(await n('review_delegations')).toBe(1);expect(await n('review_events')).toBe(1);
  await refused(grant(pm,G({docTypes:['plan','design']}),k()),'DELEGATION_EXISTS',409);
  await refused(grant(pm2,G(),k()),'DELEGATION_EXISTS',409);
  await refused(grant(pm,G({docTypes:['guide']}),key),'IDEMPOTENCY_CONFLICT',409);
  expect(await n('review_delegations')).toBe(1);expect(await n('review_events')).toBe(1);
  expect(await n('document_commands')).toBe(1);
 });

 test('OQ-31 (1) (a) a manager cannot designate themself',async()=>{
  const before=await snap();
  for(const p of [pm,pm2]) {
   const e=await refused(grant(p,G({delegateId:p.id})),'DELEGATION_INVALID',422);
   expect(e.message).toBe('Không tự chỉ định chính mình.');
  }
  expect(await snap()).toEqual(before);
 });

 test('OQ-31 (2) (b) a manager of project A cannot designate in project B, and B is not revealed',async()=>{
  const before=await snap();
  const none=await refused(grant(tm,G({projectId:randomUUID()})),'SCOPE_DENIED',404);
  const out=await refused(grant(tm,G({projectId:ids.sales})),'SCOPE_DENIED',404);                        // B not in scope at all
  expect(out.message).toBe(none.message);expect(out.message).toBe(NOT_FOUND);
  const ord=await refused(grant(split,G({projectId:ids.sales})),'MANAGER_REQUIRED',403);               // ordinary member of B
  expect(ord.message).not.toContain('design');
  await refused(grant(split,G({projectId:ids.sales,delegateId:reviewer.id})),'MANAGER_REQUIRED',403);
  await refused(grant(tm,G({projectId:ids.sales,delegateId:transportApprover.id})),'SCOPE_DENIED',404);
  expect(await snap()).toEqual(before);
 });

 test('OQ-31 (4) (c) a designation without document types, with an empty list, an unknown type or a repeat is rejected',async()=>{
  const before=await snap();
  const {docTypes:_omit,...noTypes}=G();
  for(const raw of [noTypes,G({docTypes:[]}),G({docTypes:['not_a_type']}),G({docTypes:['design','design']}),G({docTypes:['design','plan','guide','other','requirements','verification','change_brief','project_index','design']}),
    G({docTypes:'design'}),G({docTypes:[1]})]) await zodRefused(grant(pm,raw));
  expect(await snap()).toEqual(before);
 });

 test('the delegate must be an active member with a reading role; outsider, viewer and disabled account get one same answer (d)',async()=>{
  const before=await snap();
  const msgs:string[]=[];
  for(const delegateId of [transportApprover.id,salesViewer.id,disabled.id,randomUUID()]) {
   const e=await refused(grant(pm,G({delegateId})),'DELEGATION_INVALID',422);
   msgs.push(e.message);
  }
  expect(new Set(msgs).size).toBe(1);
  expect(msgs[0]).toBe('Người được chỉ định phải là thành viên đang hoạt động của dự án.');
  expect(await snap()).toEqual(before);
  for(const p of [reviewer,approver,business2,technical2,pm2]) await grant(pm,G({delegateId:p.id}));      // every reading role is accepted
  expect(await n('review_delegations')).toBe(5);
 });

 test('engineer, technical, business, viewer and bot cannot designate (e)',async()=>{
  const before=await snap();
  for(const p of [member,reviewer,approver]) await refused(grant(p,G({delegateId:pm2.id})),'MANAGER_REQUIRED',403);
  for(const p of [salesViewer,bot,viewer,outsider]) await refused(grant(p,G({delegateId:pm2.id})),'SCOPE_DENIED',404);
  expect(await snap()).toEqual(before);
 });

 test('forged fields are rejected',async()=>{
  const before=await snap();
  for(const extra of [{grantedBy:pm.id},{tenantId:ids.tenant},{capability:'doc.approve'},{approve:true},{revokedAt:new Date().toISOString()},{version:2},{actorId:pm.id},{role:'manager'},{id:randomUUID()}])
   await zodRefused(grant(pm,G(extra)));
  for(const raw of [G({projectId:'not-a-uuid'}),G({delegateId:7}),G({basis:'ngắn'}),G({basis:'x'.repeat(501)}),{...G(),basis:undefined}]) await zodRefused(grant(pm,raw));
  await zodRefused(grant(pm,null));await zodRefused(grant(pm,[]));
  expect(await snap()).toEqual(before);
 });

 test('the basis refuses what PostgreSQL cannot store, control characters and a text that is short once trimmed or counted in characters',async()=>{
  const before=await snap();
  for(const basis of ['Căn cứ\u0000hợp lệ','Căn cứ \uD800 hợp lệ','Căn cứ \uDC00 hợp lệ','Căn cứ\nxuống dòng','Căn cứ\u0085hợp lệ','Căn cứ\u007Fhợp lệ','Căn cứ\thợp lệ','  ab  ','😀😀😀','     '])
   await zodRefused(grant(pm,G({basis})));
  expect(await snap()).toEqual(before);
  await grant(pm,G({basis:'😀😀😀😀😀'}));                                     // five characters, ten UTF-16 units
  expect(await n('review_delegations')).toBe(1);
 });

 test('a failed grant leaves no delegation, no event and no command row',async()=>{
  await delegate(h,ids.sales,reviewer.id);
  const before=await snap();
  const cases:[string,()=>Promise<unknown>,string,number][]=[
   ['self',()=>grant(pm,G({delegateId:pm.id})),'DELEGATION_INVALID',422],
   ['not a member',()=>grant(pm,G({delegateId:transportApprover.id})),'DELEGATION_INVALID',422],
   ['exists',()=>grant(pm,G({delegateId:reviewer.id})),'DELEGATION_EXISTS',409],
   ['not a manager',()=>grant(member,G({delegateId:pm2.id})),'MANAGER_REQUIRED',403],
   ['out of scope',()=>grant(tm,G()),'SCOPE_DENIED',404],
   ['bad key',()=>grant(pm,G(),'short'),'IDEMPOTENCY_REQUIRED',400],
  ];
  for(const [,run,code,status] of cases) {
   const e=await run().then(()=>null,x=>x);
   expect(e).toMatchObject({code,status});
   expect(await snap()).toEqual(before);
  }
 });

 test('an id in upper case is the same person (h), for designation and for revocation',async()=>{
  const before=await snap();
  const e=await refused(grant(pm,G({delegateId:pm.id.toUpperCase()})),'DELEGATION_INVALID',422);
  expect(e.message).toBe('Không tự chỉ định chính mình.');
  await refused(grant(pm,G({delegateId:pm.id.toUpperCase(),projectId:ids.sales.toUpperCase()})),'DELEGATION_INVALID',422);
  expect(await snap()).toEqual(before);
  const v=await grant(pm,G({delegateId:member.id.toUpperCase(),projectId:ids.sales.toUpperCase()}));
  expect(v.delegateId).toBe(member.id);expect(v.projectId).toBe(ids.sales);
  await refused(grant(pm,G({delegateId:member.id})),'DELEGATION_EXISTS',409);                       // same person as the lower-case id
  const r=await revoke(pm,v.id.toUpperCase(),V(v.version));
  expect(r.id).toBe(v.id);expect(r.revokedBy).toBe(pm.id);
 });

 test('the live-designation uniqueness is the unique index, not a read before the write (j)',async()=>{
  const src=await readFile('src/server/review-delegations.ts','utf8');
  expect(src).toMatch(/ON CONFLICT \(tenant_id,project_id,delegate_id\) WHERE revoked_at IS NULL DO NOTHING/);
  expect(src).not.toMatch(/SELECT[^;`]*FROM review_delegations[^;`]*delegate_id\s*=/);
  expect((await rows('SELECT 1 FROM pg_indexes WHERE indexname=$1',['uq_review_delegations_active'])).length).toBe(1);
  await grant(pm,G());
  await refused(grant(pm2,G({docTypes:['plan']})),'DELEGATION_EXISTS',409);
  expect(await n('review_delegations')).toBe(1);
 });
});

describe('stale session role and the database guards',()=>{
 test('a stale session role is answered as out of scope, not as a server error (grant)',async()=>{
  await setDbRole(pm.id,ids.sales,'engineer');                                              // the session still says manager
  const before=await snap();
  const e=await refused(grant(pm,G()),'SCOPE_DENIED',404);
  expect(e.message).toBe(NOT_FOUND);
  expect(await snap()).toEqual(before);
 });
 test('F-1a the service itself re-reads the caller role: a demoted caller who designates themself gets the 404, not the self-designation answer',async()=>{
  await setDbRole(pm.id,ids.sales,'engineer');                                              // session still says manager
  const before=await snap();
  const e=await refused(grant(pm,G({delegateId:pm.id})),'SCOPE_DENIED',404);
  expect(e.message).toBe(NOT_FOUND);
  await refused(grant(pm,G({delegateId:transportApprover.id})),'SCOPE_DENIED',404);       // nor the delegate answer
  expect(await snap()).toEqual(before);
 });
 test('F-1b the service itself re-reads the caller role: a demoted caller with a stale version gets the 404, not DELEGATION_CONFLICT',async()=>{
  const id=await delegate(h,ids.sales,member.id);
  await setDbRole(pm.id,ids.sales,'engineer');
  const before=await snap();
  const e=await refused(revoke(pm,id,V(99)),'SCOPE_DENIED',404);                            // the UPDATE would match 0 rows, so the trigger would never fire
  expect(e.message).toBe(NOT_FOUND);
  expect(await snap()).toEqual(before);
 });
 test('a stale session role: the LTR02 raised by the guard on the INSERT is the same answer (grant)',async()=>{
  await setDbRole(pm.id,ids.sales,'engineer');
  const before=await snap();
  const e=await refused(grant(pm,G(),k(),staleRead(h.db,pm.id,'manager')),'SCOPE_DENIED',404);
  expect(e.message).toBe(NOT_FOUND);
  expect(await snap()).toEqual(before);
 });
 test('the delegate lost the reading role between the read and the INSERT: LTR02 is the same answer',async()=>{
  const before=await snap();
  const e=await refused(grant(pm,G({delegateId:salesViewer.id}),k(),staleRead(h.db,salesViewer.id,'engineer')),'SCOPE_DENIED',404);
  expect(e.message).toBe(NOT_FOUND);
  expect(await snap()).toEqual(before);
 });
 test('a stale session role is answered as out of scope, not as a server error (revoke)',async()=>{
  const id=await delegate(h,ids.sales,member.id);
  await setDbRole(pm.id,ids.sales,'engineer');
  const before=await snap();
  const e=await refused(revoke(pm,id,V(1)),'SCOPE_DENIED',404);
  expect(e.message).toBe(NOT_FOUND);
  expect(await snap()).toEqual(before);
  const e2=await refused(revoke(pm,id,V(1),k(),staleRead(h.db,pm.id,'manager')),'SCOPE_DENIED',404);       // LTR03 from the guard on the UPDATE
  expect(e2.message).toBe(NOT_FOUND);
  expect(await snap()).toEqual(before);
 });
 test('only LTR02 on the INSERT and LTR03 on the UPDATE are mapped; the same codes elsewhere and other errors stay as they are',async()=>{
  const id=await delegate(h,ids.sales,member.id);
  const before=await snap();
  const a=await grant(pm,G({delegateId:reviewer.id}),k(),failOn(h.db,/INSERT INTO review_delegations/,'LTR03')).then(()=>null,x=>x);
  expect(a).toMatchObject({code:'LTR03'});expect(a).not.toMatchObject({status:404});
  const b=await revoke(pm,id,V(1),k(),failOn(h.db,/UPDATE review_delegations/,'LTR02')).then(()=>null,x=>x);
  expect(b).toMatchObject({code:'LTR02'});expect(b).not.toMatchObject({status:404});
  const c=await grant(pm,G({delegateId:reviewer.id}),k(),failOn(h.db,/INSERT INTO review_delegations/,'23514')).then(()=>null,x=>x);
  expect(c).toMatchObject({code:'23514'});
  const d=await grant(pm,G({delegateId:reviewer.id}),k(),failOn(h.db,/INSERT INTO review_events/,'LTR02')).then(()=>null,x=>x);
  expect(d).toMatchObject({code:'LTR02'});
  expect(await snap()).toEqual(before);
 });
});

describe('revoking a designation',()=>{
 test('OQ-34 any manager of the project revokes with a basis, also one who did not designate',async()=>{
  const v=await grant(pm,G());
  const key=k();
  const r=await svc().revoke(pm2,v.id,V(v.version,{basis:'Hết nhiệm vụ nhận xét tài liệu'}),key,k());
  expect(r).toMatchObject({id:v.id,revokedBy:pm2.id,revokeBasis:'Hết nhiệm vụ nhận xét tài liệu',version:v.version+1,grantedBy:pm.id,basis:BASIS,docTypes:['design'],delegateId:member.id});
  expect(r.revokedAt).toBeTruthy();
  const row=(await rows<{revoked_by:string;revoke_basis:string;version:number;revoked_at:unknown}>('SELECT revoked_by,revoke_basis,version,revoked_at FROM review_delegations'))[0];
  expect(row).toMatchObject({revoked_by:pm2.id,revoke_basis:'Hết nhiệm vụ nhận xét tài liệu',version:2});
  const ev=await rows<{kind:string;actor_id:string;payload:R}>("SELECT kind,actor_id,payload FROM review_events WHERE kind='delegation.revoked'");
  expect(ev).toHaveLength(1);expect(ev[0].actor_id).toBe(pm2.id);
  expect(ev[0].payload).toEqual({delegateId:member.id,versionBefore:1,versionAfter:2});
  expect(JSON.stringify(ev[0].payload)).not.toContain('Hết nhiệm vụ');
  const events=await n('review_events'),cmds=await n('document_commands');
  const again=await svc().revoke(pm2,v.id,V(v.version,{basis:'Hết nhiệm vụ nhận xét tài liệu'}),key,k());
  expect(again).toEqual(r);expect(await n('review_events')).toBe(events);expect(await n('document_commands')).toBe(cmds);
  await refused(revoke(pm2,v.id,V(v.version,{basis:'Một căn cứ khác hẳn'}),key),'IDEMPOTENCY_CONFLICT',409);
  expect(await n('review_events')).toBe(events);
  expect(await n('review_delegations')).toBe(1);                                                // never deleted
 });

 test('OQ-34 only a manager of that very project revokes (e, f, i)',async()=>{
  const ids3=[await delegate(h,ids.sales,member.id),await delegate(h,ids.sales,reviewer.id),await delegate(h,ids.sales,approver.id)];
  const before=await snap();
  for(const p of [member,reviewer,approver]) for(const id of ids3) await refused(revoke(p,id,V(1)),'MANAGER_REQUIRED',403);   // includes each delegate on their own row
  const none=await refused(revoke(tm,randomUUID(),V(1)),'SCOPE_DENIED',404);
  for(const id of ids3) expect((await refused(revoke(tm,id,V(1)),'SCOPE_DENIED',404)).message).toBe(none.message);
  expect(none.message).toBe(NOT_FOUND);
  await refused(revoke(split,ids3[0],V(1)),'MANAGER_REQUIRED',403);                           // manager of transport, ordinary member of sales
  for(const p of [salesViewer,bot,viewer,outsider]) await refused(revoke(p,ids3[0],V(1)),'SCOPE_DENIED',404);
  await refused(revoke(pm,'not-a-uuid',V(1)),'SCOPE_DENIED',404);
  expect(await snap()).toEqual(before);
 });

 test('a manager who is a reviewer of the project may revoke the own delegation as manager (S62)',async()=>{
  const v=await grant(pm,G({delegateId:pm2.id}));
  const r=await revoke(pm2,v.id,V(v.version));
  expect(r).toMatchObject({revokedBy:pm2.id,delegateId:pm2.id});
 });

 test('a revoke needs the current version and a basis; a stale version or an already revoked delegation answers DELEGATION_CONFLICT (g)',async()=>{
  const v=await grant(pm,G());
  const before=await snap();
  const {basis:_b,...noBasis}=V(1),{expectedVersion:_v,...noVersion}=V(1);
  for(const raw of [noBasis,V(1,{basis:'ngắn'}),noVersion,V(0),V(1.5),V(1,{revokedBy:pm.id}),V(1,{revokedAt:'2026-01-01T00:00:00Z'}),V(1,{tenantId:ids.tenant}),V(1,{docTypes:['plan']}),V(1,{projectId:ids.sales}),
    V(1,{version:2}),V(1,{basis:'Căn cứ\u0000hợp lệ'}),V(1,{basis:'Căn cứ \uD800 hợp lệ'}),V(1,{basis:'Căn cứ\nxuống dòng'}),null]) await zodRefused(revoke(pm,v.id,raw));
  expect(await snap()).toEqual(before);
  const e=await refused(revoke(pm,v.id,V(5)),'DELEGATION_CONFLICT',409);
  expect(e.message).toBe('Uỷ quyền này đã thay đổi. Tải lại để xem trạng thái mới.');
  expect(await snap()).toEqual(before);
  const r=await revoke(pm,v.id,V(1));
  const after=await snap();
  await refused(revoke(pm,v.id,V(1)),'DELEGATION_CONFLICT',409);                              // twice, same version
  await refused(revoke(pm2,v.id,V(r.version)),'DELEGATION_CONFLICT',409);                     // revoked row, its current version
  await refused(revoke(pm2,v.id,V(r.version+1)),'DELEGATION_CONFLICT',409);
  expect(await snap()).toEqual(after);
 });

 test('changing a reviewer\'s document types is revoke then designate again; list puts live rows first',async()=>{
  const v=await grant(pm,G({docTypes:['design']}));
  const other=await grant(pm,G({delegateId:reviewer.id,docTypes:['plan']}));
  await refused(grant(pm,G({docTypes:['plan']})),'DELEGATION_EXISTS',409);
  await revoke(pm,v.id,V(v.version));
  const v2=await grant(pm,G({docTypes:['plan','guide']}));
  expect(v2.id).not.toBe(v.id);expect(v2.docTypes).toEqual(['guide','plan']);
  const l=await svc().list(pm,{projectId:ids.sales});
  expect(l.reviewers.map(x=>x.id).sort()).toEqual([v.id,other.id,v2.id].sort());
  expect(l.reviewers.findIndex(x=>x.revokedAt!==null)).toBe(2);
  expect(l.reviewers[2].id).toBe(v.id);
  for(const forbidden of ['update','edit','change','setDocTypes','approve','propose','delete']) expect((DelegationService.prototype as unknown as R)[forbidden]).toBeUndefined();
  expect(await n('review_delegations')).toBe(3);
 });
});

describe('list',()=>{
 test('list shows the reviewers and approval-grant holders of this project only, without names',async()=>{
  await grantDocApproval(h,approver.id,ids.sales,['plan','design']);
  await grantDocApproval(h,transportApprover.id,ids.transport,['guide']);
  const a=await delegate(h,ids.sales,member.id,['design']);
  await delegate(h,ids.transport,transportApprover.id,['plan']);
  await revokeDelegation(h,a);
  await delegate(h,ids.sales,reviewer.id,['guide']);
  const l=await svc().list(pm,{projectId:ids.sales});
  expect(l.canDesignate).toBe(true);
  expect(l.reviewers.map(x=>x.delegateId).sort()).toEqual([member.id,reviewer.id].sort());
  expect(l.reviewers[0].delegateId).toBe(reviewer.id);expect(l.reviewers[1].revokedAt).not.toBeNull();
  expect(l.reviewers.every(x=>x.projectId===ids.sales)).toBe(true);
  expect(l.approvers).toHaveLength(1);
  expect(l.approvers[0].userId).toBe(approver.id);
  expect([...l.approvers[0].docTypes].sort()).toEqual(['design','plan']);
  const text=JSON.stringify(l);
  for(const name of NAMES) expect(text).not.toContain(name);
  expect(text).not.toContain(transportApprover.id);
  expect((await svc().list(member,{projectId:ids.sales})).canDesignate).toBe(false);
  expect((await svc().list(tm,{projectId:ids.transport})).canDesignate).toBe(true);
  for(const p of [salesViewer,bot,viewer,outsider,tm]) await refused(svc().list(p,{projectId:ids.sales}),'SCOPE_DENIED',404);
  await zodRefused(svc().list(pm,{projectId:ids.sales,extra:1}));
  await zodRefused(svc().list(pm,{}));
 });
 test('canDesignate follows the database role, not a stale session role',async()=>{
  await setDbRole(pm.id,ids.sales,'engineer');
  expect((await svc().list(pm,{projectId:ids.sales})).canDesignate).toBe(false);
 });
});

describe('OQ-39, OQ-40, OQ-41 indicators and who sees what in list',()=>{
 const MARK_G='MARKER-GRANT-',MARK_R='MARKER-REVOKE-';
 const mkBasis=(t:string)=>t+'căn cứ chỉ định mẫu';
 const seed=async()=>{
  // live: member (engineer) design, reviewer (technical) plan; revoked: approver (business) guide; all granted by pm with marked texts
  const out:Record<string,string>={};
  for(const [key,p,types] of [['member',member,['design']],['reviewer',reviewer,['plan']],['approver',approver,['guide']]] as const) {
   const v=await grant(pm,G({delegateId:p.id,docTypes:types,basis:mkBasis(MARK_G+key+'-')}));out[key]=v.id;
  }
  await revoke(pm,out.approver,V(1,{basis:'Thu hồi '+MARK_R+'approver-xyz'}));
  return out;
 };
 test('OQ-41 a reader who is not a coordinator gets no basis text of another person\'s rows, live or revoked',async()=>{
  const d=await seed();
  const l=await svc().list(business2,{projectId:ids.sales});
  const text=JSON.stringify(l);
  expect(text).not.toContain('MARKER-');
  expect(text).not.toContain(pm.id);
  expect(l.reviewers.map(x=>x.id).sort()).toEqual([d.member,d.reviewer].sort());       // no revoked row of another person
  for(const r of l.reviewers) expect(r).toEqual({id:r.id,projectId:null,delegateId:r.delegateId,docTypes:r.docTypes,grantedBy:null,basis:null,revokedAt:null,revokedBy:null,revokeBasis:null,version:null,createdAt:null,designatorIsCoordinator:null,dormant:null});
  expect(l.reviewers.find(x=>x.id===d.member)).toMatchObject({delegateId:member.id,docTypes:['design']});
  expect(l.canDesignate).toBe(false);
  await setDbRole(member.id,ids.sales,'viewer');                                        // a dormant row of another person is not returned either
  const l2=await svc().list(business2,{projectId:ids.sales});
  expect(l2.reviewers.map(x=>x.id)).toEqual([d.reviewer]);
  expect(JSON.stringify(l2)).not.toContain('MARKER-');
 });
 test('OQ-41 a delegate reads the basis and the revoke basis of their own rows',async()=>{
  const live=await grant(pm,G({delegateId:member.id,docTypes:['design'],basis:mkBasis(MARK_G+'own-')}));
  const other=await grant(pm,G({delegateId:reviewer.id,docTypes:['plan'],basis:mkBasis(MARK_G+'other-')}));
  const own=(await svc().list(member,{projectId:ids.sales}));
  expect(own.reviewers.find(x=>x.id===live.id)).toMatchObject({basis:mkBasis(MARK_G+'own-'),grantedBy:pm.id,revokedAt:null,version:1});
  expect(JSON.stringify(own)).not.toContain(MARK_G+'other-');
  expect(own.reviewers.find(x=>x.id===other.id)).toMatchObject({basis:null,grantedBy:null});
  await revoke(pm,live.id,V(1,{basis:'Thu hồi '+MARK_R+'own-xyz'}));
  const again=await grant(pm,G({delegateId:member.id,docTypes:['plan'],basis:mkBasis(MARK_G+'own2-')}));
  const l=await svc().list(member,{projectId:ids.sales});
  expect(l.reviewers.find(x=>x.id===live.id)).toMatchObject({basis:mkBasis(MARK_G+'own-'),revokeBasis:'Thu hồi '+MARK_R+'own-xyz',revokedBy:pm.id});
  expect(l.reviewers.find(x=>x.id===again.id)).toMatchObject({basis:mkBasis(MARK_G+'own2-')});
 });
 test('OQ-41 a coordinator reads everything',async()=>{
  const d=await seed();
  for(const p of [pm,pm2]) {
   const l=await svc().list(p,{projectId:ids.sales});
   expect(l.reviewers).toHaveLength(3);
   const rev=l.reviewers.find(x=>x.id===d.approver)!;
   expect(rev).toMatchObject({basis:mkBasis(MARK_G+'approver-'),revokeBasis:'Thu hồi '+MARK_R+'approver-xyz',revokedBy:pm.id,grantedBy:pm.id,dormant:false,designatorIsCoordinator:true});
   expect(l.reviewers.find(x=>x.id===d.member)).toMatchObject({basis:mkBasis(MARK_G+'member-'),dormant:false,designatorIsCoordinator:true,grantedBy:pm.id});
   expect(l.canDesignate).toBe(true);
  }
 });
 test('OQ-41 the caller\'s coordinator status comes from the database',async()=>{
  const d=await seed();
  await setDbRole(pm2.id,ids.sales,'engineer');                                         // the session of pm2 still says manager
  const l=await svc().list(pm2,{projectId:ids.sales});
  const text=JSON.stringify(l);
  expect(text).not.toContain('MARKER-');
  expect(l.canDesignate).toBe(false);
  expect(l.reviewers.map(x=>x.id).sort()).toEqual([d.member,d.reviewer].sort());
  for(const r of l.reviewers) expect(r).toMatchObject({grantedBy:null,basis:null,designatorIsCoordinator:null,dormant:null});
  await setDbRole(pm2.id,ids.sales,'viewer');                                           // no reading role left in the database: same answer as any outsider
  await refused(svc().list(pm2,{projectId:ids.sales}),'SCOPE_DENIED',404);
 });
 test('OQ-39 a designation outlives its designator\'s role and is labelled',async()=>{
  const review=new ReviewService(h.db);
  const doc=await registerDoc(h,pm,{docType:'design'});
  const f=await frozenRevision(h,doc.record.id,member.id);
  const cmt=()=>({kind:'comment',revisionId:f.revisionId,anchor:'Mục 1',body:'Cần làm rõ phạm vi'});
  const v=await grant(pm2,G({delegateId:reviewer.id,docTypes:['design'],basis:mkBasis('x-')}));
  expect((await svc().list(pm,{projectId:ids.sales})).reviewers[0]).toMatchObject({id:v.id,designatorIsCoordinator:true});
  await setDbRole(pm2.id,ids.sales,'engineer');
  const l=await svc().list(pm,{projectId:ids.sales});
  expect(l.reviewers.find(x=>x.id===v.id)).toMatchObject({designatorIsCoordinator:false,dormant:false,grantedBy:pm2.id});
  expect((await review.comment(reviewer,doc.record.id,cmt(),k(),k())).comments.map(x=>x.actorId)).toEqual([reviewer.id]);   // effect unchanged
  await setDbRole(pm2.id,ids.sales,'manager');
  expect((await svc().list(pm,{projectId:ids.sales})).reviewers.find(x=>x.id===v.id)).toMatchObject({designatorIsCoordinator:true});
 });
 test('OQ-40 a dormant designation is labelled, gives nothing, and revives when the person returns',async()=>{
  const review=new ReviewService(h.db);
  const doc=await registerDoc(h,pm,{docType:'design'});
  const f=await frozenRevision(h,doc.record.id,member.id);
  const cmt=()=>({kind:'comment',revisionId:f.revisionId,anchor:'Mục 1',body:'Cần làm rõ phạm vi'});
  const codeOf=async(p:Promise<unknown>)=>(await p.then(()=>null,x=>x) as {code?:string}|null)?.code;
  const v=await grant(pm,G({delegateId:reviewer.id,docTypes:['design']}));
  const gone=await grant(pm,G({delegateId:approver.id,docTypes:['plan']}));
  await revoke(pm,gone.id,V(1));
  await setDbRole(reviewer.id,ids.sales,'viewer');await setDbRole(approver.id,ids.sales,'viewer');
  const l=await svc().list(pm,{projectId:ids.sales});
  expect(l.reviewers.find(x=>x.id===v.id)).toMatchObject({dormant:true,docTypes:['design'],revokedAt:null});
  expect(l.reviewers.find(x=>x.id===gone.id)).toMatchObject({dormant:false,revokedAt:expect.any(String)});     // a revoked row is never dormant
  expect(await codeOf(review.comment(reviewer,doc.record.id,cmt(),k(),k()))).toBeDefined();                 // refused (viewer: not found or not authorized)
  expect(await n('review_comments')).toBe(0);
  await setDbRole(reviewer.id,ids.sales,'technical');
  expect((await svc().list(pm,{projectId:ids.sales})).reviewers.find(x=>x.id===v.id)).toMatchObject({dormant:false,docTypes:['design']});
  expect((await review.comment(reviewer,doc.record.id,cmt(),k(),k())).comments.map(x=>x.actorId)).toEqual([reviewer.id]);
 });
 test('indicators are for coordinators only',async()=>{
  await seed();
  for(const p of [member,reviewer,business2,technical2]) {
   const l=await svc().list(p,{projectId:ids.sales});
   for(const r of l.reviewers) expect([r.designatorIsCoordinator,r.dormant]).toEqual([null,null]);
  }
 });
});

describe('a commenter can never approve',()=>{
 test('OQ-31 (3) a designated commenter comments and requests changes for the designated type only, never approves, and the revoke takes effect on the next command',async()=>{
  const review=new ReviewService(h.db);
  const design=await registerDoc(h,pm,{docType:'design'}),plan=await registerDoc(h,pm,{docType:'plan'}),design2=await registerDoc(h,pm,{docType:'design'}),design3=await registerDoc(h,pm,{docType:'design'});
  const fz=async(docId:string)=>{const f=await frozenRevision(h,docId,member.id);return {docId,revisionId:f.revisionId,version:f.version,hash:f.hash};};
  const [wd,wp,wd2,wd3]=[await fz(design.record.id),await fz(plan.record.id),await fz(design2.record.id),await fz(design3.record.id)];
  const dec=(w:typeof wd,over:R={})=>({revisionId:w.revisionId,sourceHash:w.hash,expectedVersion:w.version,result:'changes_requested',scopeNote:'Đã đọc đúng bản này',exceptions:[],...over});
  const cmt=(w:typeof wd,over:R={})=>({kind:'comment',revisionId:w.revisionId,anchor:'Mục 1',body:'Cần làm rõ phạm vi',...over});
  const codeOf=async(p:Promise<unknown>)=>(await p.then(()=>null,x=>x) as {code?:string}|null)?.code;
  // before the designation: nothing
  expect(await codeOf(review.comment(reviewer,wd.docId,cmt(wd),k(),k()))).toBe('APPROVER_NOT_AUTHORIZED');
  const v=await grant(pm,G({delegateId:reviewer.id,docTypes:['design']}));
  const c=await review.comment(reviewer,wd.docId,cmt(wd),k(),k());
  expect(c.comments.map(x=>x.actorId)).toEqual([reviewer.id]);
  expect(await codeOf(review.comment(reviewer,wp.docId,cmt(wp),k(),k()))).toBe('APPROVER_NOT_AUTHORIZED');           // another type
  expect(await codeOf(review.decide(reviewer,wp.docId,dec(wp),k(),k()))).toBe('APPROVER_NOT_AUTHORIZED');
  expect(await codeOf(review.decide(reviewer,wd2.docId,dec(wd2,{result:'approved'}),k(),k()))).toBe('APPROVER_NOT_AUTHORIZED'); // never approves
  expect((await rows('SELECT approved_revision_id FROM document_records WHERE id=$1',[design2.record.id]))[0]).toEqual({approved_revision_id:null});
  const d=await review.decide(reviewer,wd.docId,dec(wd),k(),k());
  expect(d.item.decision).toMatchObject({result:'changes_requested',decidedBy:reviewer.id});
  expect((await rows<{authority:string;delegation_id:string}>('SELECT authority,delegation_id FROM review_decisions'))[0]).toEqual({authority:'review_delegation',delegation_id:v.id});
  // revoke: earlier rows stay, the very next commands are refused
  const keep=async()=>({c:await rows('SELECT * FROM review_comments ORDER BY id'),d:await rows('SELECT * FROM review_decisions ORDER BY id')});
  const kept=await keep();
  await revoke(pm,v.id,V(v.version));
  expect(await codeOf(review.comment(reviewer,wd3.docId,cmt(wd3),k(),k()))).toBe('APPROVER_NOT_AUTHORIZED');
  expect(await codeOf(review.decide(reviewer,wd3.docId,dec(wd3),k(),k()))).toBe('APPROVER_NOT_AUTHORIZED');
  expect(await codeOf(review.decide(reviewer,wd2.docId,dec(wd2),k(),k()))).toBe('APPROVER_NOT_AUTHORIZED');
  expect(await keep()).toEqual(kept);
  expect((await rows<{delegation_id:string}>('SELECT delegation_id FROM review_decisions'))[0].delegation_id).toBe(v.id);
  expect(await n('review_decisions')).toBe(1);expect(await n('review_comments')).toBe(1);
  // designating again restores comment and changes-requested, still no approval
  await grant(pm,G({delegateId:reviewer.id,docTypes:['design']}));
  expect((await review.comment(reviewer,wd3.docId,cmt(wd3),k(),k())).comments).toHaveLength(1);
  expect(await codeOf(review.decide(reviewer,wd3.docId,dec(wd3,{result:'approved'}),k(),k()))).toBe('APPROVER_NOT_AUTHORIZED');
 });
 test('F-3 behavioural: designating and revoking never touch approval grants, ballots, memberships or the approved pointer',async()=>{
  await grantDocApproval(h,approver.id,ids.sales,['design']);
  const doc=await registerDoc(h,pm,{docType:'design'});
  const probe=async()=>({approvers:await rows('SELECT user_id,doc_types FROM public.document_approvers($1::uuid) ORDER BY user_id',[ids.sales]),
   perms:await rows('SELECT user_id,project_id,report_permissions,project_role FROM identity.memberships ORDER BY user_id,project_id'),
   ballots:await n('identity.account_approvals'),records:await rows('SELECT id,version,approved_revision_id,latest_revision_id FROM document_records ORDER BY id'),decisions:await n('review_decisions')});
  const before=await probe();
  const v=await grant(pm,G({delegateId:reviewer.id,docTypes:['design','plan','guide']}));
  expect(await probe()).toEqual(before);
  await revoke(pm,v.id,V(v.version));
  expect(await probe()).toEqual(before);
  expect(doc.record.id).toBeTruthy();
 });
 test('the service has no path that grants or implies approval and never writes the stamped columns',async()=>{
  const src=await readFile('src/server/review-delegations.ts','utf8');
  expect(src).not.toMatch(/report_permissions|account_approvals|access_change|approved_revision_id|review_decisions|document_records/);
  expect(src).not.toMatch(/DELETE FROM|app\.tenant_id|SET ROLE/);
  expect(src).not.toMatch(/version\s*=\s*version|updated_at\s*=/);
  expect(src).toMatch(/SET revoked_at=now\(\),revoked_by=\$1,revoke_basis=\$2\s+WHERE/);
 });
});
