import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {ZodError} from 'zod';
import {openWorld,propose,say,rows,snapshot,refusal,setProjectRole,applyFrozen,BASIS,type World} from './doc-approval-fixtures';
import {pm} from './slice1-fixtures';
import {approver,frozenRevision,registerDoc,reviewer} from './slice3-fixtures';
import {docApprovalCode,type DocApprovalType} from '../src/server/access-grants';
import {reasonPrefix} from '../src/server/doc-approval-proposals';
import {ReviewService} from '../src/server/document-review';
import {DelegationService} from '../src/server/review-delegations';
import {ids} from '../src/server/identities';
import type {Principal,ProjectGrant} from '../src/server/types';

// Task 7c, Task 3: the account admin applies a coordinator ballot (OQ-33 b), sees the proposer's standing before the apply goes through
// (OQ-37 c, N2 of gate round 1, T7C-11), and the admin list shows the open ballot of each account. Synthetic data only; each case builds its
// own world (F5).
let w:World;
beforeEach(async()=>{w=await openWorld();});
afterEach(async()=>{await w.h.reset();await w.h.close();});

const S=ids.sales,T=ids.transport;
const TELEGRAM={code:'TELEGRAM_APPROVAL_REQUIRED',status:409,message:'Mở rộng quyền cần phiếu duyệt Telegram mới.'};
const STANDING={code:'VERSION_CONFLICT',status:409,message:'Tình trạng người trình đã đổi. Tải lại để xem trước khi áp.'};
const CLOSED={code:'APPROVAL_CLOSED',status:409,message:'Phiếu đã kết thúc hoặc hết hạn.'};
const ADMIN_ONLY={code:'ACCOUNT_ADMIN_REQUIRED',status:403,message:'Cần quyền quản trị tài khoản.'};
const NOT_AUTHORIZED={code:'APPROVER_NOT_AUTHORIZED',status:403};
// the detail keys of an `account_access` event that applies an admin ballot, exactly as before this task
const ADMIN_KEYS=['active','after','approvalId','before','previousActive','previousVersion','reason','version'];
const APPLY='Áp đúng bộ quyền đã được duyệt';
const g=(projectId:string,role:ProjectGrant['role'],...perms:string[]):ProjectGrant=>({projectId,role,reportPermissions:perms as ProjectGrant['reportPermissions']});
const dp=(t:DocApprovalType)=>docApprovalCode(t);

type Listed={id:string;version:number;accessChange?:Record<string,unknown>|null};
const listed=async(userId:string)=>{
  const row=((await w.accounts.list(w.admin)) as unknown as Listed[]).find(r=>r.id===userId);
  if(!row) throw new Error('account not listed');
  return row;
};
const openOf=async(userId:string)=>(await listed(userId)).accessChange;
const versionOf=async(userId:string)=>(await rows<{v:number}>(w,'SELECT account_version v FROM identity.users WHERE id=$1',[userId]))[0].v;
const stateOf=async(id:string)=>(await rows<{state:string}>(w,'SELECT state FROM identity.account_approvals WHERE id=$1',[id]))[0].state;
const membershipsOf=(userId:string)=>rows(w,'SELECT project_id,project_role,report_permissions FROM identity.memberships WHERE user_id=$1 ORDER BY project_id',[userId]);
const permsOf=async(userId:string)=>(await membershipsOf(userId)).flatMap(m=>m.report_permissions as string[]);
const ballotRow=async(id:string)=>(await rows<{grants:ProjectGrant[];previous_grants:ProjectGrant[];reason:string;expires_at:string|Date}>(w,
  'SELECT grants,previous_grants,reason,expires_at FROM identity.account_approvals WHERE id=$1',[id]))[0];
