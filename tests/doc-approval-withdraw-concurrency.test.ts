import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {native,waitForBlocked} from './slice1-db';
import {approver,beforeStatement,reviewer} from './slice3-fixtures';
import {openWorld,propose,say,rows,identityOn,type World} from './doc-approval-fixtures';
import {AccountService} from '../src/server/accounts';
import {AccountApprovalService} from '../src/server/account-approval';
import {DocApprovalProposalService} from '../src/server/doc-approval-proposals';
import {ids} from '../src/server/identities';
import type {Principal,ProjectGrant} from '../src/server/types';

// Task 7c, Task 2: the withdrawal and the admin's cancel under real concurrency. The order is built with beforeStatement (the hook runs just
// before the first matching statement) and waitForBlocked (pg_stat_activity), never with a sleep. No case accepts SQLSTATE 40P01.
// These cases need exclusive use of the test database: waitForBlocked and waiting() count every lock wait in it, from any session.
const S=ids.sales,T=ids.transport;
const WITHDRAW_BASIS='Đã trình nhầm loại tài liệu, xin rút lại';
const CANCEL_BASIS='Huỷ phiếu trình chưa đúng của điều phối';
/** The admin command's lock of the TARGET account row: `operator` has already locked the admin row FOR UPDATE when this statement runs. */
const TARGET_LOCK=/account_version AS version FROM identity\.users WHERE id=\$1 FOR UPDATE/;
/** The withdrawal's write of the ballot state: it holds the ballot row FOR UPDATE by then. */
const WITHDRAW_UPDATE=/^UPDATE identity\.account_approvals SET state='expired',updated_at=now\(\) WHERE id=\$1$/;
/** The coordinator write's FIRST lock (T7C-5): KEY SHARE on the account-admin row. */
const ADMIN_ROW_SHARE=/^SELECT id FROM identity\.users WHERE id=\$1 FOR KEY SHARE$/;
/** `operator` of the admin path: FOR UPDATE on the admin's own row, before any other lock of an admin command. */
const ADMIN_ROW_UPDATE=/^SELECT id FROM identity\.users WHERE id=\$1 AND active AND password_hash IS NOT NULL FOR UPDATE$/;
/** A lock of one ballot row, by the withdrawal (R5) or by a vote. */
const BALLOT_ROW_LOCK=/FROM identity\.account_approvals WHERE id=\$1 FOR UPDATE$/;

type Settled={ok:true;value:unknown}|{ok:false;error:unknown};
/** Never rejects, so a call started inside a hook can fail before anyone awaits it without an unhandled rejection. */
const settle=(run:Promise<unknown>):Promise<Settled>=>run.then(value=>({ok:true as const,value}),(error:unknown)=>({ok:false as const,error}));
const code=(s:Settled)=>s.ok?'ok':String((s.error as {code?:string})?.code??(s.error as Error)?.message);
const noDeadlock=(...all:Settled[])=>{for(const s of all) expect(code(s),'a deadlock is never an answer').not.toBe('40P01');};
const g=(projectId:string,role:ProjectGrant['role'],...perms:string[]):ProjectGrant=>({projectId,role,reportPermissions:perms as ProjectGrant['reportPermissions']});
const count=async(w:World,sql:string,params:unknown[]=[])=>Number((await rows<{n:string}>(w,`SELECT count(*) n FROM ${sql}`,params))[0].n);
const stateOf=async(w:World,id:string)=>(await rows<{state:string}>(w,'SELECT state FROM identity.account_approvals WHERE id=$1',[id]))[0].state;
const versionOf=async(w:World,userId:string)=>(await rows<{v:number}>(w,'SELECT account_version v FROM identity.users WHERE id=$1',[userId]))[0].v;
/** The closing events of one ballot, by kind. identity.events is not emptied by reset() on PostgreSQL: count by ballot id only. */
const closings=(w:World,id:string,kinds=['access_change_withdrawn','access_change_cancelled'])=>
  count(w,'identity.events WHERE kind=ANY($1::text[]) AND detail->>\'approvalId\'=$2',[kinds,id]);
