import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { invariant } from './errors';
import { digest, IdentityService, secret } from './identity';
import type { Queryable } from './db';
import type { Principal, ProjectGrant } from './types';
import {approvalReady,notifyVoters,verifiedApprovalSeats} from './account-approval';
import {widensAccess} from './access-grants';

const grantsSchema=z.array(z.object({
  projectId:z.uuid(),role:z.enum(['manager','engineer','technical','business','viewer']),
  reportPermissions:z.array(z.enum(['people_read','quality_review','report_approve'])).max(3),
}).strict()).min(1).max(30).refine(grants=>new Set(grants.map(grant=>grant.projectId)).size===grants.length);
const reason=z.string().trim().min(5).max(500);
const edit={userId:z.uuid(),expectedVersion:z.number().int().positive(),reason};
const commandSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('invite'),username:z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/),
    name:z.string().trim().min(2).max(100),grants:grantsSchema,reason}).strict(),
  z.object({kind:z.literal('access'),...edit,grants:grantsSchema}).strict(),
  z.object({kind:z.literal('propose_access_change'),...edit,grants:grantsSchema}).strict(),
  z.object({kind:z.enum(['reissue','cancel','disable','enable','revoke_sessions','unlink_github']),...edit}).strict(),
  z.object({kind:z.literal('verify_github'),...edit,githubId:z.string().regex(/^[1-9][0-9]{0,19}$/),
    sourceId:z.url({protocol:/^https$/}).max(800).refine(value=>{
      const url=new URL(value);
      return !url.username&&!url.password&&!url.search&&!url.hash;
    })}).strict(),
]);
type Account={id:string;username:string;name:string;active:boolean;activated:boolean;version:number};
const summary='id,username,name,active,password_hash IS NOT NULL AS activated,account_version AS version';
const reviewRegistration=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('approve_registration'),requestId:z.uuid(),grants:grantsSchema,reason}).strict(),
 z.object({kind:z.literal('issue_approved_registration'),requestId:z.uuid(),reason}).strict(),
 z.object({kind:z.literal('reject_registration'),requestId:z.uuid(),reason}).strict(),
]);
/** Grants compared as a set: entries ordered by projectId, report permissions ordered within each entry. */
function sameGrants(a:ProjectGrant[],b:ProjectGrant[]) {
 const norm=(grants:ProjectGrant[])=>JSON.stringify([...grants]
  .map(grant=>({projectId:grant.projectId,role:grant.role,reportPermissions:[...grant.reportPermissions].sort()}))
  .sort((x,y)=>x.projectId<y.projectId?-1:x.projectId>y.projectId?1:0));
 return norm(a)===norm(b);
}

export class AccountService {
  // notify is replaceable only so tests can fail a proposal right after its DMs are queued; production uses notifyVoters.
  constructor(private identity:IdentityService,private notify:typeof notifyVoters=notifyVoters) {}

  private async operator(tx:Queryable,p:Principal) {
    invariant(p.tenantId===this.identity.tenantId && p.role!=='bot' && p.id===this.identity.adminId,
      'ACCOUNT_ADMIN_REQUIRED','Cần quyền quản trị tài khoản.',403);
    const active=await tx.query('SELECT id FROM identity.users WHERE id=$1 AND active AND password_hash IS NOT NULL FOR UPDATE',[p.id]);
    invariant(active.rows.length,'ACCOUNT_ADMIN_REQUIRED','Cần quyền quản trị tài khoản.',403);
    return new Set((await this.identity.grants(tx,p.id)).map(grant=>grant.projectId));
  }

  private validate(grants:ProjectGrant[],scope:Set<string>) {
    invariant(grants.length && grants.every(grant=>scope.has(grant.projectId)),
      'SCOPE_DENIED','Dự án ngoài phạm vi quản trị.',403);
  }

  async list(p:Principal) {
    return this.identity.scope(async tx=>{
      const scope=await this.operator(tx,p);
      const rows=(await tx.query<Account>(`SELECT ${summary} FROM identity.users u WHERE id<>$1
        AND EXISTS (SELECT 1 FROM identity.memberships WHERE user_id=u.id)
        AND NOT EXISTS (SELECT 1 FROM identity.memberships WHERE user_id=u.id AND NOT project_id=ANY($2::uuid[]))
        ORDER BY username LIMIT 200`,[p.id,[...scope]])).rows;
      return Promise.all(rows.map(async user=>({...user,grants:await this.identity.grants(tx,user.id),
        githubId:(await tx.query<{github_id:string}>('SELECT github_id FROM identity.github_links WHERE user_id=$1 AND ended_at IS NULL',[user.id])).rows[0]?.github_id??null})));
    });
  }

