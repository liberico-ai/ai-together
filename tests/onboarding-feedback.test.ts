import { beforeEach,afterEach,expect,test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { embeddedDatabase,type Database } from '../src/server/db';
import { seed } from '../src/server/seed';
import { ids } from '../src/server/identities';
import { IdentityService,digest,secret } from '../src/server/identity';
import { AccountService } from '../src/server/accounts';
import { FeedbackService } from '../src/server/feedback';
import {AccountApprovalService} from '../src/server/account-approval';
import {provisionApprovers} from './account-approval-fixture';
import type { Principal } from '../src/server/types';

let db:Database,identity:IdentityService,accounts:AccountService,admin:Principal;
let approvers:Awaited<ReturnType<typeof provisionApprovers>>;
beforeEach(async()=>{
 db=await embeddedDatabase();await seed(db);
 const id=randomUUID();identity=new IdentityService(db,ids.tenant,id);accounts=new AccountService(identity);
 await db.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash)
   VALUES($1,$2,'chair-test','Admin','manager','test-fixture')`,[id,ids.tenant]);
 await db.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,$4)',
  [ids.tenant,id,ids.sales,'manager']);
 admin={id,tenantId:ids.tenant,name:'Admin',role:'manager',projectIds:[ids.sales],accountAdmin:true,
  grants:[{projectId:ids.sales,role:'manager',reportPermissions:[]}]};
 approvers=await provisionApprovers(db,identity,id,ids.sales);
});
afterEach(async()=>db.close());

test('registration waits for Chairman and one BoM Telegram approval before invitation and pairing',async()=>{
 const claim={username:'new.tech',name:'Thành viên thử',projectInterest:'Xeca và LBRC',note:'Nhóm Tech'};
 expect(await identity.requestRegistration(claim)).toEqual({received:true});
 expect(await identity.requestRegistration(claim)).toEqual({received:true});
 const pending=await accounts.pendingRegistrations(admin);expect(pending).toHaveLength(1);
 expect((await db.query('SELECT * FROM identity.users WHERE username=$1',[claim.username])).rows).toHaveLength(0);
 await expect(accounts.registrationDecision({...admin,id:randomUUID()},{kind:'approve_registration',requestId:pending[0].id,
  grants:[{projectId:ids.sales,role:'engineer',reportPermissions:[]}],reason:'Xác nhận Team Tech'})).rejects.toMatchObject({code:'ACCOUNT_ADMIN_REQUIRED'});
 await expect(accounts.registrationDecision(admin,{kind:'approve_registration',requestId:pending[0].id,
  grants:[{projectId:ids.transport,role:'engineer',reportPermissions:[]}],reason:'Xác nhận Team Tech'})).rejects.toMatchObject({code:'SCOPE_DENIED'});
 const result=await accounts.registrationDecision(admin,{kind:'approve_registration',requestId:pending[0].id,
  grants:[{projectId:ids.sales,role:'engineer',reportPermissions:[]}],reason:'Đã kiểm danh tính nhóm Tech'});
 if(!('approvalId' in result)||!result.approvalId) throw new Error('approval not proposed');
 expect((await accounts.pendingRegistrations(admin))[0]).toMatchObject({approval_state:'pending',approval_agreed:0});
 expect((await db.query('SELECT * FROM identity.users WHERE username=$1',[claim.username])).rows).toHaveLength(0);
 const ballot=new AccountApprovalService(identity);
 await expect(ballot.pending(approvers[0].telegram,'-1001','group')).rejects.toMatchObject({code:'PRIVATE_CHAT_REQUIRED'});
 const reviewQueue=await ballot.pending(approvers[0].telegram,approvers[0].telegram,'private');
 expect(reviewQueue).toHaveLength(1);
 expect(reviewQueue[0]).toMatchObject({grant_details:[{name:'Cổng bán hàng mẫu',role:'engineer',reportPermissions:[]}]});
 expect((await identity.scope(async tx=>tx.query('SELECT name FROM projects WHERE id=$1',[ids.otherProject]))).rows).toHaveLength(0);
 for(const voter of approvers.slice(1,3)) {
  const vote=await ballot.vote(voter.telegram,voter.telegram,'private',result.approvalId,'agree');
  expect(vote.state).toBe('pending');
 }
 await expect(accounts.registrationDecision(admin,{kind:'issue_approved_registration',requestId:pending[0].id,
  reason:'Chưa có phiếu Chairman'})).rejects.toMatchObject({code:'APPROVAL_NOT_READY'});
 await expect(ballot.vote('123456789','123456789','private',result.approvalId,'agree'))
  .rejects.toMatchObject({code:'TELEGRAM_NOT_LINKED'});
 expect(await ballot.vote(approvers[0].telegram,approvers[0].telegram,'private',result.approvalId,'agree'))
  .toMatchObject({state:'approved',agreed:3,chairmanAgreed:true,bomAgreed:2});
 const issued=await accounts.registrationDecision(admin,{kind:'issue_approved_registration',requestId:pending[0].id,
  reason:'Đã đủ xác nhận của Chairman và BoM'});
 if(!('invitation' in issued)||!issued.invitation) throw new Error('approval did not issue an invitation');
 expect(issued.invitation.token).toHaveLength(43);
 expect(await accounts.pendingRegistrations(admin)).toHaveLength(0);
 await expect(accounts.registrationDecision(admin,{kind:'reject_registration',requestId:pending[0].id,
  reason:'Đã xử lý'})).rejects.toMatchObject({code:'REGISTRATION_NOT_PENDING'});
 const member=await identity.activate({token:issued.invitation.token,password:'Passphrase test Tech 2026!'});
 expect(member.principal.projectIds).toEqual([ids.sales]);
 const created=(await accounts.list(admin)).find(row=>row.username===claim.username)!;
 await expect(accounts.command(admin,{kind:'access',userId:created.id,expectedVersion:created.version,
  reason:'Thử nâng quyền ngoài phiếu',grants:[{projectId:ids.sales,role:'manager',reportPermissions:[]}]}))
  .rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 const code=await identity.pairingCode(member.principal);
 expect(await identity.pair(code.code,'1234567','1234567','private')).toEqual({linked:true});
});

test('registered username does not reveal whether an account exists; rejection creates no grant',async()=>{
 const existing={username:'chair-test',name:'Another',projectInterest:'LBRC',note:''};
 expect(await identity.requestRegistration(existing)).toEqual({received:true});
 expect(await accounts.pendingRegistrations(admin)).toHaveLength(0);
 await identity.requestRegistration({username:'candidate',name:'Ứng viên',projectInterest:'IBS HI',note:''});
 const pending=await accounts.pendingRegistrations(admin);
 await accounts.registrationDecision(admin,{kind:'reject_registration',requestId:pending[0].id,reason:'Không thuộc Team Tech'});
 expect((await db.query('SELECT * FROM identity.users WHERE username=$1',['candidate'])).rows).toHaveLength(0);
});

test('one-time pilot exception activates only its exact invitation; later registrations still need votes',async()=>{
 await identity.requestRegistration({username:'pilot.member',name:'Pilot Member',projectInterest:'LBRC',note:''});
 const request=(await accounts.pendingRegistrations(admin))[0];
 const memberId=randomUUID(),token=secret();
 await db.query(`INSERT INTO identity.users(id,tenant_id,username,name,role)
  VALUES($1,$2,'pilot.member','Pilot Member','viewer')`,[memberId,ids.tenant]);
 await db.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role)
  VALUES($1,$2,$3,'viewer')`,[ids.tenant,memberId,ids.sales]);
 const invitation=(await db.query<{id:string}>(`INSERT INTO identity.invitations
  (tenant_id,user_id,issuer_id,account_version,token_hash,expires_at)
  VALUES($1,$2,$3,1,$4,now()+interval '24 hours') RETURNING id`,
  [ids.tenant,memberId,admin.id,digest(token)])).rows[0];
 await db.query(`UPDATE identity.registration_requests SET state='approved',user_id=$2,
  reviewed_by=$3,reviewed_at=now(),updated_at=now() WHERE id=$1`,[request.id,memberId,admin.id]);
 await expect(identity.activate({token,password:'Passphrase test Tech 2026!'}))
  .rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 await db.query(`INSERT INTO identity.pilot_onboarding_exceptions
  (tenant_id,registration_id,user_id,invitation_id,authorized_by,batch_key,reason,expires_at)
  VALUES($1,$2,$3,$4,$5,'pilot-20261111','Chairman approved one-time pilot',now()+interval '24 hours')`,
  [ids.tenant,request.id,memberId,invitation.id,admin.id]);
 const activated=await identity.activate({token,password:'Passphrase test Tech 2026!'});
 expect(activated.principal.projectIds).toEqual([ids.sales]);
 expect((await db.query('SELECT count(*)::integer AS n FROM identity.account_approval_votes')).rows[0].n).toBe(0);
 await identity.requestRegistration({username:'later.member',name:'Later Member',projectInterest:'LBRC',note:''});
 expect((await accounts.pendingRegistrations(admin)).map(row=>row.username)).toEqual(['later.member']);
 expect((await db.query('SELECT count(*)::integer AS n FROM identity.pilot_onboarding_exceptions')).rows[0].n).toBe(1);
});

