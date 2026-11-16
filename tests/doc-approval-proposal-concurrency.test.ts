import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {native,waitForBlocked} from './slice1-db';
import {beforeStatement,reviewer} from './slice3-fixtures';
import {openWorld,propose,say,rows,refusal,applyFrozen,identityOn,BASIS,type World} from './doc-approval-fixtures';
import {COOKIE} from '../src/server/auth';
import {AccountService} from '../src/server/accounts';
import {DocApprovalProposalService} from '../src/server/doc-approval-proposals';
import {handleDocApprovalApi} from '../src/server/doc-approval-http';
import {ids} from '../src/server/identities';
import type {Principal,ProjectGrant} from '../src/server/types';

// Task 7c, Task 1b: the lock order of T7C-5 under real concurrency. Two connections of the pool run at once; the order is built with
// beforeStatement (the hook runs just before the first matching statement) and waitForBlocked (pg_stat_activity), never with a sleep.
// No case accepts SQLSTATE 40P01: a deadlock is a failure of the lock order, not an answer.
const S=ids.sales,T=ids.transport;
const PENDING='Người này đang có một phiếu đổi quyền chưa xong.';
const INELIGIBLE='Người được đề xuất phải là thành viên đang hoạt động của dự án.';
/** The admin command's lock of the TARGET account row: `operator` has already locked the admin row FOR UPDATE when this statement runs. */
const TARGET_LOCK=/account_version AS version FROM identity\.users WHERE id=\$1 FOR UPDATE/;
const BALLOT_INSERT=/INSERT INTO identity\.account_approvals/;

type Settled={ok:true;value:unknown}|{ok:false;error:unknown};
/** Never rejects, so a call started inside a hook can fail before anyone awaits it without an unhandled rejection. */
const settle=(run:Promise<unknown>):Promise<Settled>=>run.then(value=>({ok:true as const,value}),(error:unknown)=>({ok:false as const,error}));
const code=(s:Settled)=>s.ok?'ok':String((s.error as {code?:string})?.code??(s.error as Error)?.message);
const noDeadlock=(...all:Settled[])=>{for(const s of all) expect(code(s),'a deadlock is never an answer').not.toBe('40P01');};
const g=(projectId:string,role:ProjectGrant['role'],...perms:string[]):ProjectGrant=>({projectId,role,reportPermissions:perms as ProjectGrant['reportPermissions']});
const count=async(w:World,sql:string,params:unknown[]=[])=>Number((await rows<{n:string}>(w,`SELECT count(*) n FROM ${sql}`,params))[0].n);
/** identity.events has no foreign key to the accounts, so reset() on PostgreSQL does not empty it: count only this world's proposers. */
const proposedEvents=(w:World)=>count(w,"identity.events WHERE kind='access_change_proposed' AND actor_id=ANY($1::uuid[])",
  [[w.coordinator.id,w.coManager.id,w.seatCoordinator.id]]);
const versionOf=async(w:World,userId:string)=>(await w.accounts.list(w.admin)).find(row=>row.id===userId)!.version;
/** The statements waiting on a lock right now: SQL text with $n placeholders, never a value. */
const waiting=async(w:World)=>(await rows<{query:string}>(w,"SELECT query FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'"))
  .map(row=>row.query.replace(/\s+/g,' '));
type Blocked={done:Promise<Settled>;on:string[]};
/** Called inside a hook: starts `run`, returns once it waits on a lock, with the statement it waits on. */
const startBlocked=async(w:World,run:()=>Promise<unknown>):Promise<Blocked>=>{const done=settle(run());await waitForBlocked(w.h,1);return {done,on:await waiting(w)};};
const ran=(b:Blocked|undefined):Blocked=>{expect(b,'the hook ran').toBeDefined();return b!;};
/** The coordinator write's FIRST lock (T7C-5): KEY SHARE on the account-admin row. */
const ADMIN_ROW_SHARE=/^SELECT id FROM identity\.users WHERE id=\$1 FOR KEY SHARE$/;
/** `operator` of the admin path: FOR UPDATE on the admin's own row, before any other lock of an admin command. */
const ADMIN_ROW_UPDATE=/^SELECT id FROM identity\.users WHERE id=\$1 AND active AND password_hash IS NOT NULL FOR UPDATE$/;

