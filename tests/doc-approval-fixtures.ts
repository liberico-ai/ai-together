import {randomUUID} from 'node:crypto';
import {openHarness,type Harness} from './slice1-db';
import {seedSlice1,member} from './slice1-fixtures';
import {seedMembers,transportApprover} from './slice3-fixtures';
import {provisionApprovers} from './account-approval-fixture';
import {botKey,signedRequest} from './slice2-fixtures';
import {IdentityService} from '../src/server/identity';
import {AccountService} from '../src/server/accounts';
import {AccountApprovalService} from '../src/server/account-approval';
import {DocApprovalProposalService,type DocApprovalProposal} from '../src/server/doc-approval-proposals';
import {handleBridge} from '../src/server/bridge';
import {ids} from '../src/server/identities';
import type {Database,Queryable} from '../src/server/db';
import type {Principal,ProjectGrant} from '../src/server/types';

// Synthetic world for the Task 7c coordinator-proposal cases. Rebuilt for every case (F5): on PGlite `reset()` does nothing, the hourly
// throttle commits on its own and each person may hold one open ballot, so a shared world would leak state between cases.
export type World={h:Harness;identity:IdentityService;accounts:AccountService;ballots:AccountApprovalService;proposals:DocApprovalProposalService;
  admin:Principal;approvers:{seat:string;id:string;telegram:string}[];coordinator:Principal;coManager:Principal;seatCoordinator:Principal;
  subject:Principal;transportMember:Principal};

