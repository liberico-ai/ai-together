import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {ZodError} from 'zod';
import {openWorld,propose,say,rows,snapshot,refusal,setProjectRole,applyFrozen,resetThrottle,BASIS,type World} from './doc-approval-fixtures';
import {approver,reviewer} from './slice3-fixtures';
import {docApprovalCode,type DocApprovalType} from '../src/server/access-grants';
import {DocApprovalProposalService} from '../src/server/doc-approval-proposals';
import {IdentityService,digest,secret} from '../src/server/identity';
import {ids} from '../src/server/identities';
import type {Principal,ProjectGrant} from '../src/server/types';

// Task 7c, Task 2: the proposer withdraws an own pending ballot (OQ-36 b, OQ-50 c, OQ-51 b, N3 of gate round 2) and the account admin cancels a
// coordinator ballot (OQ-36 d, OQ-49 a, OQ-51 b). W = withdraw, H = cancel. Synthetic data only; each case builds its own world (F5).
let w:World;
beforeEach(async()=>{w=await openWorld();});
afterEach(async()=>{await w.h.reset();await w.h.close();});

const S=ids.sales,T=ids.transport;
const SCOPE={code:'SCOPE_DENIED',status:404,message:'Không tìm thấy mục trong phạm vi được cấp.'};
const CLOSED={code:'APPROVAL_CLOSED',status:409,message:'Phiếu đã kết thúc hoặc hết hạn.'};
const ALREADY={code:'BALLOT_ALREADY_APPROVED',status:409,message:'Phiếu đã đủ xác nhận, không còn rút được ở đây. Nhờ quản trị tài khoản huỷ nếu cần.'};
const NOT_FOUND={code:'APPROVAL_NOT_FOUND',status:404,message:'Không tìm thấy phiếu duyệt.'};
const NOT_ALLOWED={code:'BALLOT_CANCEL_NOT_ALLOWED',status:403,message:'Lệnh huỷ chỉ áp cho phiếu do điều phối dự án trình.'};
const ADMIN_ONLY={code:'ACCOUNT_ADMIN_REQUIRED',status:403,message:'Cần quyền quản trị tài khoản.'};
const MANAGER={code:'MANAGER_REQUIRED',status:403,message:'Chỉ điều phối dự án được thực hiện thao tác này.'};
const PAIR_WAIT='Anh/chị chưa trình lại được cho người này: phiếu trước của anh/chị cho họ không được áp, và khoảng chờ 24 giờ sau phiếu đó chưa hết. Thử lại sau, hoặc nhờ quản trị tài khoản trình.';
const pairWait={code:'RATE_LIMITED',status:429,message:PAIR_WAIT};
const WITHDRAW_BASIS='Đã trình nhầm loại tài liệu, xin rút lại';
const CANCEL_BASIS='Huỷ phiếu trình chưa đúng của điều phối';
const g=(projectId:string,role:ProjectGrant['role'],...perms:string[]):ProjectGrant=>({projectId,role,reportPermissions:perms as ProjectGrant['reportPermissions']});
const dp=(t:DocApprovalType)=>docApprovalCode(t);
const seatPrincipal=(seat:number):Principal=>({id:w.approvers[seat].id,tenantId:ids.tenant,name:w.approvers[seat].seat,role:'viewer',projectIds:[S]});

const withdraw=(p:Principal,approvalId:string,input:Record<string,unknown>={reason:WITHDRAW_BASIS})=>w.proposals.withdraw(p,approvalId,input);
const stateOf=async(id:string)=>(await rows<{state:string}>(w,'SELECT state FROM identity.account_approvals WHERE id=$1',[id]))[0].state;
const versionOf=async(userId:string)=>(await rows<{v:number}>(w,'SELECT account_version v FROM identity.users WHERE id=$1',[userId]))[0].v;
const membershipsOf=(userId:string)=>rows(w,'SELECT project_id,project_role,report_permissions FROM identity.memberships WHERE user_id=$1 ORDER BY project_id',[userId]);
const votersOf=(id:string)=>rows(w,'SELECT seat,user_id FROM identity.account_approval_voters WHERE approval_id=$1 ORDER BY seat',[id]);
/** The closing events of one ballot, whatever closed it. */
const closings=(id:string)=>rows<{kind:string;actor_id:string;user_id:string;detail:Record<string,unknown>}>(w,
  "SELECT kind,actor_id,user_id,detail FROM identity.events WHERE kind IN ('access_change_withdrawn','access_change_cancelled') AND detail->>'approvalId'=$1",[id]);
type Cancelled={user:{id:string;version:number};invitation:unknown;cancelledApprovalId:string};
/** The admin's cancel command; the expected version is the account's current one unless `over` says otherwise. */
const cancel=async(approvalId:string,userId:string=w.subject.id,over:Record<string,unknown>={},p:Principal=w.admin)=>
  await w.accounts.command(p,{kind:'cancel_access_change',userId,expectedVersion:await versionOf(userId),reason:CANCEL_BASIS,approvalId,...over}) as unknown as Cancelled;
