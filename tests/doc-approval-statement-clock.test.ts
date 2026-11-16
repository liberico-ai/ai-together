import {afterEach,beforeEach,expect,test} from 'vitest';
import {openWorld,propose,say,rows,identityOn,beforeStatementInTx,BASIS,type World} from './doc-approval-fixtures';
import {AccountService} from '../src/server/accounts';
import {DocApprovalProposalService,type DocApprovalProposal} from '../src/server/doc-approval-proposals';
import {ids} from '../src/server/identities';
import type {Queryable} from '../src/server/db';

// Codex gate round 1, finding P1 (Task 7c + step 16b). now() is the start of the transaction; a command of this PR may wait on a row lock
// (T7C-5) before it reads whether a ballot is still open, so every such reading, and every closing stamp the pair wait reads later, is made
// on the statement clock, clock_timestamp(). Each case below puts the deadline of a ballot (or the end of a 24-hour pair wait) INSIDE the
// command's own transaction: the operations login sets it MARGIN_MS after the database clock just before the command, and a hook inside the
// command's transaction, just before the statement that decides, sleeps on the database clock (pg_sleep) until it has passed. The hook also
// records that the transaction began before that moment, so a slow machine cannot turn a case into a pass that proves nothing.
// Both engines. The real lock waits (native only) are in tests/doc-approval-withdraw-concurrency.test.ts. Synthetic data; one world per case.
let w:World;
beforeEach(async()=>{w=await openWorld();});
afterEach(async()=>{await w.h.reset();await w.h.close();});

const S=ids.sales;
const MARGIN_MS=1500;
const WITHDRAW_BASIS='Đã trình nhầm loại tài liệu, xin rút lại';
const CANCEL_BASIS='Huỷ phiếu trình chưa đúng của điều phối';
const PAIR_WAIT='Anh/chị chưa trình lại được cho người này: phiếu trước của anh/chị cho họ không được áp, và khoảng chờ 24 giờ sau phiếu đó chưa hết. Thử lại sau, hoặc nhờ quản trị tài khoản trình.';
/** Withdraw R5 and every vote: the lock of one ballot row. In the withdrawing transaction only R5 matches. */
const BALLOT_ROW_LOCK=/FROM identity\.account_approvals WHERE id=\$1 FOR UPDATE$/;
/** The admin cancel: its lock of the ballot row (the operator row and the account row are held by then). */
const CANCEL_BALLOT_LOCK=/FROM identity\.account_approvals\s+WHERE id=\$1 AND kind='access_change' AND subject_user_id=\$2 AND subject_account_version=\$3 FOR UPDATE$/;
/** Propose P13: the open, living ballot of the subject. */
const OPEN_BALLOT_READ=/^SELECT id,proposer_id,grants,previous_grants,reason,state,expires_at FROM identity\.account_approvals/;
/** Propose P14: the pair wait. */
const PAIR_WAIT_READ=/^SELECT 1 FROM identity\.account_approvals a\s/;
/** listOwn: the caller's own open ballots. */
const OWN_LIST_READ=/^SELECT a\.id,a\.subject_user_id,a\.grants,a\.previous_grants,a\.state,a\.expires_at\s/;
/** The admin list: the open ballot of one account. */
const ADMIN_OPEN_READ=/^SELECT id,state,reason,expires_at,grants,previous_grants,proposer_id FROM identity\.account_approvals/;

type Settled={ok:true;value:unknown}|{ok:false;error:unknown};
const settle=(run:Promise<unknown>):Promise<Settled>=>run.then(value=>({ok:true as const,value}),(error:unknown)=>({ok:false as const,error}));
const code=(s:Settled)=>s.ok?'ok':String((s.error as {code?:string})?.code??(s.error as Error)?.message);
const messageOf=(s:Settled)=>s.ok?'':String((s.error as Error)?.message);
const count=async(sql:string,params:unknown[]=[])=>Number((await rows<{n:string}>(w,`SELECT count(*) n FROM ${sql}`,params))[0].n);
const stateOf=async(id:string)=>(await rows<{state:string}>(w,'SELECT state FROM identity.account_approvals WHERE id=$1',[id]))[0].state;
const versionOf=async(userId:string)=>(await rows<{v:number}>(w,'SELECT account_version v FROM identity.users WHERE id=$1',[userId]))[0].v;
/** The closing events of one ballot, by kind. identity.events is not emptied by reset() on PostgreSQL: count by ballot id only. */
const closings=(id:string,kinds=['access_change_withdrawn','access_change_cancelled'])=>
  count('identity.events WHERE kind=ANY($1::text[]) AND detail->>\'approvalId\'=$2',[kinds,id]);
const proposeInput={projectId:S,docTypes:['design'],expectedTypes:[],reason:BASIS};