/** The `account_access` event that applied this ballot. */
const applyEvent=async(approvalId:string)=>{
  const found=await rows<{user_id:string;actor_id:string;detail:Record<string,unknown>}>(w,
    "SELECT user_id,actor_id,detail FROM identity.events WHERE kind='account_access' AND detail->>'approvalId'=$1",[approvalId]);
  expect(found).toHaveLength(1);
  return found[0];
};
const accessEvents=async()=>(await rows(w,"SELECT 1 FROM identity.events WHERE kind='account_access'")).length;
/** The admin's `access` with the frozen grants of the approved ballot; the standing field is sent only when `standing` is a boolean. */
const applyWith=async(userId:string,standing?:boolean)=>{
  const frozen=(await rows<{grants:ProjectGrant[]}>(w,`SELECT grants FROM identity.account_approvals WHERE kind='access_change' AND subject_user_id=$1
    AND state='approved' ORDER BY created_at DESC LIMIT 1`,[userId]))[0].grants;
  return w.accounts.command(w.admin,{kind:'access',userId,expectedVersion:await versionOf(userId),reason:APPLY,grants:frozen,
    ...(standing===undefined?{}:{proposerIsCoordinator:standing})});
};
/** The admin's own direct save of an account's grants (a narrowing needs no ballot). */
const adminAccess=async(userId:string,grants:ProjectGrant[],extra:Record<string,unknown>={})=>
  w.accounts.command(w.admin,{kind:'access',userId,expectedVersion:await versionOf(userId),reason:'Thu hẹp quyền của tài khoản mẫu',grants,...extra});
/** Operational login: a further active, activated engineer of ids.sales. */
async function newMember(tag:string):Promise<string> {
  const id=randomUUID();
  await w.h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,$4,'engineer','fixture-hash')`,[id,ids.tenant,'da-a-'+tag,'Thành viên mẫu '+tag]);
  await w.h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'engineer')`,[ids.tenant,id,S]);
  return id;
}