const pendingFor=async(seat:number)=>((await w.ballots.pendingForPrincipal(seatPrincipal(seat))) as {id:string}[]).map(r=>r.id);
/** Operational login: a further active, activated engineer of ids.sales. */
async function newMember(tag:string):Promise<string> {
  const id=randomUUID();
  await w.h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,$4,'engineer','fixture-hash')`,[id,ids.tenant,'da-w-'+tag,'Thành viên mẫu '+tag]);
  await w.h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'engineer')`,[ids.tenant,id,S]);
  return id;
}
/** A registration ballot through the admin's own path (synthetic applicant). */
async function registrationBallot():Promise<string> {
  const username='da-reg-'+randomUUID().slice(0,8);
  await w.identity.requestRegistration({username,name:'Người đăng ký mẫu',projectInterest:'Dự án mẫu',note:''});
  const request=(await w.accounts.pendingRegistrations(w.admin)).find(r=>r.username===username);
  if(!request) throw new Error('registration not found');
  const made=await w.accounts.registrationDecision(w.admin,{kind:'approve_registration',requestId:request.id,grants:[g(S,'engineer')],reason:'Đã kiểm danh tính người đăng ký mẫu'});
  return (made as {approvalId:string}).approvalId;
}
/** The admin's own access-change ballot for reviewer: a pure doc_approve:design addition, through the admin path. */
async function adminDocBallot():Promise<string> {
  const made=await w.accounts.command(w.admin,{kind:'propose_access_change',userId:reviewer.id,expectedVersion:await versionOf(reviewer.id),
    reason:'Quản trị trình phiếu thuần duyệt',grants:[g(S,'technical',dp('design'))]});
  return (made as {approvalId:string}).approvalId;
}
/** A live session and an unused Telegram pairing code for a person (W1, H1). */
async function sessionAndCode(userId:string) {
  const token=secret(),code=secret();
  await w.h.operator.query(`INSERT INTO identity.sessions(tenant_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')`,[ids.tenant,userId,digest(token)]);
  await w.h.operator.query(`INSERT INTO identity.telegram_codes(tenant_id,user_id,code_hash,expires_at) VALUES($1,$2,$3,now()+interval '5 minutes')`,[ids.tenant,userId,digest(code)]);
  const state=async()=>({
    session:await rows(w,'SELECT revoked_at FROM identity.sessions WHERE token_hash=$1',[digest(token)]),
    code:await rows(w,'SELECT consumed_at FROM identity.telegram_codes WHERE code_hash=$1',[digest(code)]),
    invitations:await rows(w,'SELECT id,consumed_at FROM identity.invitations WHERE user_id=$1 ORDER BY id',[userId]),
  });
  return {token,state};
}