/** Operations login: the ballot's deadline, MARGIN_MS after the database clock. */
const deadlineSoon=(id:string)=>w.h.operator.query(
  "UPDATE identity.account_approvals SET expires_at=clock_timestamp()+$2::int*interval '1 millisecond' WHERE id=$1",[id,MARGIN_MS]);
type Crossing={startedBefore:boolean;passedAfter:boolean};
/** A hook for beforeStatementInTx: inside the command's own transaction, sleeps on the database clock until `moment` (an SQL expression over
 *  the ballot row `a`) has passed, and records whether the transaction began before it and whether it has passed. */
const sleepPast=(seen:Crossing[],id:string,moment:string)=>async(tx:Queryable)=>{
  const at=(await tx.query<{started_before:boolean;left:number}>(`SELECT now()<${moment} AS started_before,
   greatest(0,extract(epoch FROM ${moment}-clock_timestamp()))::float8 AS left FROM identity.account_approvals a WHERE a.id=$1`,[id])).rows[0];
  await tx.query('SELECT pg_sleep($1::float8)',[Number(at.left)+0.25]);
  const after=(await tx.query<{passed:boolean}>(`SELECT clock_timestamp()>${moment} AS passed FROM identity.account_approvals a WHERE a.id=$1`,[id])).rows[0];
  seen.push({startedBefore:at.started_before,passedAfter:after.passed});
};
const CROSSED:Crossing[]=[{startedBefore:true,passedAfter:true}];

test('Codex P1 (a) a withdrawal whose ballot passes its deadline inside the withdrawing transaction answers APPROVAL_CLOSED, writes no event, does not close the ballot, and the pair wait still holds (OQ-48 b, OQ-51 b, T7C-30)',async()=>{
  const made=await propose(w,w.coordinator);
  const seen:Crossing[]=[];
  const proposals=new DocApprovalProposalService(identityOn(w,beforeStatementInTx(w.h.operator,BALLOT_ROW_LOCK,sleepPast(seen,made.approvalId,'a.expires_at'))));
  await deadlineSoon(made.approvalId);
  const withdrawal=await settle(proposals.withdraw(w.coordinator,made.approvalId,{reason:WITHDRAW_BASIS}));
  expect(seen,'the withdrawing transaction began before the deadline, which passed before R5').toEqual(CROSSED);
  expect(code(withdrawal)).toBe('APPROVAL_CLOSED');
  expect(await closings(made.approvalId,['access_change_withdrawn'])).toBe(0);
  expect(await stateOf(made.approvalId)).toBe('pending');            // not `expired` by this withdrawal
  // no exemption was bought: the next proposal for the same person waits 24 hours from the deadline (T7C-19 2)
  const again=await settle(propose(w,w.coordinator));
  expect(code(again)).toBe('RATE_LIMITED');
  expect(messageOf(again)).toBe(PAIR_WAIT);
});

test('Codex P1 (b) the admin cancel of a coordinator ballot that passes its deadline inside the cancelling transaction answers APPROVAL_CLOSED and writes no event (OQ-49 a, OQ-51 b)',async()=>{
  const made=await propose(w,w.coordinator);
  const seen:Crossing[]=[];
  const accounts=new AccountService(identityOn(w,beforeStatementInTx(w.h.operator,CANCEL_BALLOT_LOCK,sleepPast(seen,made.approvalId,'a.expires_at'))));
  const expectedVersion=await versionOf(w.subject.id);
  await deadlineSoon(made.approvalId);
  const cancelled=await settle(accounts.command(w.admin,{kind:'cancel_access_change',userId:w.subject.id,expectedVersion,reason:CANCEL_BASIS,approvalId:made.approvalId}));
  expect(seen,'the cancelling transaction began before the deadline, which passed before the ballot read').toEqual(CROSSED);
  expect(code(cancelled)).toBe('APPROVAL_CLOSED');
  expect(await closings(made.approvalId,['access_change_cancelled'])).toBe(0);
  expect(await stateOf(made.approvalId)).toBe('pending');
  expect(await versionOf(w.subject.id)).toBe(expectedVersion);
});

test("Codex P1 (c) a co-manager's open ballot that passes its deadline inside the proposing transaction is closed by P15 and the new ballot is opened, never answered APPROVAL_PENDING (T7C-19)",async()=>{
  const other=await propose(w,w.coManager);
  const seen:Crossing[]=[];
  const proposals=new DocApprovalProposalService(identityOn(w,beforeStatementInTx(w.h.operator,OPEN_BALLOT_READ,sleepPast(seen,other.approvalId,'a.expires_at'))));
  await deadlineSoon(other.approvalId);
  const opened=await settle(proposals.propose(w.coordinator,{...proposeInput,userId:w.subject.id}));
  expect(seen,'the proposing transaction began before the deadline, which passed before P13').toEqual(CROSSED);
  expect(code(opened)).toBe('ok');
  const made=(opened as {ok:true;value:DocApprovalProposal}).value;
  expect(made).toMatchObject({state:'pending',replayed:false});
  expect(made.approvalId).not.toBe(other.approvalId);
  expect(await stateOf(other.approvalId)).toBe('expired');
  const events=await rows<{detail:{expiredApprovalIds?:string[]}}>(w,"SELECT detail FROM identity.events WHERE kind='access_change_proposed' AND detail->>'approvalId'=$1",[made.approvalId]);
  expect(events.map(e=>e.detail.expiredApprovalIds)).toEqual([[other.approvalId]]);
  expect(await count("identity.account_approvals WHERE kind='access_change' AND subject_user_id=$1 AND state IN ('pending','approved')",[w.subject.id])).toBe(1);
});

