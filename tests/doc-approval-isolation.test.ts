import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {openWorld,propose,say,rows,refusal,BASIS,type World} from './doc-approval-fixtures';
import {provisionApprovers} from './account-approval-fixture';
import {reviewer} from './slice3-fixtures';
import {native} from './slice1-db';
import {pooledDatabase,scoped,type Database} from '../src/server/db';
import {IdentityService} from '../src/server/identity';
import {AccountApprovalService} from '../src/server/account-approval';
import {DocApprovalProposalService} from '../src/server/doc-approval-proposals';
import {ids} from '../src/server/identities';
import type {Principal,ProjectGrant} from '../src/server/types';

// Task 7c fix wave after the tier-1 whole-branch reviews. Synthetic data only; each case builds its own world (F5).
// - Tenant isolation at the database layer for the new ballot paths (code review I-1, security review F1, database review P3-6): a real
//   access_change ballot of ANOTHER tenant is put in front of withdraw, listOwn, the admin cancel, the admin list and the P14 pair wait.
// - The isolation level of IdentityService.scope (database review P2-2).
// - The 24-hour edge of the pair wait (database review P3-7).
// Quality Gate 34a-34e: the case titles carry the dimension they cover.
let w:World;
beforeEach(async()=>{w=await openWorld();});
afterEach(async()=>{await w.h.reset();await w.h.close();});

const S=ids.sales,B=ids.otherTenant,PB=ids.otherProject;
const SCOPE={code:'SCOPE_DENIED',status:404,message:'Không tìm thấy mục trong phạm vi được cấp.'};
const NOT_FOUND={code:'APPROVAL_NOT_FOUND',status:404,message:'Không tìm thấy phiếu duyệt.'};
const ACCOUNT_NOT_FOUND={code:'ACCOUNT_SCOPE_DENIED',status:404,message:'Tài khoản ngoài phạm vi được cấp.'};
const PAIR_WAIT='Anh/chị chưa trình lại được cho người này: phiếu trước của anh/chị cho họ không được áp, và khoảng chờ 24 giờ sau phiếu đó chưa hết. Thử lại sau, hoặc nhờ quản trị tài khoản trình.';
const pairWait={code:'RATE_LIMITED',status:429,message:PAIR_WAIT};
const WITHDRAW_BASIS='Đã trình nhầm loại tài liệu, xin rút lại';
const CANCEL_BASIS='Huỷ phiếu trình chưa đúng của điều phối';
/** The four tables of migration 009; tests/identity.test.ts:54 makes the same check for the identity tables of migration 002. */
const BALLOT_TABLES=['account_approval_seats','account_approvals','account_approval_voters','account_approval_votes'];

const versionOf=async(userId:string)=>(await rows<{v:number}>(w,'SELECT account_version v FROM identity.users WHERE id=$1',[userId]))[0].v;
const stateOf=async(id:string)=>(await rows<{state:string}>(w,'SELECT state FROM identity.account_approvals WHERE id=$1',[id]))[0].state;
const operatorCount=async(sql:string,params:unknown[]=[])=>Number((await rows<{n:string}>(w,`SELECT count(*) n FROM ${sql}`,params))[0].n);
const cancel=async(approvalId:string,userId:string)=>
  w.accounts.command(w.admin,{kind:'cancel_access_change',userId,expectedVersion:await versionOf(userId),reason:CANCEL_BASIS,approvalId});
/** Inside IdentityService.scope of tenant A: the ballot rows with this id that the role libetech_identity can see. */
const seenByTenantA=(id:string)=>w.identity.scope(async tx=>(await tx.query<{n:number}>('SELECT count(*)::int AS n FROM identity.account_approvals WHERE id=$1',[id])).rows[0].n);

type Foreign={identity:IdentityService;coordinator:Principal;subjectId:string;secondId:string;userIds:string[];pending:string;approved:string};
/** Tenant B (ids.otherTenant, project ids.otherProject): its own account admin, seats, coordinator and two members, and two real
 * access_change ballots built through the same service path tenant A uses: one pending, one approved by a BoM seat of tenant B. */