describe('the admin applies a coordinator ballot',()=>{
  test('end to end: a coordinator proposes, one BoM agrees, the admin applies exactly the frozen grants, and only then the member approves a frozen design revision',async()=>{
    const review=new ReviewService(w.h.db);
    const doc=await registerDoc(w.h,pm,{projectId:S,docType:'design'});
    const frozen=await frozenRevision(w.h,doc.record.id,reviewer.id);
    const decide=()=>review.decide(w.subject,doc.record.id,{revisionId:frozen.revisionId,sourceHash:frozen.hash,expectedVersion:frozen.version,
      result:'approved',scopeNote:'Đã đọc đúng bản này',exceptions:[]},randomUUID(),randomUUID());
    const pointer=async()=>(await rows<{approved_revision_id:string|null}>(w,'SELECT approved_revision_id FROM document_records WHERE id=$1',[doc.record.id]))[0].approved_revision_id;
    expect(await refusal(decide())).toMatchObject(NOT_AUTHORIZED);
    const made=await propose(w,w.coordinator);
    expect(await refusal(decide())).toMatchObject(NOT_AUTHORIZED);
    await say(w,2,made.approvalId);
    expect(await stateOf(made.approvalId)).toBe('approved');
    // approved, not applied: still nothing
    expect(await refusal(decide())).toMatchObject(NOT_AUTHORIZED);
    expect(await pointer()).toBeNull();
    expect(await openOf(w.subject.id)).toMatchObject({approvalId:made.approvalId,state:'approved',viaProjectManager:true,proposerIsCoordinator:true});
    // the admin applies exactly the frozen grants
    await expect(applyFrozen(w,w.subject.id)).resolves.toHaveProperty('user.id',w.subject.id);
    expect(await stateOf(made.approvalId)).toBe('issued');
    expect(await membershipsOf(w.subject.id)).toEqual([{project_id:S,project_role:'engineer',report_permissions:[dp('design')]}]);
    expect(await openOf(w.subject.id)).toBeNull();
    const event=await applyEvent(made.approvalId);
    expect(event).toMatchObject({user_id:w.subject.id,actor_id:w.admin.id});
    expect(event.detail).toMatchObject({approvalId:made.approvalId,proposedBy:w.coordinator.id,before:[g(S,'engineer')],after:[g(S,'engineer',dp('design'))]});
    // only now the member approves the frozen revision, and the canonical pointer moves to it
    const detail=await decide();
    expect(detail.item.decision).toMatchObject({result:'approved',decidedBy:w.subject.id,revisionId:frozen.revisionId});
    expect(await pointer()).toBe(frozen.revisionId);
    const listedApprovers=(await new DelegationService(w.h.db).list(pm,{projectId:S})).approvers;
    expect(listedApprovers).toContainEqual({userId:w.subject.id,docTypes:['design']});
  });

  test('a coordinator ballot that widens beyond doc_approve cannot be applied',async()=>{
    // operational login: a ballot «proposed» by the coordinator that also adds people_read, its voters frozen from the seats
    const version=await versionOf(w.subject.id);
    const wide=[g(S,'engineer',dp('design'),'people_read')];
    const id=randomUUID();
    await w.h.operator.query(`INSERT INTO identity.account_approvals(id,tenant_id,kind,subject_user_id,subject_account_version,previous_grants,proposer_id,grants,reason)
      VALUES($1,$2,'access_change',$3,$4,$5,$6,$7,$8)`,[id,ids.tenant,w.subject.id,version,JSON.stringify([g(S,'engineer')]),w.coordinator.id,
      JSON.stringify(wide),reasonPrefix('Điều phối mẫu',false)+BASIS]);
    for(const seat of w.approvers) await w.h.operator.query(`INSERT INTO identity.account_approval_voters(approval_id,tenant_id,seat,user_id) VALUES($1,$2,$3,$4)`,
      [id,ids.tenant,seat.seat,seat.id]);
    await say(w,2,id);
    expect(await stateOf(id)).toBe('approved');
    const memberships=await membershipsOf(w.subject.id);
    const before=await snapshot(w);
    const command=(extra:Record<string,unknown>)=>w.accounts.command(w.admin,{kind:'access',userId:w.subject.id,expectedVersion:version,reason:APPLY,grants:wide,...extra});
    for(const extra of [{proposerIsCoordinator:true},{proposerIsCoordinator:false},{}])
      await expect(command(extra),JSON.stringify(extra)).rejects.toMatchObject(TELEGRAM);
    expect(await membershipsOf(w.subject.id)).toEqual(memberships);
    expect(await stateOf(id)).toBe('approved');
    expect(await snapshot(w)).toEqual(before);
    // the same row with the admin as its proposer applies exactly as today
    await w.h.operator.query('UPDATE identity.account_approvals SET proposer_id=$2 WHERE id=$1',[id,w.admin.id]);
    await expect(command({})).resolves.toHaveProperty('user.id',w.subject.id);
    expect(await stateOf(id)).toBe('issued');
    expect((await permsOf(w.subject.id)).sort()).toEqual([dp('design'),'people_read'].sort());
    expect(Object.keys((await applyEvent(id)).detail).sort()).toEqual(ADMIN_KEYS);
  });

  test('OQ-37 a ballot whose proposer no longer coordinates the project is still applied by the admin once the list has said so',async()=>{
    const variants:[string,()=>Promise<unknown>][]=[
      ['demoted to viewer in the project',()=>adminAccess(w.coordinator.id,[g(S,'viewer'),g(T,'viewer')])],
      ['removed from the project, still a member elsewhere',()=>adminAccess(w.coordinator.id,[g(T,'viewer')])],
      ['disabled',async()=>w.accounts.command(w.admin,{kind:'disable',userId:w.coordinator.id,expectedVersion:await versionOf(w.coordinator.id),reason:'Khoá tài khoản điều phối mẫu'})],
    ];
    for(const [i,[name,change]] of variants.entries()) {
      if(i>0) {await w.h.reset();await w.h.close();w=await openWorld();}
      const made=await propose(w,w.coordinator);
      await say(w,2,made.approvalId);
      const control=await propose(w,w.coordinator,{userId:reviewer.id});
      await say(w,2,control.approvalId);
      expect(await openOf(w.subject.id),name).toMatchObject({approvalId:made.approvalId,viaProjectManager:true,proposerIsCoordinator:true});
      // control: while the proposer still coordinates, the event names the proposer and nothing else is added
      await expect(applyFrozen(w,reviewer.id),name).resolves.toHaveProperty('user.id',reviewer.id);
      expect(await stateOf(control.approvalId),name).toBe('issued');
      const kept=(await applyEvent(control.approvalId)).detail;
      expect(kept.proposedBy,name).toBe(w.coordinator.id);
      expect(Object.keys(kept).sort(),name).toEqual([...ADMIN_KEYS,'proposedBy'].sort());
      // the proposer loses the standing; the list says so
      await change();
      expect(await openOf(w.subject.id),name).toMatchObject({approvalId:made.approvalId,viaProjectManager:true,proposerIsCoordinator:false});
      // the list is read again, so false is sent, and the apply goes through
      await expect(applyFrozen(w,w.subject.id),name).resolves.toHaveProperty('user.id',w.subject.id);
      expect(await stateOf(made.approvalId),name).toBe('issued');
      expect(await permsOf(w.subject.id),name).toContain(dp('design'));
      const event=await applyEvent(made.approvalId);
      expect(event.user_id,name).toBe(w.subject.id);
      expect(event.detail,name).toMatchObject({proposedBy:w.coordinator.id,proposerNoLongerCoordinator:true});
      expect(Object.keys(event.detail).sort(),name).toEqual([...ADMIN_KEYS,'proposedBy','proposerNoLongerCoordinator'].sort());
    }
  });

  test('a ballot frozen at an older account version is dead everywhere',async()=>{
    await w.h.operator.query("UPDATE identity.memberships SET report_permissions=ARRAY['people_read'] WHERE user_id=$1 AND project_id=$2",[w.subject.id,S]);
    const made=await propose(w,w.coordinator);
    await say(w,2,made.approvalId);
    expect(await stateOf(made.approvalId)).toBe('approved');
    expect(await openOf(w.subject.id)).toMatchObject({approvalId:made.approvalId,state:'approved'});
    // the admin removes another permission of the member: a narrowing, no ballot, the account version moves on
    await adminAccess(w.subject.id,[g(S,'engineer')]);
    const frozen=(await ballotRow(made.approvalId)).grants;
    const memberships=await membershipsOf(w.subject.id);
    for(const extra of [{proposerIsCoordinator:true},{}])
      expect(await refusal(w.accounts.command(w.admin,{kind:'access',userId:w.subject.id,expectedVersion:await versionOf(w.subject.id),reason:APPLY,grants:frozen,...extra})),
        JSON.stringify(extra)).toEqual(TELEGRAM);
    expect(await membershipsOf(w.subject.id)).toEqual(memberships);
    expect(await openOf(w.subject.id)).toBeNull();
    expect(await w.proposals.listOwn(w.coordinator,{projectId:S})).toEqual([]);
    // the next vote closes it
    expect(await refusal(say(w,3,made.approvalId))).toEqual(CLOSED);
    expect(await stateOf(made.approvalId)).toBe('expired');
  });

  test('the admin list shows the open ballot of each account and nothing for an account without one',async()=>{
    const made=await propose(w,w.coordinator);
    // the admin's own ballot for reviewer, through the admin path
    const adminBallot=((await w.accounts.command(w.admin,{kind:'propose_access_change',userId:reviewer.id,expectedVersion:await versionOf(reviewer.id),
      reason:'Quản trị trình phiếu thuần duyệt',grants:[g(S,'technical',dp('design'))]})) as {approvalId:string}).approvalId;
    // withdrawn, cancelled, rejected, past the deadline
    const withdrawn=await propose(w,w.coordinator,{userId:approver.id});
    await w.proposals.withdraw(w.coordinator,withdrawn.approvalId,{reason:'Đã trình nhầm, xin rút lại'});
    const cancelledMember=await newMember('cancelled');
    const cancelled=await propose(w,w.coordinator,{userId:cancelledMember});
    await w.accounts.command(w.admin,{kind:'cancel_access_change',userId:cancelledMember,expectedVersion:await versionOf(cancelledMember),
      reason:'Huỷ phiếu trình chưa đúng của điều phối',approvalId:cancelled.approvalId});
    const rejectedMember=await newMember('rejected');
    const rejected=await propose(w,w.coordinator,{userId:rejectedMember});
    await say(w,0,rejected.approvalId,'reject');
    const overdueMember=await newMember('overdue');
    const overdue=await propose(w,w.coordinator,{userId:overdueMember});
    await w.h.operator.query("UPDATE identity.account_approvals SET expires_at=now()-interval '1 minute' WHERE id=$1",[overdue.approvalId]);
    expect([await stateOf(withdrawn.approvalId),await stateOf(cancelled.approvalId),await stateOf(rejected.approvalId),await stateOf(overdue.approvalId)])
      .toEqual(['expired','expired','rejected','pending']);
    const row=await ballotRow(made.approvalId);
    expect(row.reason).toBe(reasonPrefix('Điều phối mẫu',false)+BASIS);
    expect(await openOf(w.subject.id)).toEqual({approvalId:made.approvalId,state:'pending',reason:row.reason,expiresAt:new Date(row.expires_at).toISOString(),
      grants:row.grants,previousGrants:row.previous_grants,viaProjectManager:true,proposerIsCoordinator:true});
    expect((await openOf(w.subject.id))?.grants).toEqual([g(S,'engineer',dp('design'))]);
    expect((await openOf(w.subject.id))?.previousGrants).toEqual([g(S,'engineer')]);
    expect(await openOf(reviewer.id)).toMatchObject({approvalId:adminBallot,state:'pending',reason:'Quản trị trình phiếu thuần duyệt',
      viaProjectManager:false,proposerIsCoordinator:null});
    for(const [name,id] of [['no ballot',w.transportMember.id],['no ballot, the proposer',w.coordinator.id],['withdrawn',approver.id],
      ['cancelled',cancelledMember],['rejected',rejectedMember],['past the deadline',overdueMember]] as const)
      expect(await openOf(id),name).toBeNull();
    // a seat approves: the stage is shown
    await say(w,2,made.approvalId);
    expect(await openOf(w.subject.id)).toMatchObject({approvalId:made.approvalId,state:'approved',proposerIsCoordinator:true});
    // still only the account admin reads the list
    for(const p of [w.coordinator,w.subject,{...w.admin,role:'bot'} as Principal])
      expect(await refusal(w.accounts.list(p)),p.name).toEqual(ADMIN_ONLY);
  });

  test('ballots the admin proposed apply exactly as before, with or without the standing field',async()=>{
    const subjects=[w.subject.id,reviewer.id,approver.id];
    const fields:Record<string,unknown>[]=[{},{proposerIsCoordinator:true},{proposerIsCoordinator:false}];
    for(const [i,userId] of subjects.entries()) {
      // an ordinary widening: one more project, one more report permission
      const before=(await listed(userId) as unknown as {grants:ProjectGrant[]}).grants;
      const after=[...before.map(grant=>grant.projectId===S?{...grant,reportPermissions:[...grant.reportPermissions,'people_read' as const]}:grant),g(T,'engineer')];
      const made=((await w.accounts.command(w.admin,{kind:'propose_access_change',userId,expectedVersion:await versionOf(userId),
        reason:'Quản trị trình mở rộng thường',grants:after})) as {approvalId:string}).approvalId;
      await say(w,2,made);
      expect(await openOf(userId),String(i)).toMatchObject({approvalId:made,state:'approved',viaProjectManager:false,proposerIsCoordinator:null});
      const version=await versionOf(userId);
      await expect(applyFrozen(w,userId,fields[i]),String(i)).resolves.toHaveProperty('user.id',userId);
      expect(await stateOf(made),String(i)).toBe('issued');
      expect(await versionOf(userId),String(i)).toBe(version+1);
      expect((await membershipsOf(userId)).map(m=>m.project_id),String(i)).toEqual([S,T].sort());
      expect(Object.keys((await applyEvent(made)).detail).sort(),String(i)).toEqual(ADMIN_KEYS);
    }
  });

  test('OQ-37 a stale proposer standing is answered VERSION_CONFLICT, and after a reload the note is there and the apply goes through',async()=>{
    const made=await propose(w,w.coordinator);
    await say(w,2,made.approvalId);
    const other=await propose(w,w.coordinator,{userId:reviewer.id});
    await say(w,2,other.approvalId);
    expect((await openOf(w.subject.id))?.proposerIsCoordinator).toBe(true);
    // the admin demotes the proposer to viewer in the project
    await adminAccess(w.coordinator.id,[g(S,'viewer'),g(T,'viewer')]);
    const memberships=await membershipsOf(w.subject.id);
    const before=await snapshot(w),events=await accessEvents();
    // the value the page showed before the change; then no field at all
    for(const standing of [true,undefined]) {
      await expect(applyWith(w.subject.id,standing),String(standing)).rejects.toMatchObject(STANDING);
      expect(await membershipsOf(w.subject.id)).toEqual(memberships);
      expect(await stateOf(made.approvalId)).toBe('approved');
      expect(await accessEvents()).toBe(events);
      expect(await snapshot(w)).toEqual(before);
    }
    // reloaded: the list says false; sending false applies
    expect((await openOf(w.subject.id))?.proposerIsCoordinator).toBe(false);
    await expect(applyWith(w.subject.id,false)).resolves.toHaveProperty('user.id',w.subject.id);
    expect(await stateOf(made.approvalId)).toBe('issued');
    expect((await applyEvent(made.approvalId)).detail).toMatchObject({proposedBy:w.coordinator.id,proposerNoLongerCoordinator:true});
    // the other way: the page shows false, then the proposer gets the role back
    expect((await openOf(reviewer.id))?.proposerIsCoordinator).toBe(false);
    await setProjectRole(w,w.coordinator.id,S,'manager');
    const reviewerMemberships=await membershipsOf(reviewer.id);
    await expect(applyWith(reviewer.id,false)).rejects.toMatchObject(STANDING);
    expect(await membershipsOf(reviewer.id)).toEqual(reviewerMemberships);
    expect(await stateOf(other.approvalId)).toBe('approved');
    expect((await openOf(reviewer.id))?.proposerIsCoordinator).toBe(true);
    await expect(applyWith(reviewer.id,true)).resolves.toHaveProperty('user.id',reviewer.id);
    expect(await stateOf(other.approvalId)).toBe('issued');
    const event=(await applyEvent(other.approvalId)).detail;
    expect(event.proposedBy).toBe(w.coordinator.id);
    expect(event).not.toHaveProperty('proposerNoLongerCoordinator');
  });

  test('the standing field changes nothing where no coordinator ballot is used',async()=>{
    // a narrowing with the field: saved as today, no ballot, no proposer in the event
    await w.h.operator.query("UPDATE identity.memberships SET report_permissions=ARRAY['people_read'] WHERE user_id=$1 AND project_id=$2",[w.subject.id,S]);
    // identity.events has no key to identity.users, so on PostgreSQL earlier cases' events of these fixed ids remain: each save carries its own reason
    const eventsOf=(reason:string)=>rows<{detail:Record<string,unknown>}>(w,"SELECT detail FROM identity.events WHERE kind='account_access' AND detail->>'reason'=$1",[reason]);
    const version=await versionOf(w.subject.id);
    const subjectReason='Bớt quyền xem người của thành viên mẫu '+randomUUID();
    const saved=await adminAccess(w.subject.id,[g(S,'engineer')],{proposerIsCoordinator:true,reason:subjectReason}) as {user:{version:number}};
    expect(saved.user.version).toBe(version+1);
    const narrowed=await eventsOf(subjectReason);
    expect(narrowed).toHaveLength(1);
    expect(Object.keys(narrowed[0].detail).sort()).toEqual(ADMIN_KEYS.filter(key=>key!=='approvalId'));
    expect(narrowed[0].detail).not.toHaveProperty('proposedBy');
    // a widening without an approved ballot: refused exactly as today, whatever the field says
    const before=await snapshot(w);
    for(const standing of [true,false])
      expect(await refusal(adminAccess(approver.id,[g(S,'business','quality_review')],{proposerIsCoordinator:standing})),String(standing)).toEqual(TELEGRAM);
    expect(await snapshot(w)).toEqual(before);
    // not a boolean: refused by the schema
    for(const bad of ['yes',null,1,'true'])
      await expect(adminAccess(approver.id,[g(S,'business')],{proposerIsCoordinator:bad}),JSON.stringify(bad)).rejects.toBeInstanceOf(ZodError);
    // an account with a PENDING coordinator ballot: its frozen widening is refused, and a narrowing with the field is saved
    const made=await propose(w,w.coordinator,{userId:reviewer.id});
    expect(await openOf(reviewer.id)).toMatchObject({approvalId:made.approvalId,state:'pending',viaProjectManager:true,proposerIsCoordinator:true});
    const frozen=(await ballotRow(made.approvalId)).grants;
    expect(await refusal(adminAccess(reviewer.id,frozen,{proposerIsCoordinator:true}))).toEqual(TELEGRAM);
    const reviewerVersion=await versionOf(reviewer.id);
    const reviewerReason='Hạ vai của người nhận xét mẫu '+randomUUID();
    const done=await adminAccess(reviewer.id,[g(S,'viewer')],{proposerIsCoordinator:false,reason:reviewerReason}) as {user:{version:number}};
    expect(done.user.version).toBe(reviewerVersion+1);
    const found=await eventsOf(reviewerReason);
    expect(found).toHaveLength(1);
    const event=found[0].detail;
    expect(Object.keys(event).sort()).toEqual(ADMIN_KEYS.filter(key=>key!=='approvalId'));
    expect(event).not.toHaveProperty('proposedBy');
    expect(event).not.toHaveProperty('proposerNoLongerCoordinator');
    // the ballot is now frozen at an older version, as today: still pending in the table, gone from the list
    expect(await stateOf(made.approvalId)).toBe('pending');
    expect(await openOf(reviewer.id)).toBeNull();
  });
});