describe('withdraw',()=>{
  test('OQ-36 the proposer withdraws the own pending ballot with a basis, and nothing else changes',async()=>{
    const {token,state}=await sessionAndCode(w.subject.id);
    const made=await propose(w,w.coordinator);
    const before={version:await versionOf(w.subject.id),memberships:await membershipsOf(w.subject.id),voters:await votersOf(made.approvalId),side:await state()};
    expect(before.side.session).toEqual([{revoked_at:null}]);expect(before.side.code).toEqual([{consumed_at:null}]);
    expect(await pendingFor(2)).toContain(made.approvalId);
    const outbox=(await snapshot(w)).outbox;
    expect(await withdraw(w.coordinator,made.approvalId)).toEqual({approvalId:made.approvalId,state:'withdrawn'});
    expect(await stateOf(made.approvalId)).toBe('expired');
    const events=await closings(made.approvalId);
    expect(events).toEqual([{kind:'access_change_withdrawn',actor_id:w.coordinator.id,user_id:w.subject.id,
      detail:{approvalId:made.approvalId,reason:WITHDRAW_BASIS,previousState:'pending',projectId:S}}]);
    expect(await versionOf(w.subject.id)).toBe(before.version);
    expect(await membershipsOf(w.subject.id)).toEqual(before.memberships);
    expect(await votersOf(made.approvalId)).toEqual(before.voters);
    expect(await state()).toEqual(before.side);
    expect((await w.identity.session(token)).id).toBe(w.subject.id);
    // the queued DMs are not taken back (T7C-16); the card is gone from the seat's list and a late vote is refused
    expect((await snapshot(w)).outbox).toBe(outbox);
    expect(await pendingFor(2)).not.toContain(made.approvalId);
    expect(await refusal(say(w,2,made.approvalId))).toEqual(CLOSED);
    expect(await rows(w,'SELECT 1 FROM identity.account_approval_votes WHERE approval_id=$1',[made.approvalId])).toHaveLength(0);
    expect(await w.proposals.listOwn(w.coordinator,{projectId:S})).toEqual([]);
  });

  // Decision OQ-51 (b) of the Chairman, 16/11/2026 (plan 0.2-0.3: a placeholder, not a settled rule). That the admin's cancel closes an
  // approved ballot is part of the option the Chairman chose, no longer a separate technical ruling of the session (note 2 of the coordinator).
  test('OQ-51 (b): a ballot a BoM seat has approved cannot be withdrawn by the proposer, and the admin\'s cancel still closes it',async()=>{
    const made=await propose(w,w.coordinator);
    await say(w,2,made.approvalId);
    expect(await stateOf(made.approvalId)).toBe('approved');
    const before=await snapshot(w);
    const votes=await rows(w,'SELECT voter_id,choice FROM identity.account_approval_votes WHERE approval_id=$1',[made.approvalId]);
    expect(await refusal(withdraw(w.coordinator,made.approvalId))).toEqual(ALREADY);
    expect(await stateOf(made.approvalId)).toBe('approved');
    expect(await rows(w,'SELECT voter_id,choice FROM identity.account_approval_votes WHERE approval_id=$1',[made.approvalId])).toEqual(votes);
    expect(await snapshot(w)).toEqual(before);
    const done=await cancel(made.approvalId);
    expect(done.cancelledApprovalId).toBe(made.approvalId);
    expect(await stateOf(made.approvalId)).toBe('expired');
    expect((await closings(made.approvalId)).map(e=>[e.kind,e.detail.previousState])).toEqual([['access_change_cancelled','approved']]);
    // the frozen grants of the cancelled ballot no longer apply (built here, not through applyFrozen, which needs an approved ballot)
    const frozen=(await rows<{grants:ProjectGrant[]}>(w,'SELECT grants FROM identity.account_approvals WHERE id=$1',[made.approvalId]))[0].grants;
    const memberships=await membershipsOf(w.subject.id);
    expect(await refusal(w.accounts.command(w.admin,{kind:'access',userId:w.subject.id,expectedVersion:await versionOf(w.subject.id),
      reason:'Áp đúng bộ quyền đã được duyệt',grants:frozen}))).toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED',status:409});
    expect(await membershipsOf(w.subject.id)).toEqual(memberships);
  });

  test('only the proposer withdraws: another manager of the project, the subject, an outsider and the account admin get the same 404',async()=>{
    const made=await propose(w,w.coordinator);
    const registration=await registrationBallot();
    const adminBallot=await adminDocBallot();
    const noAdmin=new DocApprovalProposalService(new IdentityService(w.h.operator,ids.tenant));
    const before=await snapshot(w);
    const answers=[
      await refusal(withdraw(w.coManager,made.approvalId)),
      await refusal(withdraw(w.subject,made.approvalId)),
      await refusal(withdraw(w.transportMember,made.approvalId)),
      await refusal(withdraw(w.admin,made.approvalId)),
      await refusal(withdraw(seatPrincipal(2),made.approvalId)),
      await refusal(withdraw(w.coordinator,randomUUID())),
      await refusal(withdraw(w.coordinator,registration)),
      await refusal(withdraw(w.coordinator,adminBallot)),
      // the admin's own pure doc_approve:* ballot, proposed through the admin path, cannot be withdrawn either (OQ-49 a)
      await refusal(withdraw(w.admin,adminBallot)),
      // R1: the account admin is not configured
      await refusal(noAdmin.withdraw(w.coordinator,made.approvalId,{reason:WITHDRAW_BASIS})),
    ];
    for(const [i,answer] of answers.entries()) expect(answer,String(i)).toEqual(SCOPE);
    expect(await stateOf(made.approvalId)).toBe('pending');
    expect(await stateOf(adminBallot)).toBe('pending');
    expect(await stateOf(registration)).toBe('pending');
    expect(await snapshot(w)).toEqual(before);
  });

  test('OQ-50 a proposer demoted but still a member of the project withdraws and lists the own ballots',async()=>{
    const first=await propose(w,w.coordinator);
    const second=await propose(w,w.coordinator,{userId:reviewer.id});
    await setProjectRole(w,w.coordinator.id,S,'engineer');
    expect((await w.proposals.listOwn(w.coordinator,{projectId:S})).map(x=>x.approvalId)).toEqual([first.approvalId,second.approvalId]);
    expect(await withdraw(w.coordinator,first.approvalId)).toEqual({approvalId:first.approvalId,state:'withdrawn'});
    // point D: «any role» read word for word, viewer included
    await setProjectRole(w,w.coordinator.id,S,'viewer');
    expect((await w.proposals.listOwn(w.coordinator,{projectId:S})).map(x=>x.approvalId)).toEqual([second.approvalId]);
    expect(await withdraw(w.coordinator,second.approvalId)).toEqual({approvalId:second.approvalId,state:'withdrawn'});
    expect(await stateOf(second.approvalId)).toBe('expired');
  });

  test('OQ-50 a proposer removed from the project can neither withdraw nor list, and gets the 404 of an unknown project',async()=>{
    const made=await propose(w,w.coordinator);
    await setProjectRole(w,w.coordinator.id,S,null);
    const before=await snapshot(w);
    const denied=await refusal(withdraw(w.coordinator,made.approvalId));
    expect(denied).toEqual(SCOPE);
    expect(denied).toEqual(await refusal(withdraw(w.coordinator,randomUUID())));
    const unlisted=await refusal(w.proposals.listOwn(w.coordinator,{projectId:S}));
    expect(unlisted).toEqual(SCOPE);
    expect(unlisted).toEqual(await refusal(w.proposals.listOwn(w.coordinator,{projectId:randomUUID()})));
    expect(await stateOf(made.approvalId)).toBe('pending');
    expect(await snapshot(w)).toEqual(before);
    // the admin's cancel still closes it
    expect((await cancel(made.approvalId)).cancelledApprovalId).toBe(made.approvalId);
    expect(await stateOf(made.approvalId)).toBe('expired');
    // a disabled proposer (the principal still in hand) is refused by both commands
    await setProjectRole(w,w.coordinator.id,S,'manager');
    const other=await propose(w,w.coordinator,{userId:reviewer.id});
    await w.h.operator.query('UPDATE identity.users SET active=false WHERE id=$1',[w.coordinator.id]);
    expect(await refusal(withdraw(w.coordinator,other.approvalId))).toEqual(SCOPE);
    expect(await refusal(w.proposals.listOwn(w.coordinator,{projectId:S}))).toEqual(SCOPE);
    expect(await stateOf(other.approvalId)).toBe('pending');
  });

  test('OQ-50 a demoted or removed proposer still cannot propose a new ballot',async()=>{
    await setProjectRole(w,w.coordinator.id,S,'engineer');
    let before=await snapshot(w);
    expect(await refusal(propose(w,w.coordinator,{userId:reviewer.id}))).toEqual(MANAGER);
    expect(await snapshot(w)).toEqual(before);
    await setProjectRole(w,w.coordinator.id,S,null);
    before=await snapshot(w);
    expect(await refusal(propose(w,w.coordinator,{userId:reviewer.id}))).toEqual(SCOPE);
    expect(await snapshot(w)).toEqual(before);
  });

  test('a closed ballot cannot be withdrawn, and a repeated withdrawal writes nothing',async()=>{
    const made=await propose(w,w.coordinator);
    await withdraw(w.coordinator,made.approvalId);
    let before=await snapshot(w);
    expect(await refusal(withdraw(w.coordinator,made.approvalId))).toEqual(CLOSED);
    expect(await closings(made.approvalId)).toHaveLength(1);
    expect(await snapshot(w)).toEqual(before);
    // rejected by the Chairman
    const rejected=await propose(w,w.coordinator,{userId:reviewer.id});
    await say(w,0,rejected.approvalId,'reject');
    expect(await stateOf(rejected.approvalId)).toBe('rejected');
    // issued
    const issued=await propose(w,w.coordinator,{userId:approver.id});
    await say(w,2,issued.approvalId);
    await applyFrozen(w,approver.id);
    expect(await stateOf(issued.approvalId)).toBe('issued');
    // pending past its deadline; approved past its deadline (the deadline is judged before the stage)
    const overdue=await propose(w,w.coordinator,{userId:await newMember('overdue')});
    const overdueApproved=await propose(w,w.coordinator,{userId:await newMember('overdue-approved')});
    await say(w,2,overdueApproved.approvalId);
    await w.h.operator.query("UPDATE identity.account_approvals SET expires_at=now()-interval '1 minute' WHERE id=ANY($1::uuid[])",[[overdue.approvalId,overdueApproved.approvalId]]);
    before=await snapshot(w);
    for(const id of [rejected.approvalId,issued.approvalId,overdue.approvalId,overdueApproved.approvalId])
      expect(await refusal(withdraw(w.coordinator,id)),id).toEqual(CLOSED);
    expect(await stateOf(overdue.approvalId)).toBe('pending');
    expect(await stateOf(overdueApproved.approvalId)).toBe('approved');
    expect(await snapshot(w)).toEqual(before);
  });

  test('the withdrawal command is strict, takes the ballot id from its argument only, and its basis is checked like every basis',async()=>{
    const made=await propose(w,w.coordinator);
    const other=await propose(w,w.coordinator,{userId:reviewer.id});
    const before=await snapshot(w);
    const bad=['  abcd  ','a'.repeat(501),...['\n','\u0000',' ',' ','‮','⁦','\uD800'].map(ch=>'Căn cứ hợp lệ'+ch+'tiếp theo'),
      'Căn cứ hợp lệ\n',' Căn cứ hợp lệ'];
    for(const reason of bad) await expect(withdraw(w.coordinator,made.approvalId,{reason}),JSON.stringify(reason)).rejects.toBeInstanceOf(ZodError);
    await expect(withdraw(w.coordinator,made.approvalId,{})).rejects.toBeInstanceOf(ZodError);
    for(const extra of [{approvalId:made.approvalId},{approvalId:other.approvalId},{proposerId:w.coManager.id},{userId:w.subject.id},
      {tenantId:ids.tenant},{state:'pending'},{expectedState:'pending'}])
      await expect(withdraw(w.coordinator,made.approvalId,{reason:WITHDRAW_BASIS,...extra}),Object.keys(extra)[0]).rejects.toBeInstanceOf(ZodError);
    // the id of the argument is judged before the body: not a uuid is the common 404, whatever the body holds
    const unknown=await refusal(withdraw(w.coordinator,randomUUID()));
    expect(unknown).toEqual(SCOPE);
    for(const id of ['x','',made.approvalId+'x']) {
      expect(await refusal(withdraw(w.coordinator,id)),JSON.stringify(id)).toEqual(unknown);
      expect(await refusal(withdraw(w.coordinator,id,{bogus:true})),JSON.stringify(id)).toEqual(unknown);
    }
    const missing=randomUUID();
    expect(await refusal(withdraw(w.coordinator,missing.toUpperCase()))).toEqual(await refusal(withdraw(w.coordinator,missing)));
    // the bot principal, a bot principal carrying the proposer's own id, and that id under another tenant (AR-06)
    for(const p of [{...w.coordinator,role:'bot' as const},{...w.coordinator,tenantId:ids.otherTenant}])
      expect(await refusal(withdraw(p,made.approvalId))).toEqual(SCOPE);
    expect(await stateOf(made.approvalId)).toBe('pending');expect(await stateOf(other.approvalId)).toBe('pending');
    expect(await snapshot(w)).toEqual(before);
    // 500 raw code points with one space at each end: accepted, and the event keeps the trimmed text; an upper-case id reaches the same ballot
    const padded=' '+'ạ'.repeat(498)+' ';
    expect(Array.from(padded).length).toBe(500);
    expect(await withdraw(w.coordinator,made.approvalId.toUpperCase(),{reason:padded})).toEqual({approvalId:made.approvalId,state:'withdrawn'});
    expect(await withdraw(w.coordinator,other.approvalId)).toEqual({approvalId:other.approvalId,state:'withdrawn'});
    const [event]=await closings(made.approvalId);
    expect(event.detail).toEqual({approvalId:made.approvalId,reason:'ạ'.repeat(498),previousState:'pending',projectId:S});
    // the lower-case id in the event is what P14 matches: the pair is exempt from the wait
    expect((await propose(w,w.coordinator)).state).toBe('pending');
  });

  test("OQ-48 after the proposer's own withdrawal the same member can be proposed again at once",async()=>{
    const first=await propose(w,w.coordinator);
    await withdraw(w.coordinator,first.approvalId);
    const again=await propose(w,w.coordinator);
    expect(again.approvalId).not.toBe(first.approvalId);
    expect(again).toMatchObject({state:'pending',replayed:false,userId:w.subject.id});
    expect(await stateOf(first.approvalId)).toBe('expired');
    expect((await votersOf(again.approvalId)).length).toBe(4);
    const dms=async(id:string)=>(await rows<{dedupe_key:string}>(w,'SELECT dedupe_key FROM outbox_messages WHERE dedupe_key LIKE $1',['account_approval.pending:'+id+':%'])).length;
    expect(await dms(again.approvalId)).toBe(4);expect(await dms(first.approvalId)).toBe(4);
    expect(await rows(w,"SELECT 1 FROM identity.events WHERE kind='access_change_proposed' AND detail->>'approvalId'=$1",[again.approvalId])).toHaveLength(1);
    // control: the new ballot is rejected by the Chairman; only a self-withdrawn ballot is exempt from the wait
    await say(w,0,again.approvalId,'reject');
    expect(await refusal(propose(w,w.coordinator))).toEqual(pairWait);
    // the hourly cap holds: propose-then-withdraw, the eleventh proposal within the hour is refused
    await resetThrottle(w);
    const member=await newMember('cap');
    for(let i=0;i<10;i++) {
      const made=await propose(w,w.coordinator,{userId:member});
      await withdraw(w.coordinator,made.approvalId);
    }
    expect(await refusal(propose(w,w.coordinator,{userId:member}))).toEqual({code:'RATE_LIMITED',status:429,message:'Thử lại sau ít phút.'});
  });

  test('OQ-50 a proposer who coordinates two projects and is demoted in one keeps the own ballot there and sees nothing of it from the other project',async()=>{
    // the fixture gives the coordinator the role viewer in ids.transport (F7): make them a manager there first
    await setProjectRole(w,w.coordinator.id,T,'manager');
    const made=await propose(w,w.coordinator);
    await setProjectRole(w,w.coordinator.id,S,'engineer');
    expect((await w.proposals.listOwn(w.coordinator,{projectId:S})).map(x=>x.approvalId)).toEqual([made.approvalId]);
    expect(await w.proposals.listOwn(w.coordinator,{projectId:T})).toEqual([]);
    expect(await refusal(propose(w,w.coordinator,{userId:reviewer.id}))).toEqual(MANAGER);
    await setProjectRole(w,w.coordinator.id,S,null);
    expect(await refusal(w.proposals.listOwn(w.coordinator,{projectId:S}))).toEqual(SCOPE);
    expect(await refusal(withdraw(w.coordinator,made.approvalId))).toEqual(SCOPE);
    expect(await w.proposals.listOwn(w.coordinator,{projectId:T})).toEqual([]);
    expect(await refusal(propose(w,w.coordinator,{userId:reviewer.id}))).toEqual(SCOPE);
    expect(await stateOf(made.approvalId)).toBe('pending');
    // a member of ids.sales again, as an engineer: the withdrawal goes through
    await setProjectRole(w,w.coordinator.id,S,'engineer');
    expect(await withdraw(w.coordinator,made.approvalId)).toEqual({approvalId:made.approvalId,state:'withdrawn'});
  });

  test('the membership guard refuses a document-approval code whose only ballot was withdrawn',async()=>{
    const made=await propose(w,w.coordinator);
    await withdraw(w.coordinator,made.approvalId);
    const grant=`UPDATE identity.memberships SET report_permissions=report_permissions||'{doc_approve:design}' WHERE user_id=$1 AND project_id=$2 RETURNING report_permissions`;
    const memberships=await membershipsOf(w.subject.id);
    await expect(w.h.operator.query(grant,[w.subject.id,S])).rejects.toThrow(/Document approval needs an approved access-change ballot that names it/);
    expect(await membershipsOf(w.subject.id)).toEqual(memberships);
    // control: with another ballot still approved and unexpired naming that code, the same statement passes (inside a transaction, rolled back)
    const live=await propose(w,w.coordinator);
    await say(w,2,live.approvalId);
    expect(await stateOf(live.approvalId)).toBe('approved');
    const rollback=new Error('rollback the control');
    await expect(w.h.operator.transaction(async tx=>{
      const changed=(await tx.query<{report_permissions:string[]}>(grant,[w.subject.id,S])).rows;
      expect(changed).toHaveLength(1);expect(changed[0].report_permissions).toContain(dp('design'));
      throw rollback;
    })).rejects.toBe(rollback);
    expect(await membershipsOf(w.subject.id)).toEqual(memberships);
  });

  test('a ballot already dead by an account change cannot be withdrawn, so a withdrawal cannot buy an immediate re-proposal',async()=>{
    const made=await propose(w,w.coordinator);
    // the admin bumps the subject's account version without touching the membership
    await w.accounts.command(w.admin,{kind:'revoke_sessions',userId:w.subject.id,expectedVersion:await versionOf(w.subject.id),reason:'Thu hồi phiên của thành viên mẫu'});
    const before=await snapshot(w);
    expect(await refusal(withdraw(w.coordinator,made.approvalId))).toEqual(CLOSED);
    expect(await stateOf(made.approvalId)).toBe('pending');                       // the refused command does not mark it
    expect(await closings(made.approvalId)).toEqual([]);
    expect(await w.proposals.listOwn(w.coordinator,{projectId:S})).toEqual([]);
    expect(await refusal(propose(w,w.coordinator))).toEqual(pairWait);
    expect(await snapshot(w)).toEqual(before);
    // a new world: a BoM seat approves, then the account changes; the version is judged before the stage
    await w.h.reset();await w.h.close();
    w=await openWorld();
    const approved=await propose(w,w.coordinator);
    await say(w,2,approved.approvalId);
    expect(await stateOf(approved.approvalId)).toBe('approved');
    await w.accounts.command(w.admin,{kind:'revoke_sessions',userId:w.subject.id,expectedVersion:await versionOf(w.subject.id),reason:'Thu hồi phiên của thành viên mẫu'});
    expect(await refusal(withdraw(w.coordinator,approved.approvalId))).toEqual(CLOSED);
    expect(await stateOf(approved.approvalId)).toBe('approved');
    expect(await closings(approved.approvalId)).toEqual([]);
  });
});