test("Codex P1 (c) the proposer's own ballot that passes its deadline inside the proposing transaction is neither replayed nor answered APPROVAL_PENDING: the pair wait refuses and marks nothing (T7C-19 2, 8)",async()=>{
  const mine=await propose(w,w.coordinator);
  const seen:Crossing[]=[];
  const proposals=new DocApprovalProposalService(identityOn(w,beforeStatementInTx(w.h.operator,OPEN_BALLOT_READ,sleepPast(seen,mine.approvalId,'a.expires_at'))));
  await deadlineSoon(mine.approvalId);
  const again=await settle(proposals.propose(w.coordinator,{...proposeInput,userId:w.subject.id}));
  expect(seen,'the proposing transaction began before the deadline, which passed before P13').toEqual(CROSSED);
  expect(code(again)).toBe('RATE_LIMITED');
  expect(messageOf(again)).toBe(PAIR_WAIT);
  expect(await stateOf(mine.approvalId)).toBe('pending');
  expect(await count("identity.account_approvals WHERE kind='access_change' AND subject_user_id=$1",[w.subject.id])).toBe(1);
});

test('Codex P1 (c) a 24-hour pair wait that ends inside the proposing transaction no longer refuses: P14 reads its end on the statement clock (T7C-19 2)',async()=>{
  const rejected=await propose(w,w.coordinator);
  await say(w,0,rejected.approvalId,'reject');
  expect(await stateOf(rejected.approvalId)).toBe('rejected');
  const seen:Crossing[]=[];
  // a rejected ballot closes at LEAST(updated_at, expires_at); expires_at is 48 hours after its opening, so the closing is updated_at
  const proposals=new DocApprovalProposalService(identityOn(w,beforeStatementInTx(w.h.operator,PAIR_WAIT_READ,
    sleepPast(seen,rejected.approvalId,"least(a.updated_at,a.expires_at)+interval '24 hours'"))));
  await w.h.operator.query("UPDATE identity.account_approvals SET updated_at=clock_timestamp()-interval '24 hours'+$2::int*interval '1 millisecond' WHERE id=$1",
    [rejected.approvalId,MARGIN_MS]);
  const opened=await settle(proposals.propose(w.coordinator,{...proposeInput,userId:w.subject.id}));
  expect(seen,'the proposing transaction began inside the 24 hours, which ended before P14').toEqual(CROSSED);
  expect(code(opened)).toBe('ok');
  expect((opened as {ok:true;value:DocApprovalProposal}).value).toMatchObject({state:'pending',replayed:false});
});

test('Codex P1 (e) the own list does not show a ballot that passes its deadline inside the listing transaction (OQ-50 c)',async()=>{
  const mine=await propose(w,w.coordinator);
  const seen:Crossing[]=[];
  const proposals=new DocApprovalProposalService(identityOn(w,beforeStatementInTx(w.h.operator,OWN_LIST_READ,sleepPast(seen,mine.approvalId,'a.expires_at'))));
  await deadlineSoon(mine.approvalId);
  const listed=await proposals.listOwn(w.coordinator,{projectId:S});
  expect(seen,'the listing transaction began before the deadline, which passed before the read').toEqual(CROSSED);
  expect(listed.map(row=>row.approvalId)).toEqual([]);
});

test('Codex P1 (f) the admin list does not show as open a ballot that passes its deadline inside the listing transaction (T7C-9, T7C-15)',async()=>{
  const mine=await propose(w,w.coordinator);
  const seen:Crossing[]=[];
  const accounts=new AccountService(identityOn(w,beforeStatementInTx(w.h.operator,ADMIN_OPEN_READ,sleepPast(seen,mine.approvalId,'a.expires_at'))));
  await deadlineSoon(mine.approvalId);
  const listed=(await accounts.list(w.admin)).find(row=>row.id===w.subject.id);
  expect(seen,'the listing transaction began before the deadline, which passed before the first ballot read').toEqual(CROSSED);
  expect(listed,'the subject is listed').toBeDefined();
  expect(listed?.accessChange).toBeNull();
});