async function foreignTenant():Promise<Foreign> {
  const adminId=randomUUID(),coordinatorId=randomUUID(),subjectId=randomUUID(),secondId=randomUUID();
  const identity=new IdentityService(w.h.operator,B,adminId);
  const person=async(id:string,username:string,name:string,role:ProjectGrant['role'])=>{
    await w.h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,$4,$5,'fixture-hash')`,[id,B,username,name,role]);
    await w.h.operator.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,$4)',[B,id,PB,role]);
  };
  await person(adminId,'db-admin','Quản trị tenant đối chứng mẫu','manager');
  const approvers=await provisionApprovers(w.h.operator,identity,adminId,PB);
  await person(coordinatorId,'db-coordinator','Điều phối tenant đối chứng mẫu','manager');
  await person(subjectId,'db-subject','Thành viên tenant đối chứng mẫu','engineer');
  await person(secondId,'db-second','Thành viên tenant đối chứng mẫu hai','engineer');
  const coordinator:Principal={id:coordinatorId,tenantId:B,name:'Điều phối tenant đối chứng mẫu',role:'manager',projectIds:[PB],
    grants:[{projectId:PB,role:'manager',reportPermissions:[]}]};
  const proposals=new DocApprovalProposalService(identity);
  const ask=async(userId:string)=>(await proposals.propose(coordinator,{projectId:PB,userId,docTypes:['design'],expectedTypes:[],reason:BASIS})).approvalId;
  const pending=await ask(subjectId),approved=await ask(secondId);
  const seat=approvers[2];
  await new AccountApprovalService(identity).vote(seat.telegram,seat.telegram,'private',approved,'agree');
  // the fixture did what it says, read as the operator
  expect(await rows(w,'SELECT id,tenant_id,state FROM identity.account_approvals WHERE id=ANY($1::uuid[]) ORDER BY state',[[pending,approved]]))
    .toEqual([{id:approved,tenant_id:B,state:'approved'},{id:pending,tenant_id:B,state:'pending'}]);
  return {identity,coordinator,subjectId,secondId,userIds:[adminId,...approvers.slice(1).map(a=>a.id),coordinatorId,subjectId,secondId],pending,approved};
}
/** What a refused or a read-only call of tenant A must leave untouched in tenant B, read as the operator. */
const foreignState=async(f:Foreign)=>({
  ballots:await rows(w,'SELECT id,state,subject_account_version,updated_at FROM identity.account_approvals WHERE id=ANY($1::uuid[]) ORDER BY id',[[f.pending,f.approved]]),
  accounts:await rows(w,'SELECT id,account_version FROM identity.users WHERE id=ANY($1::uuid[]) ORDER BY id',[[f.subjectId,f.secondId]]),
  events:await operatorCount('identity.events WHERE tenant_id=$1',[B]),
});

describe('tenant isolation of the coordinator ballot paths (database layer)',()=>{
  test("34c withdraw and the admin cancel aimed at tenant B's pending and approved ballots answer the refusal of an unknown id, and leave tenant B's ballots, account versions and events unchanged",async()=>{
    const own=await propose(w,w.coordinator);
    const f=await foreignTenant();
    const before=await foreignState(f);
    // (a) withdraw by tenant A's coordinator: the same answer as for an id that exists nowhere
    const unknown=await refusal(w.proposals.withdraw(w.coordinator,randomUUID(),{reason:WITHDRAW_BASIS}));
    expect(unknown).toEqual(SCOPE);
    for(const id of [f.pending,f.approved]) expect(await refusal(w.proposals.withdraw(w.coordinator,id,{reason:WITHDRAW_BASIS})),id).toEqual(unknown);
    // (c) the admin cancel: through a tenant-A account the foreign ballot is not found; through the tenant-B account the account is not found
    for(const [id,userId] of [[f.pending,f.subjectId],[f.approved,f.secondId]]) {
      expect(await refusal(cancel(id,w.subject.id)),id).toEqual(NOT_FOUND);
      expect(await refusal(cancel(id,userId)),id).toEqual(ACCOUNT_NOT_FOUND);
    }
    // (e) checked as the operator afterwards
    expect(await foreignState(f)).toEqual(before);
    expect(await operatorCount("identity.events WHERE kind IN ('access_change_withdrawn','access_change_cancelled') AND detail->>'approvalId'=ANY($1::text[])",
      [[f.pending,f.approved]])).toBe(0);
    expect(await stateOf(own.approvalId)).toBe('pending');
  });

  test("34a listOwn, the admin list (openAccessChange) and a read inside IdentityService.scope show none of tenant B's ballots",async()=>{
    const own=await propose(w,w.coordinator);
    const f=await foreignTenant();
    const before=await foreignState(f);
    // (b) the coordinator's own list holds the own ballot only
    expect((await w.proposals.listOwn(w.coordinator,{projectId:S})).map(p=>p.approvalId)).toEqual([own.approvalId]);
    // (d) the admin list: the own ballot is shown on its account; no tenant-B account and no tenant-B ballot appear
    const listed=await w.accounts.list(w.admin);
    expect(listed.find(account=>account.id===w.subject.id)?.accessChange?.approvalId).toBe(own.approvalId);
    for(const id of f.userIds) expect(listed.map(account=>account.id),id).not.toContain(id);
    expect(listed.map(account=>account.accessChange?.approvalId).filter(id=>id===f.pending||id===f.approved)).toEqual([]);
    // (e)
    expect(await foreignState(f)).toEqual(before);
    // (f) RLS itself, under the role the branch queries as: the rows exist (operator), tenant A's scope sees none of them, and sees its own.
    // The predicates of (a)-(d) would also refuse a visible foreign row; this is the read that turns red when RLS is off.
    expect(await seenByTenantA(own.approvalId)).toBe(1);
    for(const id of [f.pending,f.approved]) {
      expect(await operatorCount('identity.account_approvals WHERE id=$1',[id]),id).toBe(1);
      expect(await seenByTenantA(id),id).toBe(0);
    }
  });

  test("34a a tenant-B access_change_withdrawn event naming tenant A's cancelled ballot and its proposer does not exempt the pair from the 24-hour wait; the same event in tenant A does",async()=>{
    const made=await propose(w,w.coordinator);
    await cancel(made.approvalId,w.subject.id);
    expect(await refusal(propose(w,w.coordinator))).toEqual(pairWait);
    // the shape the P14 exemption reads: user_id = the subject, kind, detail.approvalId = the ballot id (lower case), actor_id = the proposer
    const plant=(tenantId:string)=>w.h.operator.query(`INSERT INTO identity.events(tenant_id,user_id,actor_id,kind,detail) VALUES($1,$2,$3,'access_change_withdrawn',$4)`,
      [tenantId,w.subject.id,w.coordinator.id,JSON.stringify({approvalId:made.approvalId,reason:WITHDRAW_BASIS,previousState:'pending',projectId:S})]);
    await plant(B);
    expect(await refusal(propose(w,w.coordinator))).toEqual(pairWait);
    // control: planted in tenant A, the very same event is what exempts the pair, so the refusal above came from the tenant boundary alone
    await plant(ids.tenant);
    expect((await propose(w,w.coordinator)).state).toBe('pending');
  });

  test('34a every ballot table of migration 009 isolates tenant: another tenant reads 0 rows of each, and the business runtime has no access',async()=>{
    const own=await propose(w,w.coordinator);
    await say(w,2,own.approvalId);                                   // a vote row too
    const foreign=new IdentityService(w.h.operator,B);
    for(const table of BALLOT_TABLES) {
      const mine=await operatorCount('identity.'+table+' WHERE tenant_id=$1',[ids.tenant]);
      expect(mine,table).toBeGreaterThan(0);
      const asA=await w.identity.scope(async tx=>(await tx.query<{tenant_id:string}>('SELECT tenant_id FROM identity.'+table)).rows);
      expect(asA.map(row=>row.tenant_id),table).toEqual(Array(mine).fill(ids.tenant));
      expect(await foreign.scope(async tx=>(await tx.query('SELECT * FROM identity.'+table)).rows),table).toHaveLength(0);
      await expect(scoped(w.h.operator,w.coordinator,tx=>tx.query('SELECT * FROM identity.'+table)),table).rejects.toThrow();
    }
  });

  test('34d with no tenant context the four ballot tables of migration 009 return 0 rows under libetech_identity, not every row (rows, no error)',async()=>{
    const own=await propose(w,w.coordinator);
    await say(w,2,own.approvalId);
    for(const table of BALLOT_TABLES) {
      expect(await operatorCount('identity.'+table),table).toBeGreaterThan(0);
      const seen=await w.h.operator.transaction(async tx=>{
        await tx.query('SET LOCAL ROLE libetech_identity');           // no set_config('app.tenant_id', ...)
        return (await tx.query('SELECT * FROM identity.'+table)).rows;
      });
      expect(seen,table).toHaveLength(0);
    }
  });
});

describe('isolation level of IdentityService.scope',()=>{
  const level=(q:{query:Database['query']})=>q.query<{transaction_isolation:string}>('SHOW transaction_isolation').then(r=>r.rows[0].transaction_isolation);
  const inScope=(db:Database)=>new IdentityService(db,ids.tenant).scope(level);
  const inPlainTransaction=(db:Database)=>db.transaction(level);

  // PGlite has one connection, so a session SET reaches the scope; on PostgreSQL a dedicated pool sets the same session default on every
  // connection it opens (libpq `options`), so the scope's pooled client carries it whichever connection it gets.
  test('IdentityService.scope runs READ COMMITTED when the session default of its connection is REPEATABLE READ (database review P2-2, T7C-5 i)',async()=>{
    if(!native) {
      await w.h.operator.query("SET default_transaction_isolation = 'repeatable read'");
      try {
        expect(await inPlainTransaction(w.h.operator)).toBe('repeatable read');   // the default is in force
        expect(await inScope(w.h.operator)).toBe('read committed');
      } finally {await w.h.operator.query('RESET default_transaction_isolation');}
      expect(await inPlainTransaction(w.h.operator)).toBe('read committed');
      return;
    }
    const url=new URL(process.env.SLICE1_TEST_DATABASE_URL as string);
    url.searchParams.set('options','-c default_transaction_isolation=repeatable\\ read');
    const db=pooledDatabase(url.toString());
    try {
      expect(await inPlainTransaction(db)).toBe('repeatable read');
      expect(await inScope(db)).toBe('read committed');
    } finally {await db.close();}
  });
});

describe('the 24-hour edge of the pair wait (database review P3-7)',()=>{
  // Same clock technique as tests/doc-approval-proposal.test.ts (the 23 h / 25 h case): the operator moves the closing time back.
  // T7C-19 (2): a rejected or expired ballot closes at LEAST(updated_at, expires_at); a pending one past its deadline closes at expires_at.
  test('OQ-48 1 minute before 24 hours after the closing the same proposer is refused, 1 minute after it allowed: a rejected ballot and a ballot past its deadline',async()=>{
    const rejected=await propose(w,w.coordinator);
    await say(w,0,rejected.approvalId,'reject');
    await w.h.operator.query("UPDATE identity.account_approvals SET updated_at=now()-interval '23 hours 59 minutes' WHERE id=$1",[rejected.approvalId]);
    expect(await refusal(propose(w,w.coordinator))).toEqual(pairWait);
    await w.h.operator.query("UPDATE identity.account_approvals SET updated_at=now()-interval '24 hours 1 minute' WHERE id=$1",[rejected.approvalId]);
    expect((await propose(w,w.coordinator)).state).toBe('pending');
    const overdue=await propose(w,w.coordinator,{userId:reviewer.id});
    await w.h.operator.query("UPDATE identity.account_approvals SET expires_at=now()-interval '23 hours 59 minutes' WHERE id=$1",[overdue.approvalId]);
    expect(await refusal(propose(w,w.coordinator,{userId:reviewer.id}))).toEqual(pairWait);
    expect(await stateOf(overdue.approvalId)).toBe('pending');          // the refused proposal marks nothing
    await w.h.operator.query("UPDATE identity.account_approvals SET expires_at=now()-interval '24 hours 1 minute' WHERE id=$1",[overdue.approvalId]);
    expect((await propose(w,w.coordinator,{userId:reviewer.id})).state).toBe('pending');
    expect(await stateOf(overdue.approvalId)).toBe('expired');
  });
});