describe('cancel_access_change',()=>{
  test("OQ-36 the account admin cancels a coordinator ballot with a basis; the account version and the member's sessions do not change",async()=>{
    const {token,state}=await sessionAndCode(w.subject.id);
    const made=await propose(w,w.coordinator);
    const before={version:await versionOf(w.subject.id),memberships:await membershipsOf(w.subject.id),side:await state()};
    const done=await cancel(made.approvalId);
    expect(Object.keys(done).sort()).toEqual(['cancelledApprovalId','invitation','user']);
    expect(done.invitation).toBeUndefined();
    expect(done.cancelledApprovalId).toBe(made.approvalId);
    expect(done.user).toMatchObject({id:w.subject.id,version:before.version});
    expect(await stateOf(made.approvalId)).toBe('expired');
    expect(await closings(made.approvalId)).toEqual([{kind:'access_change_cancelled',actor_id:w.admin.id,user_id:w.subject.id,
      detail:{approvalId:made.approvalId,reason:CANCEL_BASIS,previousState:'pending',proposerId:w.coordinator.id,frozenVersion:before.version,accountVersion:before.version}}]);
    expect(await versionOf(w.subject.id)).toBe(before.version);
    expect(await membershipsOf(w.subject.id)).toEqual(before.memberships);
    expect(await state()).toEqual(before.side);
    expect((await w.identity.session(token)).id).toBe(w.subject.id);
    // the same for a ballot a BoM seat has approved
    const approved=await propose(w,w.coordinator,{userId:reviewer.id});
    await say(w,2,approved.approvalId);
    const reviewerVersion=await versionOf(reviewer.id);
    const second=await cancel(approved.approvalId,reviewer.id);
    expect(second.user).toMatchObject({id:reviewer.id,version:reviewerVersion});
    expect(await stateOf(approved.approvalId)).toBe('expired');
    expect((await closings(approved.approvalId)).map(e=>[e.kind,e.detail.previousState,e.detail.proposerId])).toEqual([['access_change_cancelled','approved',w.coordinator.id]]);
    expect(await versionOf(reviewer.id)).toBe(reviewerVersion);
  });

  test('OQ-48 after the cancel the admin proposes at once, and the proposer waits 24 hours from the cancel',async()=>{
    const made=await propose(w,w.coordinator);
    const adminPropose=async()=>w.accounts.command(w.admin,{kind:'propose_access_change',userId:w.subject.id,expectedVersion:await versionOf(w.subject.id),
      reason:'Quản trị trình cho thành viên mẫu',grants:[g(S,'engineer','quality_review')]});
    expect(await refusal(adminPropose())).toMatchObject({code:'APPROVAL_PENDING',status:409});
    await cancel(made.approvalId);
    const adminBallot=((await adminPropose()) as {approvalId:string}).approvalId;
    expect(await stateOf(adminBallot)).toBe('pending');
    // the operations login closes the admin's ballot
    await w.h.operator.query("UPDATE identity.account_approvals SET state='expired',updated_at=now() WHERE id=$1",[adminBallot]);
    expect(await refusal(propose(w,w.coordinator))).toEqual(pairWait);
    await w.h.operator.query("UPDATE identity.account_approvals SET updated_at=now()-interval '25 hours' WHERE id=$1",[made.approvalId]);
    expect((await propose(w,w.coordinator)).state).toBe('pending');
  });

  test('only the account admin cancels',async()=>{
    const made=await propose(w,w.coordinator);
    const before=await snapshot(w);
    for(const p of [w.coordinator,w.coManager,w.subject,seatPrincipal(2)])
      expect(await refusal(cancel(made.approvalId,w.subject.id,{},p)),p.name).toEqual(ADMIN_ONLY);
    expect(await stateOf(made.approvalId)).toBe('pending');
    expect(await snapshot(w)).toEqual(before);
  });

  test('OQ-49 the cancel command refuses a ballot the admin proposed',async()=>{
    // decision OQ-49 (a) of the Chairman, no longer a placeholder
    const adminBallot=await adminDocBallot();
    const registration=await registrationBallot();
    const before=await snapshot(w);
    expect(await refusal(cancel(adminBallot,reviewer.id))).toEqual(NOT_ALLOWED);
    expect(await stateOf(adminBallot)).toBe('pending');
    expect(await refusal(cancel(registration,w.subject.id))).toEqual(NOT_FOUND);
    expect(await stateOf(registration)).toBe('pending');
    expect(await snapshot(w)).toEqual(before);
  });

  test('the cancel names the ballot and the account version it saw',async()=>{
    const made=await propose(w,w.coordinator);
    const elsewhere=await propose(w,w.coordinator,{userId:reviewer.id});
    const rejected=await propose(w,w.coordinator,{userId:approver.id});
    await say(w,0,rejected.approvalId,'reject');
    const before=await snapshot(w);
    expect(await refusal(cancel(randomUUID()))).toEqual(NOT_FOUND);
    expect(await refusal(cancel(elsewhere.approvalId))).toEqual(NOT_FOUND);              // a ballot of another account
    expect(await refusal(cancel(made.approvalId,w.subject.id,{expectedVersion:(await versionOf(w.subject.id))+1})))
      .toEqual({code:'VERSION_CONFLICT',status:409,message:'Tài khoản đã thay đổi. Tải lại trước khi lưu.'});
    expect(await refusal(cancel(rejected.approvalId,approver.id))).toEqual(CLOSED);
    for(const over of [{reason:'abcd'},{reason:'  abcd  '},{proposerId:w.coordinator.id},{state:'expired'},{approvalId:undefined},{approvalId:'x'}])
      await expect(cancel(made.approvalId,w.subject.id,over),JSON.stringify(over)).rejects.toBeInstanceOf(ZodError);
    expect(await stateOf(made.approvalId)).toBe('pending');expect(await stateOf(elsewhere.approvalId)).toBe('pending');
    expect(await snapshot(w)).toEqual(before);
    // a cancelled ballot is closed: the second cancel writes nothing
    await cancel(made.approvalId);
    const once=await snapshot(w);
    expect(await refusal(cancel(made.approvalId))).toEqual(CLOSED);
    expect(await snapshot(w)).toEqual(once);
    // an upper-case ballot id reaches the same ballot
    expect((await cancel(elsewhere.approvalId.toUpperCase(),reviewer.id)).cancelledApprovalId).toBe(elsewhere.approvalId);
  });

  test('the version-bump lever of slice 2 still closes a coordinator ballot',async()=>{
    const made=await propose(w,w.coordinator);
    await w.accounts.command(w.admin,{kind:'revoke_sessions',userId:w.subject.id,expectedVersion:await versionOf(w.subject.id),reason:'Thu hồi phiên của thành viên mẫu'});
    const proposed=await w.accounts.command(w.admin,{kind:'propose_access_change',userId:w.subject.id,expectedVersion:await versionOf(w.subject.id),
      reason:'Quản trị trình cho thành viên mẫu',grants:[g(S,'engineer','quality_review')]}) as {approvalId:string};
    expect(await stateOf(made.approvalId)).toBe('expired');
    const event=(await rows<{detail:{expiredApprovalIds?:string[]}}>(w,"SELECT detail FROM identity.events WHERE kind='access_change_proposed' AND detail->>'approvalId'=$1",[proposed.approvalId]))[0];
    expect(event.detail.expiredApprovalIds).toEqual([made.approvalId]);
  });

  // The rule is decision OQ-48 (b); «counted from the cancel, not from the opening» is the Chairman's second decision of 16/11/2026
  // (plan 0.2-0.3: a reading awaiting the Chairman).
  test('OQ-48 a cancel at hour 25 of the ballot still makes the same coordinator wait 24 hours from the cancel',async()=>{
    const made=await propose(w,w.coordinator);
    await w.h.operator.query("UPDATE identity.account_approvals SET created_at=now()-interval '25 hours',expires_at=now()+interval '23 hours' WHERE id=$1",[made.approvalId]);
    await cancel(made.approvalId);
    const before=await snapshot(w);
    expect(await refusal(propose(w,w.coordinator))).toEqual(pairWait);
    expect(await snapshot(w)).toEqual(before);
    expect((await propose(w,w.coordinator,{userId:reviewer.id})).state).toBe('pending');
    const other=await propose(w,w.coManager);
    expect(other.state).toBe('pending');
    // the co-manager withdraws, so the member has no open ballot; the coordinator's own wait still runs from the cancel
    await withdraw(w.coManager,other.approvalId);
    expect(await refusal(propose(w,w.coordinator))).toEqual(pairWait);
    await w.h.operator.query("UPDATE identity.account_approvals SET updated_at=now()-interval '25 hours' WHERE id=$1",[made.approvalId]);
    expect((await propose(w,w.coordinator)).state).toBe('pending');
  });

  test('a ballot frozen at an older account version cannot be cancelled',async()=>{
    await w.h.operator.query("UPDATE identity.memberships SET report_permissions=ARRAY['people_read'] WHERE user_id=$1 AND project_id=$2",[w.subject.id,S]);
    const made=await propose(w,w.coordinator);
    // the admin removes another permission of the member: a narrowing needs no ballot and bumps the version
    await w.accounts.command(w.admin,{kind:'access',userId:w.subject.id,expectedVersion:await versionOf(w.subject.id),reason:'Bớt quyền xem người của thành viên mẫu',grants:[g(S,'engineer')]});
    expect(await versionOf(w.subject.id)).toBe(2);
    const before=await snapshot(w);
    expect(await refusal(cancel(made.approvalId))).toEqual(NOT_FOUND);
    expect(await stateOf(made.approvalId)).toBe('pending');
    expect(await snapshot(w)).toEqual(before);
  });
});
