import { beforeAll,afterAll,test,expect } from 'vitest';
import { randomUUID,createHmac } from 'node:crypto';
import { AccountService } from '../src/server/accounts';
import { embeddedDatabase,type Database } from '../src/server/db';
import { IdentityService,passwordHash,secret } from '../src/server/identity';
import { handleBridge,signingText } from '../src/server/bridge';
import { calculateEvidenceReport } from '../src/server/evidence-scores';
import { projectEvidence } from '../src/server/evidence-projector';
import { ReportService } from '../src/server/reports';
import { ids } from '../src/server/identities';
import { WorkService } from '../src/server/service';
import type { Principal,ProjectGrant } from '../src/server/types';
import { seed } from '../src/server/seed';
import { calendarSchema,workingDueAt } from '../src/server/working-time';
import { scoreFixture } from './spec003-fixtures';
import {approvedRegistration,provisionApprovers} from './account-approval-fixture';

const password='Synthetic spec003 password';
const adminId=randomUUID();
const request=(data:unknown,key:string)=>{
  const raw=JSON.stringify(data),time=String(Date.now()),nonce=secret();
  return new Request('http://127.0.0.1/api/bridge',{method:'POST',body:raw,headers:{
    'x-libetech-timestamp':time,'x-libetech-nonce':nonce,
    'x-libetech-signature':createHmac('sha256',key).update(signingText(time,nonce,raw)).digest('hex'),
  }});
};
let db:Database,identity:IdentityService,accounts:AccountService,admin:Principal;
let approvers:Awaited<ReturnType<typeof provisionApprovers>>;
const viewer:ProjectGrant[]=[{projectId:ids.sales,role:'viewer',reportPermissions:[]}];
async function invite(username:string,grants=viewer){
  return approvedRegistration(identity,accounts,admin,approvers,username,grants);
}
beforeAll(async()=>{
  db=await embeddedDatabase();
  await seed(db);
  identity=new IdentityService(db,ids.tenant,adminId);
  accounts=new AccountService(identity);
  await db.query("INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'tester-admin','Test admin','manager',$3)",
    [adminId,ids.tenant,await passwordHash(password)]);
  await db.query("INSERT INTO identity.memberships(tenant_id,user_id,project_id,report_permissions) VALUES($1,$2,$3,ARRAY['quality_review','people_read','report_approve'])",
    [ids.tenant,adminId,ids.sales]);
  admin=(await identity.login({username:'tester-admin',password})).principal;
  approvers=await provisionApprovers(db,identity,adminId,ids.sales);
});
afterAll(async()=>{await db.close();});