describe.skipIf(!native)('coordinator proposal concurrency (native PostgreSQL)',()=>{
  let w:World;
  beforeEach(async()=>{w=await openWorld();});
  afterEach(async()=>{await w.h.reset();await w.h.close();});

  test('a demotion that already holds the admin row makes the proposal wait and then see it',async()=>{
    // (1) demotion of the coordinator to viewer in ids.sales; (2) disabling a second coordinator. Each admin command holds the admin row when the
    // proposal starts, so the proposal waits on its FIRST lock and then reads the committed change under its own row locks.
    const run=async(proposer:Principal,command:Record<string,unknown>)=>{
      let started:Blocked|undefined;
      const admin=new AccountService(identityOn(w,beforeStatement(w.h.operator,TARGET_LOCK,async()=>{started=await startBlocked(w,()=>propose(w,proposer));})));
      const version=await versionOf(w,proposer.id);
      const done=await settle(admin.command(w.admin,{userId:proposer.id,expectedVersion:version,...command}));
      const proposal=await ran(started).done;
      noDeadlock(done,proposal);
      // it waited on its first lock, not on a row it had locked already
      expect(ran(started).on).toEqual([expect.stringMatching(ADMIN_ROW_SHARE)]);
      return {done,proposal};
    };
    const demoted=await run(w.coordinator,{kind:'access',reason:'Hạ vai điều phối mẫu',grants:[g(S,'viewer'),g(T,'viewer')]});
    expect(code(demoted.done)).toBe('ok');
    expect(code(demoted.proposal)).toBe('MANAGER_REQUIRED');
    const disabled=await run(w.coManager,{kind:'disable',reason:'Khoá tài khoản đồng điều phối mẫu'});
    expect(code(disabled.done)).toBe('ok');
    expect(code(disabled.proposal)).toBe('SCOPE_DENIED');
    expect(await count(w,'identity.account_approvals')).toBe(0);
    expect(await count(w,'identity.account_approval_voters')).toBe(0);
    expect(await proposedEvents(w)).toBe(0);
  });

  test('a proposal about to insert makes the admin command wait, and the ballot predates the demotion',async()=>{
    let started:Blocked|undefined;
    const version=await versionOf(w,w.coordinator.id);
    const proposals=new DocApprovalProposalService(identityOn(w,beforeStatement(w.h.operator,BALLOT_INSERT,async()=>{
      started=await startBlocked(w,()=>w.accounts.command(w.admin,{kind:'access',userId:w.coordinator.id,expectedVersion:version,reason:'Hạ vai điều phối mẫu',
        grants:[g(S,'viewer'),g(T,'viewer')]}));
    })));
    const made=await settle(proposals.propose(w.coordinator,{projectId:S,userId:w.subject.id,docTypes:['design'],expectedTypes:[],reason:BASIS}));
    const demotion=await ran(started).done;
    noDeadlock(made,demotion);
    // the admin command waited on its very first lock, its own row, which the proposal held in KEY SHARE
    expect(ran(started).on).toEqual([expect.stringMatching(ADMIN_ROW_UPDATE)]);
    expect(code(made)).toBe('ok');expect(code(demotion)).toBe('ok');
    expect(await count(w,'identity.account_approvals')).toBe(1);
    // created_at is the start time of each transaction; the wait above is what shows the order of the commits
    const order=(await rows<{ballot:boolean}>(w,`SELECT a.created_at<=e.created_at AS ballot FROM identity.account_approvals a,identity.events e
      WHERE e.user_id=$1 AND e.kind='account_access'`,[w.coordinator.id]));
    expect(order).toEqual([{ballot:true}]);
    // the demotion did happen after the ballot: the coordinator is a viewer of ids.sales now
    expect(await w.identity.scope(tx=>w.identity.activeProjectRole(tx,w.coordinator.id,S))).toBe('viewer');
  });

  test('the frozen grants are the grants the ballot was built from',async()=>{
    // The admin removes a report permission of the SUBJECT while a proposal for that subject runs. Two subjects, one per order, so neither
    // part leans on what the other left behind.
    const narrow=async(userId:string)=>{
      await w.h.operator.query("UPDATE identity.memberships SET report_permissions=ARRAY['people_read'] WHERE user_id=$1 AND project_id=$2",[userId,S]);
      return versionOf(w,userId);
    };
    const cut=(userId:string,role:ProjectGrant['role'],expectedVersion:number)=>
      ({kind:'access',userId,expectedVersion,reason:'Bớt quyền xem người của thành viên mẫu',grants:[g(S,role)]});
    const ballotOf=async(userId:string)=>(await rows<{id:string;subject_account_version:number;previous_grants:ProjectGrant[];grants:ProjectGrant[]}>(w,
      `SELECT id,subject_account_version,previous_grants,grants FROM identity.account_approvals WHERE subject_user_id=$1`,[userId]));

    // (1) the admin first: the proposal waits for the admin row and then freezes the account as the admin left it
    const v1=await narrow(w.subject.id);
    let late:Blocked|undefined;
    const admin=new AccountService(identityOn(w,beforeStatement(w.h.operator,TARGET_LOCK,async()=>{late=await startBlocked(w,()=>propose(w,w.coordinator));})));
    const cutFirst=await settle(admin.command(w.admin,cut(w.subject.id,'engineer',v1)));
    const lateProposal=await ran(late).done;
    noDeadlock(cutFirst,lateProposal);
    expect(ran(late).on).toEqual([expect.stringMatching(ADMIN_ROW_SHARE)]);
    expect(code(cutFirst)).toBe('ok');expect(code(lateProposal)).toBe('ok');
    const [first]=await ballotOf(w.subject.id);
    expect(first.subject_account_version).toBe(v1+1);
    expect(first.previous_grants).toEqual([g(S,'engineer')]);
    expect(first.grants).toEqual([g(S,'engineer','doc_approve:design')]);
    // that ballot applies: it was built from what the account holds now
    await say(w,2,first.id);
    await applyFrozen(w,w.subject.id);
    expect((await rows<{state:string}>(w,'SELECT state FROM identity.account_approvals WHERE id=$1',[first.id]))[0].state).toBe('issued');

    // (2) the proposal first: the admin command waits for the admin row; the ballot keeps the version and grants it was built from
    const v2=await narrow(reviewer.id);
    let cutLate:Blocked|undefined;
    const proposals=new DocApprovalProposalService(identityOn(w,beforeStatement(w.h.operator,BALLOT_INSERT,async()=>{
      cutLate=await startBlocked(w,()=>w.accounts.command(w.admin,cut(reviewer.id,'technical',v2)));
    })));
    const early=await settle(proposals.propose(w.coordinator,{projectId:S,userId:reviewer.id,docTypes:['design'],expectedTypes:[],reason:BASIS}));
    const cutLater=await ran(cutLate).done;
    noDeadlock(early,cutLater);
    expect(ran(cutLate).on).toEqual([expect.stringMatching(ADMIN_ROW_UPDATE)]);
    expect(code(early)).toBe('ok');expect(code(cutLater)).toBe('ok');
    const [second]=await ballotOf(reviewer.id);
    expect(second.subject_account_version).toBe(v2);
    expect(second.previous_grants).toEqual([g(S,'technical','people_read')]);
    expect(second.grants).toEqual([g(S,'technical','people_read','doc_approve:design')]);
    expect(await versionOf(w,reviewer.id)).toBe(v2+1);
    // Synthetic: the operations login marks the ballot approved, so the only reason left to refuse the frozen grants is the version they were frozen at.
    await w.h.operator.query("UPDATE identity.account_approvals SET state='approved',updated_at=now() WHERE id=$1",[second.id]);
    expect(await refusal(applyFrozen(w,reviewer.id))).toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED',status:409});
  });

  test('the admin as subject is refused without touching a lock',async()=>{
    // The hook runs while the admin command holds the admin row FOR UPDATE and awaits the WHOLE proposal: any lock it touched would hang it
    // until the statement timeout, and the answer would not be the eligibility sentence.
    let answer:Awaited<ReturnType<typeof refusal>>|undefined;
    const admin=new AccountService(identityOn(w,beforeStatement(w.h.operator,TARGET_LOCK,async()=>{
      answer=await refusal(propose(w,w.coordinator,{userId:w.admin.id}));
    })));
    const done=await settle(admin.command(w.admin,{kind:'revoke_sessions',userId:w.subject.id,expectedVersion:await versionOf(w,w.subject.id),reason:'Thu hồi phiên của thành viên mẫu'}));
    noDeadlock(done);
    expect(code(done)).toBe('ok');
    expect(answer).toEqual({code:'DOC_APPROVAL_PROPOSAL_INVALID',status:422,message:INELIGIBLE});
    expect(await count(w,'identity.account_approvals')).toBe(0);
  });

  test('two identical proposals at once store one ballot',async()=>{
    const [a,b]=await Promise.all([settle(propose(w,w.coordinator)),settle(propose(w,w.coordinator))]);
    noDeadlock(a,b);
    expect([code(a),code(b)]).toEqual(['ok','ok']);
    const results=[a,b].map(s=>(s as {value:{approvalId:string;replayed:boolean}}).value);
    expect(results[0].approvalId).toBe(results[1].approvalId);
    expect(results.filter(r=>r.replayed).length).toBe(1);
    expect(await count(w,'identity.account_approvals')).toBe(1);
    expect(await proposedEvents(w)).toBe(1);
  });

  test('two managers proposing for the same member at once store one ballot',async()=>{
    const results=await Promise.all([settle(propose(w,w.coordinator)),settle(propose(w,w.coManager))]);
    noDeadlock(...results);
    expect(results.map(code).sort()).toEqual(['APPROVAL_PENDING','ok']);
    expect(await count(w,'identity.account_approvals')).toBe(1);
    expect(await proposedEvents(w)).toBe(1);
  });

  test('OQ-38 two co-managers proposing for each other at once both succeed without a deadlock',async()=>{
    const results=await Promise.allSettled([propose(w,w.coordinator,{userId:w.coManager.id}),propose(w,w.coManager,{userId:w.coordinator.id})]);
    const settled=results.map(r=>r.status==='fulfilled'?{ok:true as const,value:r.value}:{ok:false as const,error:r.reason});
    noDeadlock(...settled);
    expect(settled.map(code)).toEqual(['ok','ok']);
    const subjects=(await rows<{subject_user_id:string;proposer_id:string}>(w,'SELECT subject_user_id,proposer_id FROM identity.account_approvals ORDER BY proposer_id'));
    expect(subjects).toHaveLength(2);
    expect(new Set(subjects.map(r=>r.subject_user_id))).toEqual(new Set([w.coordinator.id,w.coManager.id]));
    for(const r of subjects) expect(r.subject_user_id).not.toBe(r.proposer_id);
  });

  test("OQ-38 a co-manager's proposal waits for the other's row locks and then succeeds",async()=>{
    let second:Blocked|undefined;
    const first=new DocApprovalProposalService(identityOn(w,beforeStatement(w.h.operator,BALLOT_INSERT,async()=>{
      second=await startBlocked(w,()=>propose(w,w.coManager,{userId:w.coordinator.id}));
    })));
    const one=await settle(first.propose(w.coordinator,{projectId:S,userId:w.coManager.id,docTypes:['design'],expectedTypes:[],reason:BASIS}));
    const two=await ran(second).done;
    noDeadlock(one,two);
    // the second passed the shared KEY SHARE on the admin row and waited on the two account rows the first held
    expect(ran(second).on).toEqual([expect.stringMatching(/FROM identity\.users WHERE id=ANY\(\$1::uuid\[\]\) ORDER BY id FOR NO KEY UPDATE$/)]);
    expect([code(one),code(two)]).toEqual(['ok','ok']);
    expect(await count(w,'identity.account_approvals')).toBe(2);
    expect(await count(w,'identity.account_approvals WHERE subject_user_id=ANY($1::uuid[])',[[w.coordinator.id,w.coManager.id]])).toBe(2);
  });

  test('a unique-index conflict is answered APPROVAL_PENDING',async()=>{
    // An operations login opens a ballot for the subject on its own connection, right before the service's insert: the unique index refuses
    // the service's row. Through the handler, so the answer is the one a browser sees, not the shared DUPLICATE_CODE and not a 500.
    const identity=identityOn(w,beforeStatement(w.h.operator,BALLOT_INSERT,async()=>{
      await w.h.operator.query(`INSERT INTO identity.account_approvals(tenant_id,kind,subject_user_id,subject_account_version,previous_grants,proposer_id,grants,reason)
        VALUES($1,'access_change',$2,1,$3,$4,$5,'Phiếu mở do login vận hành')`,
        [ids.tenant,w.subject.id,JSON.stringify([g(S,'engineer')]),w.admin.id,JSON.stringify([g(S,'engineer','doc_approve:plan')])]);
    }));
    const store=globalThis as unknown as {libetechSessions?:Map<string,{principal:Principal;expires:number}>};
    const token='t'+randomUUID().replace(/-/g,'');
    (store.libetechSessions??=new Map()).set(token,{principal:w.coordinator,expires:Date.now()+3600000});
    try {
      const request=new Request('http://127.0.0.1:3147/api/team/doc-approvals',{method:'POST',headers:{host:'127.0.0.1:3147',origin:'http://127.0.0.1:3147',cookie:COOKIE+'='+token},
        body:JSON.stringify({projectId:S,userId:w.subject.id,docTypes:['design'],expectedTypes:[],reason:BASIS})});
      const r=await handleDocApprovalApi(request,[],()=>identity);
      expect(r.status).toBe(409);
      const b=await r.json() as {error:{code:string;message:string}};
      expect(b.error).toEqual({code:'APPROVAL_PENDING',message:PENDING});
      expect(r.headers.get('cache-control')).toBe('no-store');
    } finally {store.libetechSessions?.delete(token);}
    expect(await count(w,'identity.account_approvals')).toBe(1);
    expect(await count(w,'identity.account_approval_voters')).toBe(0);
    expect(await proposedEvents(w)).toBe(0);
  });
});