const openFor=(w:World,userId:string)=>count(w,"identity.account_approvals WHERE kind='access_change' AND subject_user_id=$1 AND state IN ('pending','approved')",[userId]);
/** The statements waiting on a lock right now: SQL text with $n placeholders, never a value. */
const waiting=async(w:World)=>(await rows<{query:string}>(w,"SELECT query FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'"))
  .map(row=>row.query.replace(/\s+/g,' ').trim());
type Blocked={done:Promise<Settled>;on:string[]};
/** Called inside a hook: starts `run`, returns once it waits on a lock, with the statement it waits on. */
const startBlocked=async(w:World,run:()=>Promise<unknown>):Promise<Blocked>=>{const done=settle(run());await waitForBlocked(w.h,1);return {done,on:await waiting(w)};};
const ran=(b:Blocked|undefined):Blocked=>{expect(b,'the hook ran').toBeDefined();return b!;};
const withdrawWith=(proposals:DocApprovalProposalService,p:Principal,id:string)=>proposals.withdraw(p,id,{reason:WITHDRAW_BASIS});
const cancelWith=async(w:World,accounts:AccountService,id:string,userId:string)=>
  accounts.command(w.admin,{kind:'cancel_access_change',userId,expectedVersion:await versionOf(w,userId),reason:CANCEL_BASIS,approvalId:id});