  async pendingRegistrations(p:Principal) {
    return this.identity.scope(async tx=>{
      await this.operator(tx,p);
      return (await tx.query<{id:string;username:string;name:string;project_interest:string;note:string;created_at:string;
        approval_id:string|null;approval_state:string|null;approval_agreed:number;chairman_agreed:boolean;bom_agreed:number;approval_grants:ProjectGrant[]|null}>(`
        SELECT r.id,r.username,r.name,r.project_interest,r.note,r.created_at,
          a.id AS approval_id,a.state AS approval_state,a.grants AS approval_grants,
          (SELECT count(*)::integer FROM identity.account_approval_votes v
             WHERE v.approval_id=a.id AND v.choice='agree') AS approval_agreed,
          EXISTS(SELECT 1 FROM identity.account_approval_votes v
             JOIN identity.account_approval_voters av ON av.approval_id=v.approval_id AND av.user_id=v.voter_id
             WHERE v.approval_id=a.id AND av.seat='chairman' AND v.choice='agree') AS chairman_agreed,
          (SELECT count(*)::integer FROM identity.account_approval_votes v
             JOIN identity.account_approval_voters av ON av.approval_id=v.approval_id AND av.user_id=v.voter_id
             WHERE v.approval_id=a.id AND av.seat<>'chairman' AND v.choice='agree') AS bom_agreed
        FROM identity.registration_requests r
        LEFT JOIN LATERAL (SELECT id,state,grants FROM identity.account_approvals
          WHERE registration_id=r.id ORDER BY created_at DESC LIMIT 1) a ON true
        WHERE r.state='pending' ORDER BY r.created_at LIMIT 100`)).rows;
    });
  }

