import {randomUUID} from 'node:crypto';
import type {Database} from '../src/server/db';
import {IdentityService} from '../src/server/identity';
import {AccountService} from '../src/server/accounts';
import {AccountApprovalService} from '../src/server/account-approval';
import type {Principal,ProjectGrant} from '../src/server/types';

export async function provisionApprovers(db:Database,identity:IdentityService,adminId:string,projectId:string) {
 const rows=[
  {seat:'chairman',id:adminId,telegram:'900001'},
  ...(['bom_chu','bom_quan','bom_phuong'] as const).map((seat,index)=>({
   seat,id:randomUUID(),telegram:String(900002+index),
  })),
 ];
 for(const row of rows) {
  if(row.seat!=='chairman') {
   await db.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash)
    VALUES($1,$2,$3,$4,'viewer','fixture-hash')`,
    [row.id,identity.tenantId,row.seat,row.seat]);
   await db.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role)
    VALUES($1,$2,$3,'viewer')`,[identity.tenantId,row.id,projectId]);
  }
  await db.query(`INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id)
   VALUES($1,$2,$3)`,[identity.tenantId,row.id,row.telegram]);
  await db.query(`INSERT INTO identity.account_approval_seats(tenant_id,seat,user_id)
   VALUES($1,$2,$3)`,[identity.tenantId,row.seat,row.id]);
 }
 return rows;
}

export async function approvedRegistration(
 identity:IdentityService,accounts:AccountService,admin:Principal,
 voters:{seat:string;id:string;telegram:string}[],username:string,grants:ProjectGrant[],
) {
 await identity.requestRegistration({username,name:username,projectInterest:'Team Tech',note:''});
 const request=(await accounts.pendingRegistrations(admin)).find(row=>row.username===username);
 if(!request) throw new Error('registration not found');
 const proposed=await accounts.registrationDecision(admin,{kind:'approve_registration',requestId:request.id,
  grants,reason:'Đã kiểm danh tính Team Tech'});
 if(!('approvalId' in proposed)||!proposed.approvalId) throw new Error('approval not proposed');
 const service=new AccountApprovalService(identity);
 for(const voter of voters.slice(0,2)) await service.vote(voter.telegram,voter.telegram,'private',proposed.approvalId,'agree');
 const issued=await accounts.registrationDecision(admin,{kind:'issue_approved_registration',requestId:request.id,
  reason:'Đủ xác nhận của Chairman và một thành viên BoM'});
 if(!('invitation' in issued)||!issued.invitation||!('user' in issued)||!issued.user)
  throw new Error('invitation not issued');
 return issued;
}