describe.skipIf(!native)('withdraw and cancel concurrency (native PostgreSQL)',()=>{
  let w:World;
  beforeEach(async()=>{w=await openWorld();});
  afterEach(async()=>{await w.h.reset();await w.h.close();});

  test('two withdrawals at once write one event',async()=>{
    const made=await propose(w,w.coordinator);
    const results=await Promise.all([settle(withdrawWith(w.proposals,w.coordinator,made.approvalId)),settle(withdrawWith(w.proposals,w.coordinator,made.approvalId))]);
    noDeadlock(...results);
    expect(results.map(code).sort()).toEqual(['APPROVAL_CLOSED','ok']);
    expect(await closings(w,made.approvalId)).toBe(1);
    expect(await stateOf(w,made.approvalId)).toBe('expired');
  });

  test('a withdrawal racing a vote never drops the vote silently',async()=>{
    // (1) the vote first: it holds the ballot row and stops before inserting its vote; the withdrawal waits on that row, then sees it approved
    const first=await propose(w,w.coordinator);
    let late:Blocked|undefined;
    const voting=new AccountApprovalService(identityOn(w,beforeStatement(w.h.operator,/INSERT INTO identity\.account_approval_votes/,async()=>{
      late=await startBlocked(w,()=>withdrawWith(w.proposals,w.coordinator,first.approvalId));
    })));
    const seat=w.approvers[2];
    const vote=await settle(voting.vote(seat.telegram,seat.telegram,'private',first.approvalId,'agree'));
    const withdrawal=await ran(late).done;
    noDeadlock(vote,withdrawal);
    expect(ran(late).on).toEqual([expect.stringMatching(BALLOT_ROW_LOCK)]);
    expect(code(vote)).toBe('ok');expect(code(withdrawal)).toBe('BALLOT_ALREADY_APPROVED');
    expect(await stateOf(w,first.approvalId)).toBe('approved');
    expect(await count(w,'identity.account_approval_votes WHERE approval_id=$1',[first.approvalId])).toBe(1);
    expect(await closings(w,first.approvalId)).toBe(0);
    // (2) the withdrawal first: it holds the ballot row and stops before closing it; the vote waits on that row, then finds it closed
    const second=await propose(w,w.coordinator,{userId:reviewer.id});
    let voteLate:Blocked|undefined;
    const withdrawing=new DocApprovalProposalService(identityOn(w,beforeStatement(w.h.operator,WITHDRAW_UPDATE,async()=>{
      voteLate=await startBlocked(w,()=>w.ballots.vote(seat.telegram,seat.telegram,'private',second.approvalId,'agree'));
    })));
    const done=await settle(withdrawWith(withdrawing,w.coordinator,second.approvalId));
    const refused=await ran(voteLate).done;
    noDeadlock(done,refused);
    expect(ran(voteLate).on).toEqual([expect.stringMatching(BALLOT_ROW_LOCK)]);
    expect(code(done)).toBe('ok');expect(code(refused)).toBe('APPROVAL_CLOSED');
    expect(await stateOf(w,second.approvalId)).toBe('expired');
    expect(await count(w,'identity.account_approval_votes WHERE approval_id=$1',[second.approvalId])).toBe(0);
  });

  test("a withdrawal racing the admin's cancel writes one closing event",async()=>{
    // (1) the cancel holds the admin row; the withdrawal waits on its first lock, then finds the ballot closed
    const first=await propose(w,w.coordinator);
    let late:Blocked|undefined;
    const admin=new AccountService(identityOn(w,beforeStatement(w.h.operator,TARGET_LOCK,async()=>{
      late=await startBlocked(w,()=>withdrawWith(w.proposals,w.coordinator,first.approvalId));
    })));
    const cancelled=await settle(cancelWith(w,admin,first.approvalId,w.subject.id));
    const withdrawal=await ran(late).done;
    noDeadlock(cancelled,withdrawal);
    expect(ran(late).on).toEqual([expect.stringMatching(ADMIN_ROW_SHARE)]);
    expect([code(cancelled),code(withdrawal)]).toEqual(['ok','APPROVAL_CLOSED']);
    expect(await closings(w,first.approvalId)).toBe(1);
    expect(await closings(w,first.approvalId,['access_change_cancelled'])).toBe(1);
    // (2) the withdrawal holds the ballot row (and KEY SHARE on the admin row); the cancel waits at `operator`, then finds the ballot closed
    const second=await propose(w,w.coordinator,{userId:reviewer.id});
    let cancelLate:Blocked|undefined;
    const withdrawing=new DocApprovalProposalService(identityOn(w,beforeStatement(w.h.operator,WITHDRAW_UPDATE,async()=>{
      cancelLate=await startBlocked(w,()=>cancelWith(w,w.accounts,second.approvalId,reviewer.id));
    })));
    const done=await settle(withdrawWith(withdrawing,w.coordinator,second.approvalId));
    const refused=await ran(cancelLate).done;
    noDeadlock(done,refused);
    expect(ran(cancelLate).on).toEqual([expect.stringMatching(ADMIN_ROW_UPDATE)]);
    expect([code(done),code(refused)]).toEqual(['ok','APPROVAL_CLOSED']);
    expect(await closings(w,second.approvalId)).toBe(1);
    expect(await closings(w,second.approvalId,['access_change_withdrawn'])).toBe(1);
  });

  test('an admin command on the proposer racing a withdrawal never deadlocks',async()=>{
    const made=await propose(w,w.coordinator);
    const race=async(grants:ProjectGrant[],reason:string)=>{
      let late:Blocked|undefined;
      const admin=new AccountService(identityOn(w,beforeStatement(w.h.operator,TARGET_LOCK,async()=>{
        late=await startBlocked(w,()=>withdrawWith(w.proposals,w.coordinator,made.approvalId));
      })));
      const done=await settle(admin.command(w.admin,{kind:'access',userId:w.coordinator.id,expectedVersion:await versionOf(w,w.coordinator.id),reason,grants}));
      const withdrawal=await ran(late).done;
      noDeadlock(done,withdrawal);
      expect(ran(late).on).toEqual([expect.stringMatching(ADMIN_ROW_SHARE)]);
      expect(code(done)).toBe('ok');
      return withdrawal;
    };
    // (1) the admin removes the proposer from the project: the withdrawal sees it and is refused; the ballot stays pending
    expect(code(await race([g(T,'viewer')],'Gỡ điều phối mẫu khỏi dự án'))).toBe('SCOPE_DENIED');
    expect(await stateOf(w,made.approvalId)).toBe('pending');
    expect(await closings(w,made.approvalId)).toBe(0);
    // (2) back as a manager (operations login), then the admin demotes the proposer to viewer: a member in any role withdraws (OQ-50 c)
    await w.h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'manager')`,[ids.tenant,w.coordinator.id,S]);
    expect(code(await race([g(S,'viewer'),g(T,'viewer')],'Hạ vai điều phối mẫu'))).toBe('ok');
    expect(await stateOf(w,made.approvalId)).toBe('expired');
    expect(await closings(w,made.approvalId,['access_change_withdrawn'])).toBe(1);
  });

  test("an admin cancel racing a coordinator's proposal for the same member leaves at most one open ballot",async()=>{
    // order 1: the admin holds the admin row, the co-manager's proposal waits on its first lock; the cancel closes B1, the proposal opens B2
    const b1=await propose(w,w.coordinator);
    let late:Blocked|undefined;
    const admin=new AccountService(identityOn(w,beforeStatement(w.h.operator,TARGET_LOCK,async()=>{late=await startBlocked(w,()=>propose(w,w.coManager));})));
    const cancelled=await settle(cancelWith(w,admin,b1.approvalId,w.subject.id));
    const proposal=await ran(late).done;
    noDeadlock(cancelled,proposal);
    expect(ran(late).on).toEqual([expect.stringMatching(ADMIN_ROW_SHARE)]);
    expect([code(cancelled),code(proposal)]).toEqual(['ok','ok']);
    expect(await stateOf(w,b1.approvalId)).toBe('expired');
    expect(await openFor(w,w.subject.id)).toBe(1);
    // order 2: the proposal holds the two account rows and is about to look for an open ballot; the cancel waits at `operator`.
    // The proposal finds B1 still open, then the cancel closes it: no B2.
    const c1=await propose(w,w.coordinator,{userId:reviewer.id});
    let cancelLate:Blocked|undefined;
    const proposing=new DocApprovalProposalService(identityOn(w,beforeStatement(w.h.operator,
      /^SELECT id,proposer_id,grants,previous_grants,reason,state,expires_at FROM identity\.account_approvals/,async()=>{
        cancelLate=await startBlocked(w,()=>cancelWith(w,w.accounts,c1.approvalId,reviewer.id));
      })));
    const refused=await settle(proposing.propose(w.coManager,{projectId:S,userId:reviewer.id,docTypes:['design'],expectedTypes:[],reason:'Cần người duyệt bản thiết kế của dự án'}));
    const cancel2=await ran(cancelLate).done;
    noDeadlock(refused,cancel2);
    expect(ran(cancelLate).on).toEqual([expect.stringMatching(ADMIN_ROW_UPDATE)]);
    expect([code(refused),code(cancel2)]).toEqual(['APPROVAL_PENDING','ok']);
    expect(await openFor(w,reviewer.id)).toBe(0);
    // variant 3: B1 is past its deadline; the proposal runs first, closes it and opens B2; the cancel of B1 is refused as closed
    const d1=await propose(w,w.coordinator,{userId:approver.id});
    await w.h.operator.query("UPDATE identity.account_approvals SET expires_at=now()-interval '1 minute' WHERE id=$1",[d1.approvalId]);
    let cancelLater:Blocked|undefined;
    const opening=new DocApprovalProposalService(identityOn(w,beforeStatement(w.h.operator,/INSERT INTO identity\.account_approvals/,async()=>{
      cancelLater=await startBlocked(w,()=>cancelWith(w,w.accounts,d1.approvalId,approver.id));
    })));
    const opened=await settle(opening.propose(w.coManager,{projectId:S,userId:approver.id,docTypes:['design'],expectedTypes:[],reason:'Cần người duyệt bản thiết kế của dự án'}));
    const cancel3=await ran(cancelLater).done;
    noDeadlock(opened,cancel3);
    expect(ran(cancelLater).on).toEqual([expect.stringMatching(ADMIN_ROW_UPDATE)]);
    expect([code(opened),code(cancel3)]).toEqual(['ok','APPROVAL_CLOSED']);
    expect(await stateOf(w,d1.approvalId)).toBe('expired');
    expect(await openFor(w,approver.id)).toBe(1);
    for(const userId of [w.subject.id,reviewer.id,approver.id]) expect(await openFor(w,userId),userId).toBeLessThanOrEqual(1);
  });

  test('a cancel and a vote on a ballot frozen at an older version do not deadlock',async()=>{
    const made=await propose(w,w.coordinator);
    await w.accounts.command(w.admin,{kind:'revoke_sessions',userId:w.subject.id,expectedVersion:await versionOf(w,w.subject.id),reason:'Thu hồi phiên của thành viên mẫu'});
    const seat=w.approvers[2];
    // no waitForBlocked: the cancel never waits on the ballot row, which does not match its version filter
    const [cancelled,vote]=await Promise.all([settle(cancelWith(w,w.accounts,made.approvalId,w.subject.id)),
      settle(w.ballots.vote(seat.telegram,seat.telegram,'private',made.approvalId,'agree'))]);
    noDeadlock(cancelled,vote);
    expect([code(cancelled),code(vote)]).toEqual(['APPROVAL_NOT_FOUND','APPROVAL_CLOSED']);
    expect(await stateOf(w,made.approvalId)).toBe('expired');
    expect(await count(w,"identity.events WHERE kind='access_change_expired' AND detail->>'approvalId'=$1",[made.approvalId])).toBe(1);
    expect(await closings(w,made.approvalId)).toBe(0);
  });

  test('an admin change to the subject racing a withdrawal is seen by it',async()=>{
    for(const userId of [w.subject.id,reviewer.id])
      await w.h.operator.query("UPDATE identity.memberships SET report_permissions=ARRAY['people_read'] WHERE user_id=$1 AND project_id=$2",[userId,S]);
    const narrow=async(accounts:AccountService,userId:string,role:ProjectGrant['role'])=>
      accounts.command(w.admin,{kind:'access',userId,expectedVersion:await versionOf(w,userId),reason:'Bớt quyền xem người của thành viên mẫu',grants:[g(S,role)]});
    // order 1: the admin holds the admin row (target: the subject); the withdrawal waits at R3, then sees the new account version
    const first=await propose(w,w.coordinator);
    let late:Blocked|undefined;
    const admin=new AccountService(identityOn(w,beforeStatement(w.h.operator,TARGET_LOCK,async()=>{
      late=await startBlocked(w,()=>withdrawWith(w.proposals,w.coordinator,first.approvalId));
    })));
    const narrowed=await settle(narrow(admin,w.subject.id,'engineer'));
    const withdrawal=await ran(late).done;
    noDeadlock(narrowed,withdrawal);
    expect(ran(late).on).toEqual([expect.stringMatching(ADMIN_ROW_SHARE)]);
    expect([code(narrowed),code(withdrawal)]).toEqual(['ok','APPROVAL_CLOSED']);
    expect(await stateOf(w,first.approvalId)).toBe('pending');
    expect(await closings(w,first.approvalId)).toBe(0);
    // order 2: the withdrawal stops before closing the ballot; the admin waits at `operator`; the withdrawal commits, then the admin
    const second=await propose(w,w.coordinator,{userId:reviewer.id});
    let adminLate:Blocked|undefined;
    const withdrawing=new DocApprovalProposalService(identityOn(w,beforeStatement(w.h.operator,WITHDRAW_UPDATE,async()=>{
      adminLate=await startBlocked(w,()=>narrow(w.accounts,reviewer.id,'technical'));
    })));
    const done=await settle(withdrawWith(withdrawing,w.coordinator,second.approvalId));
    const later=await ran(adminLate).done;
    noDeadlock(done,later);
    expect(ran(adminLate).on).toEqual([expect.stringMatching(ADMIN_ROW_UPDATE)]);
    expect([code(done),code(later)]).toEqual(['ok','ok']);
    expect(await closings(w,second.approvalId,['access_change_withdrawn'])).toBe(1);
    expect(await versionOf(w,reviewer.id)).toBe(2);
  });
});