test('BoM rejection permits another BoM; direct invite and legacy invitation cannot bypass approval',async()=>{
 await identity.requestRegistration({username:'candidate',name:'Ứng viên Tech',projectInterest:'LibeTech',note:''});
 const request=(await accounts.pendingRegistrations(admin))[0];
 const proposed=await accounts.registrationDecision(admin,{kind:'approve_registration',requestId:request.id,
  grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}],reason:'Kiểm danh tính ứng viên'});
 if(!('approvalId' in proposed)||!proposed.approvalId) throw new Error('missing ballot');
 const ballot=new AccountApprovalService(identity);
 expect(await ballot.vote(approvers[1].telegram,approvers[1].telegram,'private',proposed.approvalId,'reject'))
  .toMatchObject({state:'pending',agreed:0});
 expect(await ballot.vote(approvers[0].telegram,approvers[0].telegram,'private',proposed.approvalId,'agree'))
  .toMatchObject({state:'pending',chairmanAgreed:true,bomAgreed:0});
 await expect(accounts.registrationDecision(admin,{kind:'issue_approved_registration',requestId:request.id,
  reason:'Thử bỏ qua phiếu'})).rejects.toMatchObject({code:'APPROVAL_NOT_READY'});
 await expect(accounts.command(admin,{kind:'invite',username:'direct-test',name:'Direct Test',
  grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}],reason:'Thử mời trực tiếp'}))
  .rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 const legacy=secret(),legacyId=randomUUID();
 await db.query(`INSERT INTO identity.users(id,tenant_id,username,name,role)
  VALUES($1,$2,'legacy-test','Legacy','viewer')`,[legacyId,ids.tenant]);
 await db.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role)
  VALUES($1,$2,$3,'viewer')`,[ids.tenant,legacyId,ids.sales]);
 await db.query(`INSERT INTO identity.invitations(tenant_id,user_id,issuer_id,account_version,token_hash,expires_at)
  VALUES($1,$2,$3,1,$4,now()+interval '1 hour')`,[ids.tenant,legacyId,admin.id,digest(legacy)]);
 await expect(identity.activate({token:legacy,password:'Passphrase test Tech 2026!'}))
  .rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
 expect(await ballot.vote(approvers[2].telegram,approvers[2].telegram,'private',proposed.approvalId,'agree'))
  .toMatchObject({state:'approved',chairmanAgreed:true,bomAgreed:1});
});

test('one verified BoM is sufficient; Chairman rejection closes the ballot',async()=>{
 await db.query("DELETE FROM identity.account_approval_seats WHERE seat IN ('bom_quan','bom_phuong')");
 await identity.requestRegistration({username:'single-bom',name:'Một BoM',projectInterest:'LibeTech',note:''});
 const request=(await accounts.pendingRegistrations(admin))[0];
 const proposed=await accounts.registrationDecision(admin,{kind:'approve_registration',requestId:request.id,
  grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}],reason:'Xác minh Team Tech'});
 if(!('approvalId' in proposed)||!proposed.approvalId) throw new Error('missing ballot');
 const ballot=new AccountApprovalService(identity);
 expect(await ballot.vote(approvers[1].telegram,approvers[1].telegram,'private',proposed.approvalId,'agree'))
  .toMatchObject({state:'pending',chairmanAgreed:false,bomAgreed:1});
 expect(await ballot.vote(approvers[0].telegram,approvers[0].telegram,'private',proposed.approvalId,'agree'))
  .toMatchObject({state:'approved',chairmanAgreed:true,bomAgreed:1});
 await identity.requestRegistration({username:'chair-reject',name:'Chair Reject',projectInterest:'LibeTech',note:''});
 const second=(await accounts.pendingRegistrations(admin)).find(row=>row.username==='chair-reject')!;
 const proposal2=await accounts.registrationDecision(admin,{kind:'approve_registration',requestId:second.id,
  grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}],reason:'Xác minh Team Tech'});
 if(!('approvalId' in proposal2)||!proposal2.approvalId) throw new Error('missing ballot');
 expect(await ballot.vote(approvers[0].telegram,approvers[0].telegram,'private',proposal2.approvalId,'reject'))
  .toMatchObject({state:'rejected'});
 await expect(ballot.vote(approvers[1].telegram,approvers[1].telegram,'private',proposal2.approvalId,'agree'))
  .rejects.toMatchObject({code:'APPROVAL_CLOSED'});
});

test('an unavailable BoM seat does not block the other verified BoM',async()=>{
 await db.query('UPDATE identity.users SET active=false WHERE id=$1',[approvers[1].id]);
 await identity.requestRegistration({username:'available-bom',name:'BoM dự phòng',projectInterest:'LibeTech',note:''});
 const request=(await accounts.pendingRegistrations(admin))[0];
 const proposed=await accounts.registrationDecision(admin,{kind:'approve_registration',requestId:request.id,
  grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}],reason:'Xác minh Team Tech'});
 if(!('approvalId' in proposed)||!proposed.approvalId) throw new Error('missing ballot');
 const ballot=new AccountApprovalService(identity);
 expect(await ballot.vote(approvers[0].telegram,approvers[0].telegram,'private',proposed.approvalId,'agree'))
  .toMatchObject({state:'pending',chairmanAgreed:true});
 expect(await ballot.vote(approvers[2].telegram,approvers[2].telegram,'private',proposed.approvalId,'agree'))
  .toMatchObject({state:'approved',chairmanAgreed:true,bomAgreed:1});
});

test('web Yes/No and Telegram share the same frozen ballot and two-person quorum',async()=>{
 await identity.requestRegistration({username:'web-vote',name:'Web Vote',projectInterest:'LBRC',note:''});
 const request=(await accounts.pendingRegistrations(admin))[0];
 const proposed=await accounts.registrationDecision(admin,{kind:'approve_registration',requestId:request.id,
  grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}],reason:'Xác nhận Team Tech'});
 if(!('approvalId' in proposed)||!proposed.approvalId) throw Error('missing ballot');
 const ballot=new AccountApprovalService(identity);
 const outsider={...admin,id:randomUUID(),accountAdmin:false};
 await expect(ballot.pendingForPrincipal(outsider)).rejects.toMatchObject({code:'APPROVER_REQUIRED'});
 await expect(ballot.voteForPrincipal(outsider,proposed.approvalId,'agree'))
  .rejects.toMatchObject({code:'APPROVER_REQUIRED'});
 expect(await ballot.pendingForPrincipal(admin)).toHaveLength(1);
 expect(await ballot.voteForPrincipal(admin,proposed.approvalId,'agree'))
  .toMatchObject({state:'pending',chairmanAgreed:true,bomAgreed:0});
 await expect(ballot.voteForPrincipal(admin,proposed.approvalId,'reject'))
  .rejects.toMatchObject({code:'VOTE_LOCKED'});
 expect(await ballot.vote(approvers[1].telegram,approvers[1].telegram,'private',proposed.approvalId,'agree'))
  .toMatchObject({state:'approved',chairmanAgreed:true,bomAgreed:1});
 expect(await ballot.pendingForPrincipal(admin)).toHaveLength(0);
});

test('newly linked BoM seat does not invalidate an existing frozen ballot',async()=>{
 await db.query("DELETE FROM identity.account_approval_seats WHERE seat='bom_phuong'");
 await identity.requestRegistration({username:'additive-bom',name:'Thêm BoM',projectInterest:'LibeTech',note:''});
 const request=(await accounts.pendingRegistrations(admin))[0];
 const proposed=await accounts.registrationDecision(admin,{kind:'approve_registration',requestId:request.id,
  grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}],reason:'Xác minh Team Tech'});
 if(!('approvalId' in proposed)||!proposed.approvalId) throw new Error('missing ballot');
 await db.query('INSERT INTO identity.account_approval_seats(tenant_id,seat,user_id) VALUES($1,$2,$3)',
  [ids.tenant,'bom_phuong',approvers[3].id]);
 const ballot=new AccountApprovalService(identity);
 await ballot.vote(approvers[0].telegram,approvers[0].telegram,'private',proposed.approvalId,'agree');
 expect(await ballot.vote(approvers[1].telegram,approvers[1].telegram,'private',proposed.approvalId,'agree'))
  .toMatchObject({state:'approved'});
});

test('feedback is idempotent, project scoped and hidden from other members',async()=>{
 const service=new FeedbackService(db),member={...admin,id:randomUUID(),role:'engineer' as const,
  accountAdmin:false,grants:[{projectId:ids.sales,role:'engineer' as const,reportPermissions:[]}]};
 await db.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash)
  VALUES($1,$2,'member-test','Member','engineer','test-fixture')`,[member.id,ids.tenant]);
 await db.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash)
  VALUES($1,$2,'other-test','Other','engineer','test-fixture')`,[randomUUID(),ids.tenant]);
 const input={projectId:ids.sales,requestKey:randomUUID(),kind:'bug',title:'Lỗi trang dự án',
  description:'Mở trang công việc và bấm làm mới thì xuất hiện lỗi.',pagePath:'/work',expected:'Hiện danh sách việc',actual:'Trang báo lỗi'};
 const first=await service.create(member,input);expect(first.replayed).toBe(false);
 expect(await service.create(member,input)).toEqual({id:first.id,replayed:true});
 await expect(service.create(member,{...input,title:'Đổi nội dung'})).rejects.toMatchObject({code:'FEEDBACK_KEY_CONFLICT'});
 await expect(service.create(member,{...input,projectId:ids.transport,requestKey:randomUUID()})).rejects.toMatchObject({code:'SCOPE_DENIED'});
 expect(await service.list(member)).toHaveLength(1);
 expect(await service.list(admin)).toHaveLength(1);
 const other={...member,id:randomUUID()};expect(await service.list(other)).toHaveLength(0);
 const decision={projectId:ids.sales,reportId:first.id,requestKey:randomUUID(),expectedVersion:1,
  state:'reviewing',reason:'Đã tái hiện lỗi trên tài khoản thử'};
 await expect(service.resolve(member,decision)).rejects.toMatchObject({code:'FEEDBACK_MANAGER_REQUIRED'});
 const accepted=await service.resolve(admin,decision);expect(accepted.replayed).toBe(false);
 expect(await service.resolve(admin,decision)).toEqual({id:accepted.id,replayed:true});
 await expect(service.resolve(admin,{...decision,requestKey:randomUUID()})).rejects.toMatchObject({code:'VERSION_CONFLICT'});
 expect((await service.list(member))[0]).toMatchObject({state:'reviewing',version:2});
});
