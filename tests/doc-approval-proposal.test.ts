import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {ZodError} from 'zod';
import {openWorld,propose,say,rows,snapshot,refusal,setProjectRole,applyFrozen,resetThrottle,identityOn,failingStatement,beforeStatementInTx,bridgeCall,BASIS,type World} from './doc-approval-fixtures';
import {sameBuProject} from './slice1-fixtures';
import {approver,reviewer,grantDocApproval} from './slice3-fixtures';
import {docApprovalDelta,DOC_APPROVAL_TYPES,docApprovalCode} from '../src/server/access-grants';
import {DocApprovalProposalService,reasonPrefix} from '../src/server/doc-approval-proposals';
import {IdentityService,digest} from '../src/server/identity';
import {AppError} from '../src/server/errors';
import {ids} from '../src/server/identities';
import type {Principal,ProjectGrant} from '../src/server/types';

// Task 7c, Task 1a: a project coordinator (role manager) proposes a document-approval ballot for a member of the own project.
// Synthetic data only. Each case builds its own world (F5).
let w:World;
beforeEach(async()=>{w=await openWorld();});
afterEach(async()=>{await w.h.reset();await w.h.close();});

const S=ids.sales,T=ids.transport;
const SCOPE='Không tìm thấy mục trong phạm vi được cấp.';
const MANAGER='Chỉ điều phối dự án được thực hiện thao tác này.';
const SELF='Không tự trình phiếu cấp quyền duyệt cho chính mình.';
const ADMIN='Quản trị tài khoản trình phiếu ở trang Quản trị tài khoản.';
const INELIGIBLE='Người được đề xuất phải là thành viên đang hoạt động của dự án.';
const NOT_READY='Chưa đủ người bỏ phiếu khi không tính người trình. Nhờ quản trị tài khoản kiểm tra danh sách người duyệt hoặc trình thay.';
const CONFLICT='Quyền duyệt của người này đã đổi. Tải lại trước khi trình.';
const PENDING='Người này đang có một phiếu đổi quyền chưa xong.';
const PAIR_WAIT='Anh/chị chưa trình lại được cho người này: phiếu trước của anh/chị cho họ không được áp, và khoảng chờ 24 giờ sau phiếu đó chưa hết. Thử lại sau, hoặc nhờ quản trị tài khoản trình.';
const ineligible={code:'DOC_APPROVAL_PROPOSAL_INVALID',status:422,message:INELIGIBLE};
const g=(projectId:string,role:ProjectGrant['role'],...perms:string[]):ProjectGrant=>({projectId,role,reportPermissions:perms as ProjectGrant['reportPermissions']});
const dp=(t:string)=>docApprovalCode(t as typeof DOC_APPROVAL_TYPES[number]);
const seatPrincipal=(w:World,seat:number):Principal=>({id:w.approvers[seat].id,tenantId:ids.tenant,name:w.approvers[seat].seat,role:'viewer',projectIds:[S]});
/** Operational login: a further active, activated engineer of ids.sales. */
async function newMember(tag:string):Promise<string> {
  const id=randomUUID();
  await w.h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,$4,'engineer','fixture-hash')`,[id,ids.tenant,'da-m-'+tag,'Thành viên mẫu '+tag]);
  await w.h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'engineer')`,[ids.tenant,id,S]);
  return id;
}
const ballotRow=async(id:string)=>(await rows<Record<string,unknown>>(w,'SELECT * FROM identity.account_approvals WHERE id=$1',[id]))[0];
const membershipsOf=(userId:string)=>rows(w,'SELECT project_id,project_role,report_permissions FROM identity.memberships WHERE user_id=$1 ORDER BY project_id',[userId]);
const attempts=async(p:Principal)=>Number((await rows<{n:number}>(w,'SELECT coalesce(max(attempts),0) AS n FROM identity.throttle WHERE bucket=$1',[digest('doc-approval-proposal:'+p.id)]))[0].n);

describe('docApprovalDelta',()=>{
  test('docApprovalDelta accepts only added doc_approve codes on one existing project',()=>{
    const A=ids.sales,B=ids.transport;
    const base=[g(A,'engineer'),g(B,'viewer','people_read')];
    // ok: one or several codes at one project, listed in DOC_APPROVAL_TYPES order whatever the input order
    expect(docApprovalDelta(base,[g(A,'engineer',dp('design')),g(B,'viewer','people_read')])).toEqual({projectId:A,added:['design']});
    expect(docApprovalDelta(base,[g(A,'engineer',dp('plan'),dp('design')),g(B,'viewer','people_read')])).toEqual({projectId:A,added:['design','plan']});
    // order of entries and of permissions does not matter
    expect(docApprovalDelta(base,[g(B,'viewer','people_read'),g(A,'engineer',dp('design'))])).toEqual({projectId:A,added:['design']});
    expect(docApprovalDelta([g(A,'engineer','quality_review','people_read')],[g(A,'engineer','people_read',dp('plan'),'quality_review')])).toEqual({projectId:A,added:['plan']});
    // null: codes at two projects, a new project, a dropped project, a changed role, a new report permission, a removed code, no change, mixed change
    expect(docApprovalDelta(base,[g(A,'engineer',dp('design')),g(B,'viewer','people_read',dp('plan'))])).toBeNull();
    expect(docApprovalDelta(base,[...base,g(sameBuProject,'engineer',dp('design'))])).toBeNull();
    expect(docApprovalDelta(base,[g(A,'engineer',dp('design'))])).toBeNull();
    expect(docApprovalDelta(base,[g(A,'manager',dp('design')),g(B,'viewer','people_read')])).toBeNull();
    expect(docApprovalDelta(base,[g(A,'engineer',dp('design'),'quality_review'),g(B,'viewer','people_read')])).toBeNull();
    expect(docApprovalDelta([g(A,'engineer',dp('design'))],[g(A,'engineer')])).toBeNull();
    expect(docApprovalDelta([g(A,'engineer',dp('design'))],[g(A,'engineer',dp('plan'))])).toBeNull();
    expect(docApprovalDelta(base,base)).toBeNull();
    expect(docApprovalDelta([g(A,'engineer','quality_review')],[g(A,'engineer',dp('design'))])).toBeNull();
    // R9, T7C-26: a repeated code makes no difference
    expect(docApprovalDelta([g(A,'engineer','people_read','people_read')],[g(A,'engineer','people_read','people_read')])).toBeNull();
    expect(docApprovalDelta([g(A,'engineer',dp('design'))],[g(A,'engineer',dp('design'),dp('design'))])).toBeNull();
    expect(docApprovalDelta([g(A,'engineer',dp('design'),dp('design'))],[g(A,'engineer',dp('design'),dp('design'),dp('plan'),dp('plan'))])).toEqual({projectId:A,added:['plan']});
  });
});