  async registrationDecision(p:Principal,input:unknown) {
    const cmd=reviewRegistration.parse(input);
    return this.identity.scope(async tx=>{
      const scope=await this.operator(tx,p);
      const req=(await tx.query<{id:string;username:string;name:string}>(`
        SELECT id,username,name FROM identity.registration_requests WHERE id=$1 AND state='pending' FOR UPDATE`,
        [cmd.requestId])).rows[0];
      invariant(req,'REGISTRATION_NOT_PENDING','Yêu cầu đã xử lý hoặc ngoài phạm vi.',409);
      if(cmd.kind==='reject_registration') {
        await tx.query(`UPDATE identity.account_approvals SET state='rejected',updated_at=now()
          WHERE registration_id=$1 AND state IN ('pending','approved')`,[req.id]);
        await tx.query(`UPDATE identity.registration_requests SET state='rejected',reviewed_by=$2,
          reviewed_at=now(),updated_at=now() WHERE id=$1`,[req.id,p.id]);
        await tx.query(`INSERT INTO identity.events(tenant_id,actor_id,kind,detail)
          VALUES($1,$2,'registration_rejected',$3)`,[p.tenantId,p.id,JSON.stringify({requestId:req.id,reason:cmd.reason})]);
        return {reviewed:true};
      }
      if(cmd.kind==='approve_registration') {
        this.validate(cmd.grants,scope);
        const traceId=randomUUID();
        const seats=await verifiedApprovalSeats(tx,this.identity);
        await tx.query(`UPDATE identity.account_approvals SET state='expired',updated_at=now()
          WHERE registration_id=$1 AND state IN ('pending','approved') AND expires_at<=now()`,[req.id]);
        const active=(await tx.query<{id:string}>(`SELECT id FROM identity.account_approvals
          WHERE registration_id=$1 AND state IN ('pending','approved','issued')`,[req.id])).rows[0];
        invariant(!active,'APPROVAL_PENDING','Đã có phiếu duyệt còn hiệu lực.',409);
        const proposal=(await tx.query<{id:string}>(`INSERT INTO identity.account_approvals
          (tenant_id,registration_id,proposer_id,grants,reason)
          VALUES($1,$2,$3,$4,$5) RETURNING id`,[p.tenantId,req.id,p.id,
          JSON.stringify(cmd.grants),cmd.reason])).rows[0];
        for(const seat of seats) await tx.query(`INSERT INTO identity.account_approval_voters
          (approval_id,tenant_id,seat,user_id) VALUES($1,$2,$3,$4)`,
          [proposal.id,p.tenantId,seat.seat,seat.user_id]);
        // SPEC-007 (a): one DM per frozen voter, in this same transaction.
        await this.notify(tx,this.identity,proposal.id,seats,traceId);
        await tx.query(`INSERT INTO identity.events(tenant_id,actor_id,kind,detail)
          VALUES($1,$2,'account_approval_proposed',$3)`,[p.tenantId,p.id,
          JSON.stringify({requestId:req.id,approvalId:proposal.id,grants:cmd.grants,reason:cmd.reason,traceId})]);
        return {pendingTelegramApproval:true,approvalId:proposal.id,agreed:0,required:'chairman+1bom'};
      }
      const approvalId=(await tx.query<{id:string}>(`SELECT id FROM identity.account_approvals
        WHERE registration_id=$1 AND state='approved' ORDER BY created_at DESC LIMIT 1`,[req.id])).rows[0]?.id;
      invariant(approvalId,'APPROVAL_NOT_READY','Chưa có đủ xác nhận của anh và một thành viên BoM.',409);
      const approval=await approvalReady(tx,this.identity,approvalId,'registration');
      const approvedGrants=grantsSchema.parse((await tx.query<{grants:ProjectGrant[]}>(
        'SELECT grants FROM identity.account_approvals WHERE id=$1',[approval.id])).rows[0].grants);
      this.validate(approvedGrants,scope);
      const user=(await tx.query<Account>(`INSERT INTO identity.users(tenant_id,username,name,role)
        VALUES($1,$2,$3,'viewer') ON CONFLICT(tenant_id,username) DO NOTHING RETURNING ${summary}`,
        [p.tenantId,req.username,req.name])).rows[0];
      invariant(user,'ACCOUNT_EXISTS','Tên đăng nhập đã có; xử lý trùng trước khi cấp lời mời.',409);
      await this.setGrants(tx,user.id,approvedGrants);
      const invitation=await this.issue(tx,p,user.id,user.version,approval.id);
      await tx.query(`UPDATE identity.account_approvals SET state='issued',updated_at=now()
        WHERE id=$1`,[approval.id]);
      await tx.query(`UPDATE identity.registration_requests SET state='approved',reviewed_by=$2,
        reviewed_at=now(),user_id=$3,updated_at=now() WHERE id=$1`,[req.id,p.id,user.id]);
      await this.audit(tx,p,user.id,'registration_approved',
        {requestId:req.id,approvalId:approval.id,reason:cmd.reason,grants:approvedGrants});
      return {user,invitation};
    });
  }