test('invites expire when replaced, private bridge pairing uses current project rights, disabled account loses access',async()=>{
  const pending=await invite('spec003-member');
  await expect(accounts.command(admin,{kind:'invite',username:'spec003-member',name:'Duplicate',reason:'Check duplicate',grants:viewer}))
    .rejects.toMatchObject({code:'TELEGRAM_APPROVAL_REQUIRED'});
  await identity.requestRegistration({username:'outside-project',name:'Outside Project',projectInterest:'Team Tech',note:''});
  const outside=(await accounts.pendingRegistrations(admin)).find(row=>row.username==='outside-project');
  await expect(accounts.registrationDecision(admin,{kind:'approve_registration',requestId:outside?.id,
    grants:[{projectId:ids.transport,role:'viewer',reportPermissions:[]}],reason:'Ngoài phạm vi'}))
    .rejects.toMatchObject({code:'SCOPE_DENIED'});
  const fresh=await accounts.command(admin,{kind:'reissue',userId:pending.user.id,expectedVersion:pending.user.version,reason:'Đổi mã kích hoạt'});
  await expect(identity.activate({token:pending.invitation!.token,password})).rejects.toMatchObject({code:'INVITATION_INVALID'});
  const session=await identity.activate({token:fresh.invitation!.token,password});
  expect(session.principal.grants).toMatchObject(viewer);
  await expect(accounts.list(session.principal)).rejects.toMatchObject({code:'ACCOUNT_ADMIN_REQUIRED'});
  const link=await identity.pairingCode(session.principal),key=secret(),telegramId='12340090';
  const context={telegramId,chatId:telegramId,chatType:'private',profile:'libetech',messageId:'42'};
  await expect(handleBridge(request({operation:'pair',context:{...context,chatType:'group',chatId:'-1001'},code:link.code},key),db,identity,key,{}))
    .rejects.toMatchObject({code:'PRIVATE_CHAT_REQUIRED'});
  expect(await handleBridge(request({operation:'pair',context,code:link.code},key),db,identity,key,{})).toEqual({linked:true});
  expect((await identity.telegramPrincipal(telegramId)).projectIds).toEqual([ids.sales]);
  await expect(accounts.command(admin,{kind:'disable',userId:pending.user.id,expectedVersion:pending.user.version,reason:'Thử bản cũ'}))
    .rejects.toMatchObject({code:'VERSION_CONFLICT'});
  await accounts.command(admin,{kind:'disable',userId:pending.user.id,expectedVersion:fresh.user.version,reason:'Thử thu hồi quyền'});
  await expect(identity.session(session.token)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
  await expect(identity.telegramPrincipal(telegramId)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
});

test('a manager for one project cannot create or mutate a work item outside that role',async()=>{
  const service=new WorkService(db);
  const p={...admin,projectIds:[ids.sales,ids.transport],grants:[{projectId:ids.sales,role:'manager' as const,reportPermissions:[]},
    {projectId:ids.transport,role:'viewer' as const,reportPermissions:[]}]};
  await expect(service.command(p,ids.transportWork,{kind:'close_ticket',expectedVersion:1,ticketRef:'TK-X',note:'Kiểm phạm vi'},'spec003-scope'))
    .rejects.toMatchObject({code:'READ_ONLY'});
});

test('score projection dedupes evidence, distinguishes missing data, scopes people and audits correction',async()=>{
  const pending=await invite('spec003-scorer');
  const session=await identity.activate({token:pending.invitation!.token,password});
  const input=scoreFixture(ids.tenant,ids.sales,session.principal,admin.id);
  const calculated=calculateEvidenceReport(input).people.get(session.principal.id)!;
  expect(calculated.total).toBe(54.17);
  expect(calculated.metrics[1]).toMatchObject({numerator:1,denominator:2,missing:1});
  expect(calculated.metrics[3]).toMatchObject({numerator:1,denominator:2});
  expect(calculated.metrics[1].evidenceIds).not.toContain('ack-0');
  const lowerCoverage=structuredClone(input);lowerCoverage.policy.coverage=1;
  expect(calculateEvidenceReport(lowerCoverage).people.get(session.principal.id)?.total).toBeNull();
  await expect(projectEvidence(db,input)).rejects.toMatchObject({code:'SYNTHETIC_DENIED'});
  const run=await projectEvidence(db,input,{allowSynthetic:true});
  expect(await projectEvidence(db,input,{allowSynthetic:true})).toMatchObject({runId:run.runId,replayed:true});
  const reports=new ReportService(db,true);
  const self=await reports.read(session.principal,{projectId:ids.sales});
  expect(self.person?.result.total).toBe(54.17);
  expect(self.project?.contributions.map(row=>row.evidenceId)).toContain('reply-0');
  await expect(reports.read(session.principal,{projectId:ids.sales,subjectId:admin.id})).rejects.toMatchObject({code:'SCOPE_DENIED'});
  await expect(reports.read(session.principal,{projectId:ids.transport,runId:run.runId})).rejects.toMatchObject({code:'SCOPE_DENIED'});
  const userId=session.principal.id,requestKey=randomUUID();
  const correction={projectId:ids.sales,runId:run.runId,subjectId:userId,kind:'correction',requestKey,reason:'Đề nghị kiểm lại nguồn'};
  expect(await reports.command(session.principal,correction)).toMatchObject({replayed:false});
  expect(await reports.command(session.principal,correction)).toMatchObject({replayed:true});
  await expect(reports.command(admin,{...correction,kind:'approval',requestKey:randomUUID()})).rejects.toMatchObject({code:'APPROVAL_NOT_READY'});
  await expect(reports.command(session.principal,{...correction,kind:'quality_review',criteria:[true,true,true],evidenceId:'reply-0'}))
    .rejects.toMatchObject({code:'REPORT_ACTION_DENIED'});
});

test('SLA spans the weekend and configured holidays in Vietnam time',()=>{
  const calendar=calendarSchema.parse({version:'fixture-calendar',zone:'Asia/Ho_Chi_Minh',holidays:[],
    days:[1,2,3,4,5].map(weekday=>({weekday,windows:[{from:540,to:1020}]}))});
  expect(workingDueAt('2026-11-13T16:30:00+07:00',60,calendar)).toBe('2026-11-16T02:30:00.000Z');
  expect(workingDueAt('2026-11-13T16:30:00+07:00',60,{...calendar,holidays:['2026-11-16']})).toBe('2026-11-17T02:30:00.000Z');
});