async function account(h:Harness,id:string,username:string,name:string,role:ProjectGrant['role'],roles:[string,ProjectGrant['role']][]) {
  await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,$4,$5,'fixture-hash')`,[id,ids.tenant,username,name,role]);
  for(const [project,projectRole] of roles) await h.operator.query(
    'INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,$4)',[ids.tenant,id,project,projectRole]);
}

export async function openWorld():Promise<World> {
  const h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);
  const adminId=randomUUID();
  const identity=new IdentityService(h.operator,ids.tenant,adminId);
  await account(h,adminId,'da-admin','Quản trị tài khoản mẫu','manager',[[ids.sales,'manager'],[ids.transport,'manager']]);
  const admin:Principal={id:adminId,tenantId:ids.tenant,name:'Quản trị tài khoản mẫu',role:'manager',projectIds:[ids.sales,ids.transport],accountAdmin:true,
    grants:[{projectId:ids.sales,role:'manager',reportPermissions:[]},{projectId:ids.transport,role:'manager',reportPermissions:[]}]};
  const approvers=await provisionApprovers(h.operator,identity,adminId,ids.sales);
  const coordinatorId=randomUUID(),coManagerId=randomUUID();
  await account(h,coordinatorId,'da-coordinator','Điều phối mẫu','manager',[[ids.sales,'manager'],[ids.transport,'viewer']]);
  await account(h,coManagerId,'da-comanager','Đồng điều phối mẫu','manager',[[ids.sales,'manager']]);
  const coordinator:Principal={id:coordinatorId,tenantId:ids.tenant,name:'Điều phối mẫu',role:'viewer',projectIds:[ids.sales,ids.transport],
    grants:[{projectId:ids.sales,role:'manager',reportPermissions:[]},{projectId:ids.transport,role:'viewer',reportPermissions:[]}]};
  const coManager:Principal={id:coManagerId,tenantId:ids.tenant,name:'Đồng điều phối mẫu',role:'manager',projectIds:[ids.sales],
    grants:[{projectId:ids.sales,role:'manager',reportPermissions:[]}]};
  // the account behind seat bom_chu becomes a manager of ids.sales
  await h.operator.query("UPDATE identity.memberships SET project_role='manager' WHERE user_id=$1 AND project_id=$2",[approvers[1].id,ids.sales]);
  const seatName=(await h.operator.query<{name:string}>('SELECT name FROM identity.users WHERE id=$1',[approvers[1].id])).rows[0].name;
  const seatCoordinator:Principal={id:approvers[1].id,tenantId:ids.tenant,name:seatName,role:'manager',projectIds:[ids.sales],
    grants:[{projectId:ids.sales,role:'manager',reportPermissions:[]}]};
  return {h,identity,accounts:new AccountService(identity),ballots:new AccountApprovalService(identity),proposals:new DocApprovalProposalService(identity),
    admin,approvers,coordinator,coManager,seatCoordinator,subject:member,transportMember:transportApprover};
}

export const BASIS='Cần người duyệt bản thiết kế của dự án';
export const propose=(w:World,p:Principal,over:Record<string,unknown>={}):Promise<DocApprovalProposal>=>
  w.proposals.propose(p,{projectId:ids.sales,userId:w.subject.id,docTypes:['design'],expectedTypes:[],reason:BASIS,...over});
export const say=(w:World,seat:number,approvalId:string,choice:'agree'|'reject'='agree')=>
  w.ballots.vote(w.approvers[seat].telegram,w.approvers[seat].telegram,'private',approvalId,choice);
export const rows=async<T=Record<string,unknown>>(w:World,sql:string,params:unknown[]=[]):Promise<T[]>=>(await w.h.operator.query<T>(sql,params)).rows;
export const snapshot=async(w:World)=>{
  const n=async(table:string)=>Number((await rows<{n:string}>(w,`SELECT count(*) n FROM ${table}`))[0].n);
  return {approvals:await n('identity.account_approvals'),voters:await n('identity.account_approval_voters'),outbox:await n('outbox_messages'),events:await n('identity.events')};
};
export const refusal=async(run:Promise<unknown>):Promise<{code?:string;status?:number;message?:string}>=>{
  try{await run;}catch(e){const x=e as {code?:string;status?:number;message?:string};return {code:x.code,status:x.status,message:x.message};}
  throw new Error('expected a refusal, the call succeeded');
};
export const setProjectRole=async(w:World,userId:string,projectId:string,role:ProjectGrant['role']|null)=>{
  if(role===null) {await w.h.operator.query('DELETE FROM identity.memberships WHERE user_id=$1 AND project_id=$2',[userId,projectId]);return;}
  await w.h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,$4)
   ON CONFLICT(tenant_id,user_id,project_id) DO UPDATE SET project_role=$4,updated_at=now()`,[ids.tenant,userId,projectId,role]);
};
export const applyFrozen=async(w:World,userId:string,over:Record<string,unknown>={})=>{
  const ballot=(await rows<{grants:ProjectGrant[]}>(w,`SELECT grants FROM identity.account_approvals WHERE kind='access_change' AND subject_user_id=$1
   AND state='approved' AND expires_at>now() ORDER BY created_at DESC LIMIT 1`,[userId]))[0];
  if(!ballot) throw new Error('no approved ballot');
  const listed=(await w.accounts.list(w.admin)).find(row=>row.id===userId);
  if(!listed) throw new Error('account not listed');
  return w.accounts.command(w.admin,{kind:'access',userId,expectedVersion:listed.version,reason:'Áp đúng bộ quyền đã được duyệt',grants:ballot.grants,...over});
};
export const resetThrottle=async(w:World)=>{await w.h.operator.query('DELETE FROM identity.throttle');};
export const identityOn=(w:World,db:Database)=>new IdentityService(db,ids.tenant,w.admin.id);
/** Throws `error` (a prebuilt error object) at the first statement whose text matches `pattern`, in or out of a transaction. */
export const failingStatement=(db:Database,pattern:RegExp,error:unknown):Database=>{
  let fired=false;
  const wrap=(q:Queryable):Queryable=>({query:async<T=Record<string,unknown>>(sql:string,params?:unknown[])=>{
    if(!fired&&pattern.test(sql)){fired=true;throw error;}
    return q.query<T>(sql,params);
  }});
  return {...wrap(db),transaction:fn=>db.transaction(tx=>fn(wrap(tx))),close:()=>db.close()};
};
/** `hook` runs INSIDE the service's own transaction, with that transaction's Queryable, just before the first statement that matches `pattern`;
 * it receives that statement and its parameters. It builds a REAL constraint conflict on PGlite and on PostgreSQL alike. */
export const beforeStatementInTx=(db:Database,pattern:RegExp,hook:(tx:Queryable,sql:string,params:unknown[]|undefined)=>Promise<void>):Database=>{
  let fired=false;
  return {...db,transaction:fn=>db.transaction(tx=>fn({query:async<T=Record<string,unknown>>(sql:string,params?:unknown[])=>{
    if(!fired&&pattern.test(sql)){fired=true;await hook(tx,sql,params);}
    return tx.query<T>(sql,params);
  }})),close:()=>db.close()};
};
/** One private-chat call through the signed bot bridge. */
export const bridgeCall=(w:World,telegramId:string,body:Record<string,unknown>)=>{
  const context={telegramId,chatId:telegramId,chatType:'private',profile:'libetech',messageId:'1'};
  return handleBridge(signedRequest('/api/bridge',{...body,context},{key:botKey}),w.h.db,w.identity,botKey,{});
};