  private async setGrants(tx:Queryable,userId:string,grants:ProjectGrant[]) {
    await tx.query('DELETE FROM identity.memberships WHERE user_id=$1',[userId]);
    for(const grant of grants) {
      await tx.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role,report_permissions) VALUES($1,$2,$3,$4,$5)',
        [this.identity.tenantId,userId,grant.projectId,grant.role,[...new Set(grant.reportPermissions)]]);
    }
  }

  private async audit(tx:Queryable,p:Principal,userId:string,kind:string,detail:object) {
    await tx.query('INSERT INTO identity.events(tenant_id,user_id,actor_id,kind,detail) VALUES($1,$2,$3,$4,$5)',
      [this.identity.tenantId,userId,p.id,kind,JSON.stringify(detail)]);
  }

  private async issue(tx:Queryable,p:Principal,userId:string,version:number,approvalId:string) {
    const token=secret();
    await tx.query(`INSERT INTO identity.invitations(tenant_id,user_id,issuer_id,account_version,
      account_approval_id,token_hash,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,now()+interval '24 hours')`,
      [this.identity.tenantId,userId,p.id,version,approvalId,digest(token)]);
    return {token,expiresInHours:24};
  }

  async command(p:Principal,input:unknown) {
    const cmd=commandSchema.parse(input);
    return this.identity.scope(async tx=>{
      const scope=await this.operator(tx,p);
      if(cmd.kind==='invite'){
        invariant(false,'TELEGRAM_APPROVAL_REQUIRED','Thành viên mới cần đăng ký và xác nhận của Chairman cùng một thành viên BoM.',409);
      }

      invariant(cmd.userId!==p.id,'ACCOUNT_SCOPE_DENIED','Tài khoản quản trị được quản lý riêng.',403);
      const user=(await tx.query<Account>(`SELECT ${summary} FROM identity.users WHERE id=$1 FOR UPDATE`,[cmd.userId])).rows[0];
      invariant(user,'ACCOUNT_SCOPE_DENIED','Tài khoản ngoài phạm vi được cấp.',404);
      const before=await this.identity.grants(tx,user.id);
      this.validate(before,scope);
      invariant(user.version===cmd.expectedVersion,'VERSION_CONFLICT','Tài khoản đã thay đổi. Tải lại trước khi lưu.',409);
      if(cmd.kind==='propose_access_change') return this.proposeAccessChange(tx,p,scope,user,before,cmd.grants,cmd.reason);
      const nextVersion=user.version+1;
      let accessApprovalId:string|undefined;
      if(cmd.kind==='access') {
        invariant(user.activated,'TELEGRAM_APPROVAL_REQUIRED',
          'Tài khoản chờ kích hoạt cần trình lại phạm vi qua Chairman và một thành viên BoM.',409);
        this.validate(cmd.grants,scope);
        // Reducing access needs no ballot. Widening it needs an approved access-change ballot for this account, frozen at this
        // account version, whose grants are exactly these grants.
        if(widensAccess(before,cmd.grants)) {
          const ballot=(await tx.query<{id:string;grants:ProjectGrant[];subject_account_version:number;previous_grants:ProjectGrant[]}>(`SELECT id,grants,subject_account_version,previous_grants
            FROM identity.account_approvals WHERE kind='access_change' AND subject_user_id=$1 AND state='approved' AND expires_at>now()
            ORDER BY created_at DESC LIMIT 1`,[user.id])).rows[0];
          invariant(ballot&&ballot.subject_account_version===user.version&&sameGrants(grantsSchema.parse(ballot.grants),cmd.grants)
            &&sameGrants(grantsSchema.parse(ballot.previous_grants),before),
            'TELEGRAM_APPROVAL_REQUIRED','Mở rộng quyền cần phiếu duyệt Telegram mới.',409);
          const approval=await approvalReady(tx,this.identity,ballot.id,'access_change');
          await tx.query(`UPDATE identity.account_approvals SET state='issued',updated_at=now() WHERE id=$1`,[approval.id]);
          accessApprovalId=approval.id;
        }
        await this.setGrants(tx,user.id,cmd.grants);
      }
      if(cmd.kind==='disable'||cmd.kind==='access'||cmd.kind==='revoke_sessions'){
        await tx.query('UPDATE identity.sessions SET revoked_at=now(),updated_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[user.id]);
      }
      if(!user.activated) {
        await tx.query('UPDATE identity.invitations SET consumed_at=now(),updated_at=now() WHERE user_id=$1 AND consumed_at IS NULL',[user.id]);
      }
      if(cmd.kind==='reissue'||cmd.kind==='cancel')
        invariant(user.active&&!user.activated,'INVITATION_UNAVAILABLE','Tài khoản không còn chờ kích hoạt.',409);
      if(cmd.kind==='disable'||cmd.kind==='access'){
        await tx.query('UPDATE identity.telegram_codes SET consumed_at=now(),updated_at=now() WHERE user_id=$1 AND consumed_at IS NULL',[user.id]);
      }
      if(cmd.kind==='verify_github'||cmd.kind==='unlink_github'){
        invariant(user.active&&user.activated,'ACCOUNT_INACTIVE','Cần tài khoản đang hoạt động.',409);
        await tx.query('UPDATE identity.github_links SET ended_at=now(),updated_at=now() WHERE user_id=$1 AND ended_at IS NULL',[user.id]);
        if(cmd.kind==='verify_github'){
          const link=await tx.query(`INSERT INTO identity.github_links(tenant_id,user_id,github_id,source_id,verified_by)
            VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id`,[p.tenantId,user.id,cmd.githubId,cmd.sourceId,p.id]);
          invariant(link.rows.length,'IDENTITY_CONFLICT','Tài khoản GitHub đã được xác minh cho người khác.',409);
        }
      }
      const active=cmd.kind==='disable'?false:cmd.kind==='enable'?true:user.active;
      const updated=(await tx.query<Account>(`UPDATE identity.users SET active=$2,account_version=$3,updated_at=now()
        WHERE id=$1 RETURNING ${summary}`,[user.id,active,nextVersion])).rows[0];
      const approved=(await tx.query<{account_approval_id:string}>(`SELECT account_approval_id FROM identity.invitations
        WHERE user_id=$1 AND account_approval_id IS NOT NULL ORDER BY created_at DESC LIMIT 1`,[user.id])).rows[0];
      if(cmd.kind==='reissue') invariant(approved,'TELEGRAM_APPROVAL_REQUIRED','Chưa có phiếu duyệt Telegram.',409);
      const invitation=cmd.kind==='reissue'?await this.issue(tx,p,user.id,nextVersion,approved.account_approval_id):undefined;
      await this.audit(tx,p,user.id,'account_'+cmd.kind,{
        reason:cmd.reason,previousVersion:user.version,version:nextVersion,previousActive:user.active,active,
        ...(cmd.kind==='access'?{before,after:cmd.grants,...(accessApprovalId?{approvalId:accessApprovalId}:{})}:{}),
        ...(cmd.kind==='verify_github'?{githubId:cmd.githubId,sourceId:cmd.sourceId}:{}),
      });
      return {user:updated,invitation};
    });
  }

  /** SPEC-007 (b): freeze the account's current grants and version in a ballot for Chairman + one BoM. Memberships and the account
   * version stay as they are; `access` applies the grants later, only with this approved ballot. */
  private async proposeAccessChange(tx:Queryable,p:Principal,scope:Set<string>,user:Account,before:ProjectGrant[],grants:ProjectGrant[],reason:string) {
    invariant(user.active&&user.activated,'ACCOUNT_INACTIVE','Cần tài khoản đang hoạt động.',409);
    this.validate(grants,scope);
    invariant(widensAccess(before,grants),'ACCESS_CHANGE_NOT_NEEDED','Thay đổi chỉ giảm quyền; áp trực tiếp, không cần phiếu.',409);
    // Ballots past their deadline, or frozen at an older account version, can never apply: close them before checking for an open one.
    const expired=(await tx.query<{id:string}>(`UPDATE identity.account_approvals SET state='expired',updated_at=now()
      WHERE kind='access_change' AND subject_user_id=$1 AND state IN ('pending','approved')
        AND (expires_at<=now() OR subject_account_version<>$2) RETURNING id`,[user.id,user.version])).rows.map(row=>row.id);
    const open=(await tx.query<{id:string}>(`SELECT id FROM identity.account_approvals
      WHERE kind='access_change' AND subject_user_id=$1 AND state IN ('pending','approved')`,[user.id])).rows[0];
    invariant(!open,'APPROVAL_PENDING','Đã có phiếu duyệt còn hiệu lực.',409);
    const traceId=randomUUID();
    const seats=await verifiedApprovalSeats(tx,this.identity,user.id);
    const proposal=(await tx.query<{id:string}>(`INSERT INTO identity.account_approvals
      (tenant_id,kind,subject_user_id,subject_account_version,previous_grants,proposer_id,grants,reason)
      VALUES($1,'access_change',$2,$3,$4,$5,$6,$7) RETURNING id`,[p.tenantId,user.id,user.version,
      JSON.stringify(before),p.id,JSON.stringify(grants),reason])).rows[0];
    for(const seat of seats) await tx.query(`INSERT INTO identity.account_approval_voters
      (approval_id,tenant_id,seat,user_id) VALUES($1,$2,$3,$4)`,[proposal.id,p.tenantId,seat.seat,seat.user_id]);
    await this.notify(tx,this.identity,proposal.id,seats,traceId);
    await this.audit(tx,p,user.id,'access_change_proposed',
      {approvalId:proposal.id,accountVersion:user.version,before,after:grants,reason,traceId,...(expired.length?{expiredApprovalIds:expired}:{})});
    // Same {user,invitation} shape as every other command; the account itself is unchanged.
    return {user,invitation:undefined,pendingTelegramApproval:true,approvalId:proposal.id,agreed:0,required:'chairman+1bom'};
  }
}