describe('propose',()=>{
  test('a project manager proposes document approval for a member of the own project, and the ballot is an ordinary access-change ballot',async()=>{
    const before=await membershipsOf(w.subject.id);
    const result=await propose(w,w.coordinator);
    expect(result).toEqual({approvalId:expect.any(String),projectId:S,userId:w.subject.id,addedTypes:['design'],state:'pending',expiresAt:expect.any(String),replayed:false});
    const all=await rows<Record<string,unknown>>(w,'SELECT * FROM identity.account_approvals');
    expect(all).toHaveLength(1);
    const row=all[0];
    expect(row).toMatchObject({kind:'access_change',proposer_id:w.coordinator.id,state:'pending',subject_user_id:w.subject.id,id:result.approvalId});
    expect(Number((await rows<{s:string}>(w,'SELECT extract(epoch FROM expires_at-created_at) AS s FROM identity.account_approvals'))[0].s)).toBe(172800);
    expect(docApprovalDelta(row.previous_grants as ProjectGrant[],row.grants as ProjectGrant[])).toEqual({projectId:S,added:['design']});
    expect(await membershipsOf(w.subject.id)).toEqual(before);
    expect((await rows<{v:number}>(w,'SELECT account_version v FROM identity.users WHERE id=$1',[w.subject.id]))[0].v).toBe(1);
    expect(new Date(result.expiresAt).getTime()).toBe(new Date(row.expires_at as string).getTime());
  });

  test("the ballot row equals an admin ballot for the same change in every column but id, proposer, reason and time",async()=>{
    const a=await propose(w,w.coordinator);
    const rowA=await ballotRow(a.approvalId);
    const votersA=await rows<{seat:string;user_id:string}>(w,'SELECT seat,user_id FROM identity.account_approval_voters WHERE approval_id=$1 ORDER BY seat',[a.approvalId]);
    await w.h.operator.query("UPDATE identity.account_approvals SET state='expired' WHERE id=$1",[a.approvalId]);
    const listed=(await w.accounts.list(w.admin)).find(r=>r.id===w.subject.id)!;
    const proposed=await w.accounts.command(w.admin,{kind:'propose_access_change',userId:w.subject.id,expectedVersion:listed.version,reason:'Quản trị trình cùng thay đổi',grants:rowA.grants});
    const b=(proposed as {approvalId:string}).approvalId;
    const rowB=await ballotRow(b);
    for(const col of ['kind','subject_user_id','subject_account_version','previous_grants','grants','state']) expect(rowB[col],col).toEqual(rowA[col]);
    expect(rowB.proposer_id).toBe(w.admin.id);
    const span=async(id:string)=>Number((await rows<{s:string}>(w,'SELECT extract(epoch FROM expires_at-created_at) AS s FROM identity.account_approvals WHERE id=$1',[id]))[0].s);
    expect(await span(b)).toBe(await span(a.approvalId));
    const votersB=await rows<{seat:string;user_id:string}>(w,'SELECT seat,user_id FROM identity.account_approval_voters WHERE approval_id=$1 ORDER BY seat',[b]);
    expect(votersB).toEqual(votersA);
    expect(votersA.map(v=>v.seat)).toEqual(['bom_chu','bom_phuong','bom_quan','chairman']);
  });

  test("the direct message for a coordinator ballot equals the admin path's",async()=>{
    const a=await propose(w,w.coordinator);
    const rowA=await ballotRow(a.approvalId);
    await w.h.operator.query("UPDATE identity.account_approvals SET state='expired' WHERE id=$1",[a.approvalId]);
    const listed=(await w.accounts.list(w.admin)).find(r=>r.id===w.subject.id)!;
    const b=((await w.accounts.command(w.admin,{kind:'propose_access_change',userId:w.subject.id,expectedVersion:listed.version,reason:'Quản trị trình cùng thay đổi',grants:rowA.grants})) as {approvalId:string}).approvalId;
    const dms=(id:string)=>rows<Record<string,unknown>>(w,`SELECT template,payload,audience,recipient_user_id,target_chat_id,dedupe_key FROM outbox_messages
     WHERE dedupe_key LIKE $1 ORDER BY recipient_user_id`,['account_approval.pending:'+id+':%']);
    const [da,db]=[await dms(a.approvalId),await dms(b)];
    expect(da).toHaveLength(4);expect(db).toHaveLength(4);
    for(const [i,row] of da.entries()) {
      expect(row).toMatchObject({template:'account_approval.pending',audience:'dm',payload:{params:{}},recipient_user_id:db[i].recipient_user_id,target_chat_id:db[i].target_chat_id});
      expect(row.dedupe_key).toBe(`account_approval.pending:${a.approvalId}:${row.recipient_user_id}`);
      const text=JSON.stringify(row.payload);
      expect(text).not.toContain(a.approvalId);expect(text).not.toContain('doc_approve');expect(text).not.toContain(w.coordinator.name);
    }
  });

  test("same tally, same deadline: one BoM agreeing approves, the Chairman alone does not, the Chairman's rejection closes",async()=>{
    const one=await propose(w,w.coordinator);
    const two=await propose(w,w.coordinator,{userId:reviewer.id});
    const three=await propose(w,w.coordinator,{userId:approver.id});
    await say(w,0,one.approvalId);                       // Chairman alone
    expect((await ballotRow(one.approvalId)).state).toBe('pending');
    await say(w,2,two.approvalId);                       // one BoM seat
    expect((await ballotRow(two.approvalId)).state).toBe('approved');
    await say(w,0,three.approvalId,'reject');            // the Chairman rejects
    expect((await ballotRow(three.approvalId)).state).toBe('rejected');
    await w.h.operator.query("UPDATE identity.account_approvals SET expires_at=now()-interval '1 hour' WHERE id=$1",[one.approvalId]);
    expect(await refusal(say(w,1,one.approvalId))).toMatchObject({code:'APPROVAL_CLOSED',status:409});
  });

  test("OQ-35 a proposer who holds a BoM seat is not a voter of the own ballot and cannot vote on it",async()=>{
    const made=await propose(w,w.seatCoordinator);
    const voters=await rows<{seat:string}>(w,'SELECT seat FROM identity.account_approval_voters WHERE approval_id=$1 ORDER BY seat',[made.approvalId]);
    expect(voters.map(v=>v.seat)).toEqual(['bom_phuong','bom_quan','chairman']);
    expect((await w.ballots.pendingForPrincipal(w.seatCoordinator)).some((r:{id?:string})=>r.id===made.approvalId)).toBe(false);
    expect(await refusal(w.ballots.voteForPrincipal(w.seatCoordinator,made.approvalId,'agree'))).toMatchObject({code:'APPROVER_REQUIRED',status:403});
    expect(await rows(w,'SELECT 1 FROM identity.account_approval_votes WHERE approval_id=$1',[made.approvalId])).toHaveLength(0);
    await say(w,2,made.approvalId);
    expect((await ballotRow(made.approvalId)).state).toBe('approved');
    await applyFrozen(w,w.subject.id);
    expect((await ballotRow(made.approvalId)).state).toBe('issued');
  });

  test('OQ-35 when the proposer is the only BoM seat able to vote, no ballot opens and the answer is the same for every subject',async()=>{
    await w.h.operator.query('DELETE FROM identity.telegram_links WHERE user_id=ANY($1::uuid[])',[[w.approvers[2].id,w.approvers[3].id]]);
    const before=await snapshot(w);
    const results=[await refusal(propose(w,w.seatCoordinator)),await refusal(propose(w,w.seatCoordinator,{userId:w.transportMember.id})),
      await refusal(propose(w,w.seatCoordinator,{userId:randomUUID()}))];
    expect(results[0]).toEqual({code:'APPROVERS_NOT_READY',status:409,message:NOT_READY});
    expect(results[1]).toEqual(results[0]);expect(results[2]).toEqual(results[0]);
    expect(await snapshot(w)).toEqual(before);
  });

  test("OQ-35 when removing the proposer's and the subject's seats leaves no BoM seat, no ballot opens and the answer does not tell who holds a seat",async()=>{
    await w.h.operator.query('DELETE FROM identity.telegram_links WHERE user_id=$1',[w.approvers[3].id]);
    await setProjectRole(w,w.approvers[2].id,S,'engineer');
    const before=await snapshot(w);
    const seatSubject=await refusal(propose(w,w.seatCoordinator,{userId:w.approvers[2].id}));
    const other=await refusal(propose(w,w.seatCoordinator,{userId:w.transportMember.id}));
    expect(seatSubject).toEqual(ineligible);expect(seatSubject).toEqual(other);
    expect(await snapshot(w)).toEqual(before);
    expect(JSON.stringify(seatSubject)).not.toMatch(/ghế|BoM|Telegram/);
  });

  test('a subject who holds the only other BoM seat gets the same answer as any ineligible member',async()=>{
    await w.h.operator.query('DELETE FROM identity.telegram_links WHERE user_id=ANY($1::uuid[])',[[w.approvers[1].id,w.approvers[3].id]]);
    await setProjectRole(w,w.approvers[2].id,S,'engineer');
    const seatSubject=await refusal(propose(w,w.coordinator,{userId:w.approvers[2].id}));
    expect(seatSubject).toEqual(ineligible);
    expect(seatSubject).toEqual(await refusal(propose(w,w.coordinator,{userId:w.transportMember.id})));
    await w.h.operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3)',[ids.tenant,w.approvers[3].id,w.approvers[3].telegram]);
    const made=await propose(w,w.coordinator,{userId:w.approvers[2].id});
    const voters=await rows<{user_id:string}>(w,'SELECT user_id FROM identity.account_approval_voters WHERE approval_id=$1',[made.approvalId]);
    expect(voters.length).toBeGreaterThan(0);
    expect(voters.some(v=>v.user_id===w.approvers[2].id)).toBe(false);
  });

  test('an approved ballot changes nothing until the account admin applies it, and the proposer cannot apply',async()=>{
    const made=await propose(w,w.coordinator);
    await say(w,2,made.approvalId);
    expect((await ballotRow(made.approvalId)).state).toBe('approved');
    const perms=async()=>(await membershipsOf(w.subject.id)).flatMap(m=>m.report_permissions as string[]);
    expect(await perms()).not.toContain(dp('design'));
    expect(await refusal(w.accounts.command(w.coordinator,{kind:'access',userId:w.subject.id,expectedVersion:1,reason:'Áp thử bằng điều phối',
      grants:[g(S,'engineer',dp('design'))]}))).toMatchObject({code:'ACCOUNT_ADMIN_REQUIRED'});
    expect(await refusal(applyFrozen(w,w.subject.id,{grants:[g(S,'engineer',dp('design'),dp('plan'))]}))).toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
    expect(await perms()).not.toContain(dp('design'));
    await applyFrozen(w,w.subject.id);
    expect(await perms()).toContain(dp('design'));
    expect((await ballotRow(made.approvalId)).state).toBe('issued');
  });

  test('a manager of project A cannot propose for a member of project B',async()=>{
    const before=await snapshot(w);
    const denied=await refusal(propose(w,w.coManager,{projectId:T,userId:w.transportMember.id}));
    expect(denied).toEqual({code:'SCOPE_DENIED',status:404,message:SCOPE});
    expect(denied).toEqual(await refusal(propose(w,w.coManager,{projectId:randomUUID(),userId:w.transportMember.id})));
    expect(await refusal(propose(w,w.coordinator,{projectId:T,userId:w.transportMember.id}))).toEqual({code:'MANAGER_REQUIRED',status:403,message:MANAGER});
    expect(await snapshot(w)).toEqual(before);
  });

  test('a proposal for someone who is not an eligible member is refused with one sentence',async()=>{
    await w.h.operator.query('UPDATE identity.users SET active=false WHERE id=$1',[reviewer.id]);
    await w.h.operator.query('UPDATE identity.users SET password_hash=NULL WHERE id=$1',[approver.id]);
    await w.h.operator.query("INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'engineer')",[ids.tenant,w.subject.id,sameBuProject]);
    // a real, active, activated account of ANOTHER tenant (synthetic): tenant isolation on the subject (AR-06, Quality Gate 34a-34d)
    const foreign=randomUUID();
    await w.h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'da-foreign','Tài khoản tenant khác mẫu','engineer','fixture-hash')`,[foreign,ids.otherTenant]);
    await w.h.operator.query("INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'engineer')",[ids.otherTenant,foreign,ids.otherProject]);
    const before=await snapshot(w);
    const targets=[w.transportMember.id,w.approvers[2].id,reviewer.id,approver.id,randomUUID(),w.admin.id,w.subject.id,foreign];
    const answers=[];
    for(const userId of targets) answers.push(await refusal(propose(w,w.coordinator,{userId})));
    expect(answers[0]).toEqual(ineligible);
    for(const answer of answers) expect(answer).toEqual(answers[0]);
    expect(await snapshot(w)).toEqual(before);
  });

  test('a proposer whose account is disabled or not activated is refused',async()=>{
    await w.h.operator.query('UPDATE identity.users SET active=false WHERE id=$1',[w.coordinator.id]);
    await w.h.operator.query('UPDATE identity.users SET password_hash=NULL WHERE id=$1',[w.coManager.id]);
    const before=await snapshot(w);
    expect(await refusal(propose(w,w.coordinator))).toMatchObject({code:'SCOPE_DENIED',status:404});
    expect(await refusal(propose(w,w.coManager))).toMatchObject({code:'SCOPE_DENIED',status:404});
    expect(await snapshot(w)).toEqual(before);
  });

  test('the account admin cannot use the coordinator path, and is told where to go',async()=>{
    const before=await snapshot(w),throttle=await rows(w,'SELECT * FROM identity.throttle');
    expect(await refusal(propose(w,w.admin))).toEqual({code:'DOC_APPROVAL_PROPOSAL_INVALID',status:422,message:ADMIN});
    expect(await snapshot(w)).toEqual(before);
    expect(await rows(w,'SELECT * FROM identity.throttle')).toEqual(throttle);
  });

  test('OQ-38 a co-manager of the same project can be proposed, and the ballot says so to the voters',async()=>{
    const made=await propose(w,w.coordinator,{userId:w.coManager.id});
    const expected=`${w.coordinator.name} (điều phối dự án) trình; người được cấp cũng là điều phối của dự án đó: ${BASIS}`;
    expect((await ballotRow(made.approvalId)).reason).toBe(expected);
    const seen=(await w.ballots.pendingForPrincipal(seatPrincipal(w,2))) as {id:string;reason:string}[];
    expect(seen.find(r=>r.id===made.approvalId)?.reason).toBe(expected);
    const event=async(id:string)=>(await rows<{detail:{subjectIsCoordinator:boolean}}>(w,"SELECT detail FROM identity.events WHERE kind='access_change_proposed' AND detail->>'approvalId'=$1",[id]))[0].detail;
    expect((await event(made.approvalId)).subjectIsCoordinator).toBe(true);
    // a manager of ids.transport who is only a technical of ids.sales is not a coordinator of the project asked about
    await setProjectRole(w,reviewer.id,T,'manager');
    const plain=await propose(w,w.coordinator,{userId:reviewer.id});
    expect((await ballotRow(plain.approvalId)).reason).toBe(`${w.coordinator.name} (điều phối dự án) trình: ${BASIS}`);
    expect((await event(plain.approvalId)).subjectIsCoordinator).toBe(false);
  });

  test('voters see who proposed',async()=>{
    const made=await propose(w,w.coordinator);
    const seen=(await w.ballots.pendingForPrincipal(seatPrincipal(w,2))) as {id:string;reason:string}[];
    expect(seen.find(r=>r.id===made.approvalId)?.reason).toBe(`${w.coordinator.name} (điều phối dự án) trình: ${BASIS}`);
  });

  test("the proposer's role is read from the database, not from the session",async()=>{
    await setProjectRole(w,w.coordinator.id,S,'engineer');
    expect(await refusal(propose(w,w.coordinator))).toMatchObject({code:'MANAGER_REQUIRED',status:403});
    await setProjectRole(w,w.coordinator.id,S,null);
    expect(await refusal(propose(w,w.coordinator))).toMatchObject({code:'SCOPE_DENIED',status:404});
    await setProjectRole(w,w.coordinator.id,S,'manager');
    expect(await refusal(propose(w,{...w.coordinator,role:'bot'}))).toMatchObject({code:'SCOPE_DENIED',status:404});
    // the aggregate role of a multi-project principal is 'viewer'; the database says manager of ids.sales
    expect(w.coordinator.role).toBe('viewer');
    await propose(w,w.coordinator);
    // the session says engineer, the database says manager
    const stale:Principal={...w.coManager,role:'engineer',grants:[{projectId:S,role:'engineer',reportPermissions:[]}]};
    await propose(w,stale,{userId:reviewer.id});
  });

  test("the subject's grants must fit the grant schema before anything is frozen",async()=>{
    const projects=Array.from({length:30},()=>randomUUID());
    for(const [i,id] of projects.entries()) await w.h.operator.query('INSERT INTO projects(id,tenant_id,name,bu) VALUES($1,$2,$3,$4)',[id,ids.tenant,'Dự án tổng hợp '+i,'BU tổng hợp']);
    for(const id of projects) for(const user of [w.admin.id,w.subject.id]) await w.h.operator.query(
      "INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'engineer')",[ids.tenant,user,id]);
    const before=await snapshot(w);
    expect(await refusal(propose(w,w.coordinator))).toEqual(ineligible);
    expect(await snapshot(w)).toEqual(before);
    await w.h.operator.query('DELETE FROM identity.memberships WHERE user_id=$1 AND project_id=$2',[w.subject.id,projects[0]]);
    const opened=await propose(w,w.coordinator);
    expect(opened.state).toBe('pending');
  });

  test('the answer and the list reveal nothing outside the project',async()=>{
    await w.h.operator.query("INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role,report_permissions) VALUES($1,$2,$3,'engineer',ARRAY['people_read'])",[ids.tenant,w.subject.id,T]);
    const made=await propose(w,w.coordinator);
    const listed=await w.proposals.listOwn(w.coordinator,{projectId:S});
    for(const text of [JSON.stringify(made),JSON.stringify(listed)]) {
      expect(text).not.toContain(T);expect(text).not.toContain('people_read');expect(text).not.toContain('slice3-member');expect(text).not.toContain('account_version');
    }
    const row=await ballotRow(made.approvalId);
    const entry=(list:ProjectGrant[])=>list.find(x=>x.projectId===T);
    expect(entry(row.grants as ProjectGrant[])).toEqual(g(T,'engineer','people_read'));
    expect(entry(row.previous_grants as ProjectGrant[])).toEqual(g(T,'engineer','people_read'));
  });

  test('the command cannot express any other widening, and input edges',async()=>{
    for(const extra of [{grants:[]},{role:'manager'},{reportPermissions:['people_read']},{projectIds:[S]},{proposerId:w.admin.id},{tenantId:ids.tenant}])
      await expect(propose(w,w.coordinator,extra)).rejects.toBeInstanceOf(ZodError);
    for(const docTypes of [[],['people_read'],['doc_approve:design'],['bogus'],['design','design']])
      await expect(propose(w,w.coordinator,{docTypes})).rejects.toBeInstanceOf(ZodError);
    await expect(propose(w,w.coordinator,{expectedTypes:['plan','plan']})).rejects.toBeInstanceOf(ZodError);
    await expect(propose(w,w.coordinator,{reason:'  abcd  '})).rejects.toBeInstanceOf(ZodError);
    await expect(propose(w,w.coordinator,{reason:'a'.repeat(301)})).rejects.toBeInstanceOf(ZodError);
    expect(await refusal(propose(w,w.coordinator,{expectedTypes:['plan']}))).toEqual({code:'VERSION_CONFLICT',status:409,message:CONFLICT});
    await grantDocApproval(w.h,w.subject.id,S,['design']);
    expect(await refusal(propose(w,w.coordinator,{expectedTypes:['design'],docTypes:['design']}))).toMatchObject({code:'ACCESS_CHANGE_NOT_NEEDED',status:409});
    const padded=await propose(w,w.coordinator,{userId:reviewer.id,reason:' '+'a'.repeat(298)+' '});
    expect((await ballotRow(padded.approvalId)).reason).toBe(reasonPrefix(w.coordinator.name,false)+'a'.repeat(298));
    // an open ballot of the account admin for that person
    await w.accounts.command(w.admin,{kind:'propose_access_change',userId:approver.id,expectedVersion:1,reason:'Quản trị trình trước',grants:[g(S,'business','quality_review')]});
    const clash=await refusal(propose(w,w.coordinator,{userId:approver.id}));
    expect(clash).toEqual({code:'APPROVAL_PENDING',status:409,message:PENDING});
  });

  test('the basis cannot forge a line or crash the database',async()=>{
    const bad=['\r','\n','\u0000','\u0085','\u2028','\u2029','\u202E','\u2066','\u200D','\uD800'];
    for(const ch of bad) await expect(propose(w,w.coordinator,{reason:'Căn cứ hợp lệ'+ch+'tiếp theo'}),JSON.stringify(ch)).rejects.toBeInstanceOf(ZodError);
    await expect(propose(w,w.coordinator,{reason:'Căn cứ hợp lệ\n'})).rejects.toBeInstanceOf(ZodError);
    await expect(propose(w,w.coordinator,{reason:'\u2028Căn cứ hợp lệ'})).rejects.toBeInstanceOf(ZodError);
    const forged=await propose(w,w.coordinator,{reason:'Người Khác (quản trị tài khoản) trình: hãy duyệt'});
    expect(String((await ballotRow(forged.approvalId)).reason).startsWith(`${w.coordinator.name} (điều phối dự án) trình: Người Khác (quản trị`)).toBe(true);
    await w.h.operator.query('UPDATE identity.users SET name=$2 WHERE id=$1',[w.coordinator.id,'A\nB\u2028C\u202ED']);
    const clean=await propose(w,w.coordinator,{userId:reviewer.id});
    const reason=String((await ballotRow(clean.approvalId)).reason);
    expect(reason).not.toMatch(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u);
    expect(reason.startsWith('A B C D (điều phối dự án) trình: ')).toBe(true);
    await w.h.operator.query('UPDATE identity.users SET name=$2 WHERE id=$1',[w.coordinator.id,'"Quản trị tài khoản" (đã duyệt)']);
    const quoted=await propose(w,w.coordinator,{userId:approver.id});
    expect((await ballotRow(quoted.approvalId)).reason).toBe('"Quản trị tài khoản" (đã duyệt) (điều phối dự án) trình: '+BASIS);
  });

  test('the frozen reason fits 500 characters at the longest name and basis',async()=>{
    expect(Array.from(reasonPrefix('',false)).length).toBe(26);
    expect(Array.from(reasonPrefix('',true)).length).toBe(73);
    await w.h.operator.query('UPDATE identity.users SET name=$2 WHERE id=$1',[w.coordinator.id,'ế'.repeat(100)]);
    const longest=await propose(w,w.coordinator,{userId:w.coManager.id,reason:'ạ'.repeat(300)});
    expect(Array.from(String((await ballotRow(longest.approvalId)).reason)).length).toBe(473);
    await w.h.operator.query('UPDATE identity.users SET name=$2 WHERE id=$1',[w.coordinator.id,'ế'.repeat(150)]);
    const cut=await propose(w,w.coordinator,{userId:reviewer.id});
    const reason=String((await ballotRow(cut.approvalId)).reason);
    expect(reason.startsWith('ế'.repeat(100)+' (điều')).toBe(true);
  });

  test('a manager cannot propose for themself, in any letter case',async()=>{
    const before=await snapshot(w);
    for(const userId of [w.coordinator.id,w.coordinator.id.toUpperCase()])
      expect(await refusal(propose(w,w.coordinator,{userId}))).toEqual({code:'DOC_APPROVAL_PROPOSAL_INVALID',status:422,message:SELF});
    expect(await snapshot(w)).toEqual(before);
    expect(before.approvals).toBe(0);expect(before.outbox).toBe(0);
  });

  test('ids in upper case reach the same records and never a server error',async()=>{
    const over={projectId:S.toUpperCase(),userId:w.subject.id.toUpperCase()};
    const first=await propose(w,w.coordinator,over),again=await propose(w,w.coordinator,over);
    expect(first.replayed).toBe(false);expect(again).toEqual({...first,replayed:true});
    expect(await w.proposals.listOwn(w.coordinator,{projectId:S.toUpperCase()})).toEqual(await w.proposals.listOwn(w.coordinator,{projectId:S}));
  });

  test('resending the same proposal creates no second ballot',async()=>{
    const first=await propose(w,w.coordinator);
    const before=await snapshot(w);
    const again=await propose(w,w.coordinator);
    expect(again).toEqual({...first,replayed:true});
    expect(await snapshot(w)).toEqual(before);
    expect(await refusal(propose(w,w.coordinator,{reason:'Một căn cứ khác hẳn'}))).toEqual({code:'APPROVAL_PENDING',status:409,message:PENDING});
    expect(await refusal(propose(w,w.coordinator,{docTypes:['plan']}))).toEqual({code:'APPROVAL_PENDING',status:409,message:PENDING});
    expect(await snapshot(w)).toEqual(before);
  });

  test('the eleventh proposal within an hour is rate limited, and failed attempts count',async()=>{
    for(let i=0;i<10;i++) expect(await refusal(propose(w,w.coordinator,{userId:randomUUID()}))).toEqual(ineligible);
    expect(await refusal(propose(w,w.coordinator))).toEqual({code:'RATE_LIMITED',status:429,message:'Thử lại sau ít phút.'});
  });

  // Three layers: the rule is the decision OQ-48 (b); "counted from the closing" in (b) is the Chairman's decision of 16/11/2026 (point A);
  // (c) and (d) are rulings of the Task 7c session (point C). Withdrawn and cancelled ballots are Task 2 (W9, H2, H7).
  test('OQ-48 a ballot that was rejected, expired or overtaken by an account change makes the same proposer wait 24 hours from its closing for the same member',async()=>{
    // (a) rejected by the Chairman; (e) the wait is per pair of people
    const first=await propose(w,w.coordinator);
    await say(w,0,first.approvalId,'reject');
    let before=await snapshot(w);
    expect(await refusal(propose(w,w.coordinator))).toEqual({code:'RATE_LIMITED',status:429,message:PAIR_WAIT});
    expect(await snapshot(w)).toEqual(before);
    const other=await newMember('other');
    await propose(w,w.coordinator,{userId:other});                  // another person: allowed
    await propose(w,w.coManager);                                   // another proposer, same person: allowed
    // (b) counted from the closing, not from the opening
    const second=await propose(w,w.coordinator,{userId:reviewer.id});
    await say(w,0,second.approvalId,'reject');
    await w.h.operator.query("UPDATE identity.account_approvals SET created_at=now()-interval '30 hours',updated_at=now()-interval '1 hour' WHERE id=$1",[second.approvalId]);
    expect(await refusal(propose(w,w.coordinator,{userId:reviewer.id}))).toMatchObject({code:'RATE_LIMITED',message:PAIR_WAIT});
    await w.h.operator.query("UPDATE identity.account_approvals SET updated_at=now()-interval '25 hours' WHERE id=$1",[second.approvalId]);
    await propose(w,w.coordinator,{userId:reviewer.id});
    // (c) a pending ballot past its deadline
    const third=await propose(w,w.coordinator,{userId:approver.id});
    await w.h.operator.query("UPDATE identity.account_approvals SET expires_at=now()-interval '1 hour' WHERE id=$1",[third.approvalId]);
    expect(await refusal(propose(w,w.coordinator,{userId:approver.id}))).toMatchObject({code:'RATE_LIMITED',message:PAIR_WAIT});
    await w.h.operator.query("UPDATE identity.account_approvals SET expires_at=now()-interval '25 hours' WHERE id=$1",[third.approvalId]);
    await resetThrottle(w);
    await propose(w,w.coordinator,{userId:approver.id});
    expect((await ballotRow(third.approvalId)).state).toBe('expired');
    // (d) a pending ballot overtaken by an account change that nobody has marked yet
    const late=await newMember('late');
    const fifth=await propose(w,w.coordinator,{userId:late});
    await w.h.operator.query('UPDATE identity.users SET account_version=2 WHERE id=$1',[late]);
    before=await snapshot(w);
    expect(await refusal(propose(w,w.coordinator,{userId:late}))).toMatchObject({code:'RATE_LIMITED',message:PAIR_WAIT});
    expect((await ballotRow(fifth.approvalId)).state).toBe('pending');     // the refused command does not mark it: 72 hour ceiling of T7C-19
    expect(await snapshot(w)).toEqual(before);
    await w.h.operator.query("UPDATE identity.account_approvals SET expires_at=now()-interval '25 hours' WHERE id=$1",[fifth.approvalId]);
    await propose(w,w.coordinator,{userId:late});
    // (f) an issued ballot does not block
    const done=await newMember('done');
    await w.h.operator.query(`INSERT INTO identity.account_approvals(tenant_id,kind,subject_user_id,subject_account_version,previous_grants,proposer_id,grants,reason,state)
     VALUES($1,'access_change',$2,1,$3,$4,$5,'Phiếu đã áp tổng hợp','issued')`,[ids.tenant,done,JSON.stringify([g(S,'engineer')]),w.coordinator.id,JSON.stringify([g(S,'engineer',dp('design'))])]);
    await propose(w,w.coordinator,{userId:done});
  });

  test('a failed proposal leaves no ballot, no voter, no direct message and no event',async()=>{
    const run=async(label:string,p:Principal,counted:boolean,call:()=>Promise<unknown>,zod=false)=>{
      await resetThrottle(w);
      const before=await snapshot(w);
      if(zod) await expect(call(),label).rejects.toBeInstanceOf(ZodError); else await refusal(call());
      expect(await snapshot(w),label).toEqual(before);
      expect(await attempts(p),label).toBe(counted?1:0);
    };
    const c=w.coordinator;
    await run('P0',c,false,()=>propose(w,c,{docTypes:[]}),true);
    await run('P1 bot',c,false,()=>propose(w,{...c,role:'bot'}));
    await run('P1 tenant',c,false,()=>propose(w,{...c,tenantId:ids.otherTenant}));
    await run('P2 admin',w.admin,false,()=>propose(w,w.admin));
    await run('P2 self',c,false,()=>propose(w,c,{userId:c.id}));
    await resetThrottle(w);
    await w.h.operator.query('INSERT INTO identity.throttle(tenant_id,bucket,attempts) VALUES($1,$2,10)',[ids.tenant,digest('doc-approval-proposal:'+c.id)]);
    const full=await snapshot(w);
    expect(await refusal(propose(w,c))).toMatchObject({code:'RATE_LIMITED'});
    expect(await snapshot(w)).toEqual(full);expect(await attempts(c)).toBe(11);
    const noAdmin=new DocApprovalProposalService(new IdentityService(w.h.operator,ids.tenant));
    await run('P3b not configured',c,true,()=>noAdmin.propose(c,{projectId:S,userId:w.subject.id,docTypes:['design'],expectedTypes:[],reason:BASIS}));
    await run('P3b subject is the admin',c,true,()=>propose(w,c,{userId:w.admin.id}));
    await run('P4 not a member',w.coManager,true,()=>propose(w,w.coManager,{projectId:T,userId:w.transportMember.id}));
    await run('P4 not a manager',c,true,()=>propose(w,c,{projectId:T,userId:w.transportMember.id}));
    const midDelete=new DocApprovalProposalService(identityOn(w,beforeStatementInTx(w.h.operator,/ORDER BY id FOR NO KEY UPDATE/,async tx=>{
      await tx.query('DELETE FROM identity.memberships WHERE user_id=$1 AND project_id=$2',[c.id,S]);})));
    await run('P6 role lost under the lock',c,true,()=>midDelete.propose(c,{projectId:S,userId:w.subject.id,docTypes:['design'],expectedTypes:[],reason:BASIS}));
    const midDisable=new DocApprovalProposalService(identityOn(w,beforeStatementInTx(w.h.operator,/ORDER BY id FOR NO KEY UPDATE/,async tx=>{
      await tx.query('UPDATE identity.users SET active=false WHERE id=$1',[w.coManager.id]);})));
    await run('P5 proposer disabled under the lock',w.coManager,true,()=>midDisable.propose(w.coManager,{projectId:S,userId:w.subject.id,docTypes:['design'],expectedTypes:[],reason:BASIS}));
    await run('P8',c,true,()=>propose(w,c,{userId:randomUUID()}));
    await run('P9',c,true,()=>propose(w,c,{expectedTypes:['plan']}));
    await grantDocApproval(w.h,reviewer.id,S,['design']);
    await run('P10',c,true,()=>propose(w,c,{userId:reviewer.id,expectedTypes:['design']}));
    await w.h.operator.query('DELETE FROM identity.telegram_links WHERE user_id=ANY($1::uuid[])',[[w.approvers[2].id,w.approvers[3].id]]);
    await run('P7',w.seatCoordinator,true,()=>propose(w,w.seatCoordinator));
    await w.h.operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3),($1,$4,$5)',
      [ids.tenant,w.approvers[2].id,w.approvers[2].telegram,w.approvers[3].id,w.approvers[3].telegram]);
    await propose(w,c);
    await resetThrottle(w);
    const beforeResend=await snapshot(w);
    expect((await propose(w,c)).replayed).toBe(true);
    expect(await snapshot(w)).toEqual(beforeResend);expect(await attempts(c)).toBe(1);
    await run('P13 pending',c,true,()=>propose(w,c,{docTypes:['plan']}));
    const closed=await propose(w,c,{userId:approver.id});
    await say(w,0,closed.approvalId,'reject');
    await run('P14',c,true,()=>propose(w,c,{userId:approver.id}));
  });

  test("listOwn returns the caller's own open ballots of that project to a caller who is still a member, whatever the role",async()=>{
    await setProjectRole(w,w.coordinator.id,T,'manager');
    const a=await propose(w,w.coordinator);
    const b=await propose(w,w.coordinator,{userId:reviewer.id});
    await propose(w,w.coManager,{userId:approver.id});                                  // someone else's
    const adminTarget=await newMember('admin-target');
    await w.accounts.command(w.admin,{kind:'propose_access_change',userId:adminTarget,expectedVersion:1,reason:'Quản trị trình phiếu thuần duyệt',grants:[g(S,'engineer',dp('design'))]});
    const rejected=await propose(w,w.coordinator,{userId:await newMember('rejected')});
    await say(w,0,rejected.approvalId,'reject');
    const overdue=await propose(w,w.coordinator,{userId:await newMember('overdue')});
    await w.h.operator.query("UPDATE identity.account_approvals SET expires_at=now()-interval '1 hour' WHERE id=$1",[overdue.approvalId]);
    const stale=await newMember('stale');
    await propose(w,w.coordinator,{userId:stale});
    await w.h.operator.query('UPDATE identity.users SET account_version=2 WHERE id=$1',[stale]);
    const ofSales=async(p:Principal=w.coordinator)=>(await w.proposals.listOwn(p,{projectId:S}));
    let listed=await ofSales();
    expect(listed.map(x=>[x.approvalId,x.state,x.userId,x.projectId,x.replayed])).toEqual([
      [a.approvalId,'pending',w.subject.id,S,false],[b.approvalId,'pending',reviewer.id,S,false]]);
    expect(listed[0].addedTypes).toEqual(['design']);
    await say(w,2,b.approvalId);
    listed=await ofSales();
    expect(listed.map(x=>x.state)).toEqual(['pending','approved']);
    // still a member in any role: the whole list
    for(const role of ['engineer','viewer'] as const) {
      await setProjectRole(w,w.coordinator.id,S,role);
      expect((await ofSales()).map(x=>x.approvalId)).toEqual([a.approvalId,b.approvalId]);
    }
    await setProjectRole(w,w.coordinator.id,S,null);
    const gone=await refusal(w.proposals.listOwn(w.coordinator,{projectId:S}));
    expect(gone).toEqual({code:'SCOPE_DENIED',status:404,message:SCOPE});
    expect(gone).toEqual(await refusal(w.proposals.listOwn(w.coordinator,{projectId:randomUUID()})));
    expect(gone).toEqual(await refusal(w.proposals.listOwn({...w.transportMember,grants:undefined},{projectId:S})));
    await setProjectRole(w,w.coordinator.id,S,'manager');
    expect(await w.proposals.listOwn(w.admin,{projectId:S})).toEqual([]);
    // R8: filtering happens in SQL before the cap of 200
    const grantsAfter=[g(T,'engineer',dp('design'))],grantsBefore=[g(T,'engineer')];
    await w.h.operator.query(`WITH u AS (INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash)
      SELECT gen_random_uuid(),$1,'da-synth-'||n,'Người tổng hợp '||n,'engineer','fixture-hash' FROM generate_series(1,205) n RETURNING id),
     m AS (INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) SELECT $1,id,$2,'engineer' FROM u RETURNING user_id)
     INSERT INTO identity.account_approvals(tenant_id,kind,subject_user_id,subject_account_version,previous_grants,proposer_id,grants,reason,state,created_at)
     SELECT $1,'access_change',id,1,$3::jsonb,$4,$5::jsonb,'Phiếu tổng hợp cho bản thử','pending',now()-interval '10 days' FROM u`,
     [ids.tenant,T,JSON.stringify(grantsBefore),w.coordinator.id,JSON.stringify(grantsAfter)]);
    expect((await ofSales()).map(x=>x.approvalId)).toEqual([a.approvalId,b.approvalId]);
    expect(await w.proposals.listOwn(w.coordinator,{projectId:T})).toHaveLength(200);
  });

  test("OQ-35 through the bot bridge the proposer's seat neither lists nor votes on the own ballot",async()=>{
    const made=await propose(w,w.seatCoordinator);
    const seat=w.approvers[1],control=w.approvers[2];
    const listed=(await bridgeCall(w,seat.telegram,{operation:'account_approval_pending'})) as {id:string}[];
    expect(listed.some(r=>r.id===made.approvalId)).toBe(false);
    expect(await refusal(bridgeCall(w,seat.telegram,{operation:'account_approval_vote',approvalId:made.approvalId,choice:'agree'}))).toMatchObject({code:'APPROVER_REQUIRED'});
    expect(await rows(w,'SELECT 1 FROM identity.account_approval_votes WHERE approval_id=$1',[made.approvalId])).toHaveLength(0);
    const seen=(await bridgeCall(w,control.telegram,{operation:'account_approval_pending'})) as {id:string}[];
    expect(seen.some(r=>r.id===made.approvalId)).toBe(true);
    await bridgeCall(w,control.telegram,{operation:'account_approval_vote',approvalId:made.approvalId,choice:'agree'});
    expect(await rows(w,'SELECT 1 FROM identity.account_approval_votes WHERE approval_id=$1',[made.approvalId])).toHaveLength(1);
  });

  test('a unique violation is answered APPROVAL_PENDING only for the one-open-ballot index',async()=>{
    const call=(service:DocApprovalProposalService)=>service.propose(w.coordinator,{projectId:S,userId:w.subject.id,docTypes:['design'],expectedTypes:[],reason:BASIS});
    const before=await snapshot(w);
    // (a) the right index, a real conflict: an open ballot appears inside the service's own transaction, right before its insert
    const sameIndex=new DocApprovalProposalService(identityOn(w,beforeStatementInTx(w.h.operator,/INSERT INTO identity\.account_approvals/,async(tx,sql,params)=>{await tx.query(sql,params);})));
    expect(await refusal(call(sameIndex))).toEqual({code:'APPROVAL_PENDING',status:409,message:PENDING});
    expect(await snapshot(w)).toEqual(before);
    // (b) another constraint, a real conflict: the first voter row appears just before the service writes it
    const otherReal=new DocApprovalProposalService(identityOn(w,beforeStatementInTx(w.h.operator,/INSERT INTO identity\.account_approval_voters/,async(tx,sql,params)=>{await tx.query(sql,params);})));
    const thrown=await call(otherReal).then(()=>undefined,(e:unknown)=>e) as {code?:string;constraint?:string;message?:string};
    expect(thrown).toBeDefined();
    expect(thrown instanceof AppError).toBe(false);
    expect(thrown.code).toBe('23505');
    expect(thrown.constraint).not.toBe('account_approval_active_access_change');
    expect(thrown.message).not.toContain('account_approval_active_access_change');
    expect(await snapshot(w)).toEqual(before);
    // (c) another constraint on the approvals insert itself. Limit: that statement names no `id`, so a real conflict of another constraint
    // cannot be built on it; this branch uses a prebuilt error.
    const prebuilt=Object.assign(new Error('duplicate key value violates unique constraint "account_approvals_pkey"'),{code:'23505',constraint:'account_approvals_pkey'});
    const otherBuilt=new DocApprovalProposalService(identityOn(w,failingStatement(w.h.operator,/INSERT INTO identity\.account_approvals/,prebuilt)));
    await expect(call(otherBuilt)).rejects.toBe(prebuilt);
    expect(await snapshot(w)).toEqual(before);
  });

  test('OQ-48 a ballot that expired at its deadline and was only marked later does not block beyond 24 hours after the deadline',async()=>{
    const id=randomUUID();
    await w.h.operator.query(`INSERT INTO identity.account_approvals(id,tenant_id,kind,subject_user_id,subject_account_version,previous_grants,proposer_id,grants,reason,state,expires_at,updated_at)
     VALUES($1,$2,'access_change',$3,1,$4,$5,$6,'Phiếu hết hạn bị đánh dấu muộn','expired',now()-interval '23 hours',now()-interval '1 hour')`,
     [id,ids.tenant,w.subject.id,JSON.stringify([g(S,'engineer')]),w.coordinator.id,JSON.stringify([g(S,'engineer',dp('design'))])]);
    expect(await refusal(propose(w,w.coordinator))).toMatchObject({code:'RATE_LIMITED',message:PAIR_WAIT});
    await w.h.operator.query("UPDATE identity.account_approvals SET expires_at=now()-interval '25 hours' WHERE id=$1",[id]);
    expect((await propose(w,w.coordinator)).state).toBe('pending');
  });

  test('OQ-48 only a withdrawal recorded by the proposer exempts the pair',async()=>{
    const first=await propose(w,w.coordinator);
    await say(w,0,first.approvalId,'reject');
    const withdrawn=(actor:string)=>w.h.operator.query(`INSERT INTO identity.events(tenant_id,user_id,actor_id,kind,detail) VALUES($1,$2,$3,'access_change_withdrawn',$4)`,
      [ids.tenant,w.subject.id,actor,JSON.stringify({approvalId:first.approvalId})]);
    await withdrawn(w.admin.id);
    expect(await refusal(propose(w,w.coordinator))).toMatchObject({code:'RATE_LIMITED',message:PAIR_WAIT});
    await withdrawn(w.coordinator.id);
    expect((await propose(w,w.coordinator)).state).toBe('pending');
  });
});

