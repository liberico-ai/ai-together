import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {AppError,invariant} from './errors';
import {IdentityService} from './identity';
import type {Principal,ProjectGrant} from './types';
import {notifyVoters,verifiedApprovalSeats} from './account-approval';
import {grantsSchema,sameGrants} from './accounts';
import {DOC_APPROVAL_TYPES,docApprovalCode,docApprovalDelta,docApprovalTypes,widensAccess,type DocApprovalType} from './access-grants';
import {storable} from './text-safety';

// Task 7c: a project coordinator (role manager) proposes a document-approval ballot for a member of the own project. The ballot is an ordinary
// access-change ballot of migration 018: same table, same frozen voters, same tally, same DM. This module writes only the ballot, its voters,
// their DMs and an audit event; it never touches identity.memberships. Only the account admin applies a ballot, through the `access` command.

export type DocApprovalProposal={approvalId:string;projectId:string;userId:string;addedTypes:DocApprovalType[];state:'pending'|'approved';expiresAt:string;replayed:boolean};

const SCOPE_DENIED=()=>new AppError('SCOPE_DENIED','Không tìm thấy mục trong phạm vi được cấp.',404);
const MANAGER_REQUIRED=()=>new AppError('MANAGER_REQUIRED','Chỉ điều phối dự án được thực hiện thao tác này.',403);
const INVALID='DOC_APPROVAL_PROPOSAL_INVALID';
const SELF=()=>new AppError(INVALID,'Không tự trình phiếu cấp quyền duyệt cho chính mình.',422);
const ADMIN=()=>new AppError(INVALID,'Quản trị tài khoản trình phiếu ở trang Quản trị tài khoản.',422);
const INELIGIBLE=()=>new AppError(INVALID,'Người được đề xuất phải là thành viên đang hoạt động của dự án.',422);
const ONE_OPEN_BALLOT='account_approval_active_access_change';
const PAIR_WAIT='Anh/chị chưa trình lại được cho người này: phiếu trước của anh/chị cho họ không được áp, và khoảng chờ 24 giờ sau phiếu đó chưa hết. Thử lại sau, hoặc nhờ quản trị tài khoản trình.';

// Characters refused in free text a person types: controls, hidden format marks (bidi overrides, joiners), line and paragraph separators.
const FORBIDDEN=/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const FORBIDDEN_ALL=/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
const uuid=z.uuid().transform(value=>value.toLowerCase());
const points=(text:string)=>Array.from(text).length;
/** One rule for server and screen (T7C-33): forbidden or unstorable characters and the cap are judged on the raw string; the floor of 5 after
 * removing U+0020 at both ends; the trimmed text is what is used. A forbidden character at either end is refused, never trimmed away. */
const basis=(max:number)=>z.string().transform((raw,ctx)=>{
  if(FORBIDDEN.test(raw)||!storable(raw)) {ctx.addIssue({code:'custom',message:'Căn cứ chứa ký tự không hợp lệ.'});return z.NEVER;}
  if(points(raw)>max) {ctx.addIssue({code:'custom',message:`Căn cứ dài tối đa ${max} ký tự.`});return z.NEVER;}
  const text=raw.replace(/^ +| +$/g,'');
  if(points(text)<5) {ctx.addIssue({code:'custom',message:'Căn cứ cần ít nhất 5 ký tự.'});return z.NEVER;}
  return text;
});
const types=(min:number)=>z.array(z.enum(DOC_APPROVAL_TYPES)).min(min).max(DOC_APPROVAL_TYPES.length).refine(list=>new Set(list).size===list.length);
const proposeSchema=z.object({projectId:uuid,userId:uuid,docTypes:types(1),expectedTypes:types(0),reason:basis(300)}).strict();
const listSchema=z.object({projectId:uuid}).strict();
// The ballot id of a withdrawal comes from the path, never from the body (T7C-31): an `approvalId` key in the body is an unknown key.
const withdrawSchema=z.object({reason:basis(500)}).strict();
const APPROVAL_CLOSED=()=>new AppError('APPROVAL_CLOSED','Phiếu đã kết thúc hoặc hết hạn.',409);

/** The fixed part of the frozen reason: 26 code points (false) or 73 (true). The name is database text a person chose: every forbidden
 * character becomes a space and only the first 100 code points are kept (T7C-7, T7C-21). */
export const reasonPrefix=(name:string,subjectIsCoordinator:boolean):string=>{
  const clean=Array.from(name.replace(FORBIDDEN_ALL,' ')).slice(0,100).join('');
  return subjectIsCoordinator?`${clean} (điều phối dự án) trình; người được cấp cũng là điều phối của dự án đó: `:`${clean} (điều phối dự án) trình: `;
};

type UserRow={id:string;name:string;active:boolean;activated:boolean;version:number};
type OpenRow={id:string;proposer_id:string;grants:unknown;previous_grants:unknown;reason:string;state:'pending'|'approved';expires_at:string|Date};
const iso=(value:string|Date)=>new Date(value).toISOString();
const sameTypes=(a:readonly string[],b:readonly string[])=>a.length===b.length&&a.every(item=>b.includes(item));
/** True only for the one-open-ballot index: the error code and the index name (the driver may leave `constraint` empty; then the message names it). */
const isOneOpenBallot=(e:unknown)=>{
  const err=e as {code?:string;constraint?:string;message?:string}|null;
  return err?.code==='23505'&&(err.constraint===ONE_OPEN_BALLOT||(!err.constraint&&String(err.message??'').includes(ONE_OPEN_BALLOT)));
};

export class DocApprovalProposalService {
  // notify is replaceable only so tests can fail a proposal right after its DMs are queued, as in AccountService.
  constructor(private identity:IdentityService,private notify:typeof notifyVoters=notifyVoters) {}

  private same(p:Principal) {
    invariant(p.tenantId===this.identity.tenantId&&p.role!=='bot','SCOPE_DENIED','Không tìm thấy mục trong phạm vi được cấp.',404);
  }
  private adminId() {return this.identity.adminId?.toLowerCase();}

  async propose(p:Principal,input:unknown):Promise<DocApprovalProposal> {
    const cmd=proposeSchema.parse(input);                                                             // P0
    this.same(p);                                                                                     // P1
    const callerId=p.id.toLowerCase(),adminId=this.adminId();
    if(adminId&&callerId===adminId) throw ADMIN();                                                    // P2: no database, not counted
    if(cmd.userId===callerId) throw SELF();
    await this.identity.throttle('doc-approval-proposal:'+callerId,10,3600);                           // P3: commits on its own, so failures below count
    if(!adminId||cmd.userId===adminId) throw INELIGIBLE();                                            // P3b: after the counter, before any lock
    const {projectId}=cmd;
    return this.identity.scope(async tx=>{
      // P4: unlocked read first; a person who is no manager cannot lock anyone's account row
      const early=await this.identity.activeProjectRole(tx,callerId,projectId);
      if(early===null) throw SCOPE_DENIED();
      if(early!=='manager') throw MANAGER_REQUIRED();
      // The account-admin row is the FIRST lock of every coordinator write (T7C-5): it orders this command before or after a whole admin command.
      if(!(await tx.query('SELECT id FROM identity.users WHERE id=$1 FOR KEY SHARE',[adminId])).rows.length) throw INELIGIBLE();
      // P5: both account rows in one statement, in id order (T7C-5 c, d)
      const locked=(await tx.query<UserRow>(`SELECT id,name,active,password_hash IS NOT NULL AS activated,account_version AS version
       FROM identity.users WHERE id=ANY($1::uuid[]) ORDER BY id FOR NO KEY UPDATE`,[[callerId,cmd.userId]])).rows;
      const proposer=locked.find(row=>row.id===callerId);
      if(!proposer||!proposer.active||!proposer.activated) throw SCOPE_DENIED();
      // P6: the same check again, now under the lock
      const role=await this.identity.activeProjectRole(tx,proposer.id,projectId);
      if(role===null) throw SCOPE_DENIED();
      if(role!=='manager') throw MANAGER_REQUIRED();
      // P7: seats without the proposer's own (OQ-35 a); the answer does not depend on the subject
      let seats:Awaited<ReturnType<typeof verifiedApprovalSeats>>;
      try {seats=await verifiedApprovalSeats(tx,this.identity,proposer.id);}
      catch(e) {
        if(e instanceof AppError&&e.code==='APPROVERS_NOT_READY') throw new AppError('APPROVERS_NOT_READY',
          'Chưa đủ người bỏ phiếu khi không tính người trình. Nhờ quản trị tài khoản kiểm tra danh sách người duyệt hoặc trình thay.',409);
        throw e;
      }
      // P8: the subject; one sentence for every reason that belongs to them
      const subject=locked.find(row=>row.id===cmd.userId);
      if(!subject||!subject.active||!subject.activated) throw INELIGIBLE();
      if(subject.id===proposer.id) throw SELF();
      const before=await this.identity.grants(tx,subject.id);
      const entry=before.find(grant=>grant.projectId===projectId);
      if(!entry||entry.role==='viewer') throw INELIGIBLE();
      const scope=new Set((await this.identity.grants(tx,adminId)).map(grant=>grant.projectId));
      if(!before.every(grant=>scope.has(grant.projectId))||!grantsSchema.safeParse(before).success) throw INELIGIBLE();
      const voters=seats.filter(seat=>seat.user_id!==subject.id);
      if(!voters.some(seat=>seat.seat==='chairman')||voters.length<2) throw INELIGIBLE();
      const subjectIsCoordinator=entry.role==='manager';
      // P9, P10
      const held=docApprovalTypes(entry.reportPermissions);
      if(!sameTypes(held,cmd.expectedTypes)) throw new AppError('VERSION_CONFLICT','Quyền duyệt của người này đã đổi. Tải lại trước khi trình.',409);
      const added=DOC_APPROVAL_TYPES.filter(type=>cmd.docTypes.includes(type)&&!held.includes(type));
      if(!added.length) throw new AppError('ACCESS_CHANGE_NOT_NEEDED','Người này đã giữ quyền duyệt các loại tài liệu đã chọn.',409);
      // P11: the new grants differ from the current ones in exactly this one way; anything else is a bug here, never written
      const after:ProjectGrant[]=before.map(grant=>grant.projectId===projectId
        ?{...grant,reportPermissions:[...grant.reportPermissions,...added.map(docApprovalCode)]}:grant);
      const delta=docApprovalDelta(before,after);
      if(!grantsSchema.safeParse(after).success||!delta||delta.projectId!==projectId||!sameTypes(delta.added,added)||!widensAccess(before,after))
        throw new Error('Doc-approval proposal built grants that are not a pure addition.');
      const reason=reasonPrefix(proposer.name,subjectIsCoordinator)+cmd.reason;                      // P12
      // P13: the open, living ballot of the subject
      const open=(await tx.query<OpenRow>(`SELECT id,proposer_id,grants,previous_grants,reason,state,expires_at FROM identity.account_approvals
       WHERE kind='access_change' AND subject_user_id=$1 AND state IN ('pending','approved') AND expires_at>now() AND subject_account_version=$2`,
       [subject.id,subject.version])).rows[0];
      if(open) {
        const grants=grantsSchema.safeParse(open.grants),previous=grantsSchema.safeParse(open.previous_grants);
        if(open.proposer_id===proposer.id&&grants.success&&previous.success&&sameGrants(grants.data,after)&&sameGrants(previous.data,before)&&open.reason===reason)
          return {approvalId:open.id,projectId,userId:subject.id,addedTypes:added,state:open.state,expiresAt:iso(open.expires_at),replayed:true};
        throw new AppError('APPROVAL_PENDING','Người này đang có một phiếu đổi quyền chưa xong.',409);
      }
      // P14: the wait of the same proposer for the same person (decision OQ-48 b; see T7C-19 for the closing time of each kind of ballot)
      const blocked=(await tx.query(`SELECT 1 FROM identity.account_approvals a
       WHERE a.kind='access_change' AND a.proposer_id=$1 AND a.subject_user_id=$2 AND a.state<>'issued'
        AND NOT EXISTS (SELECT 1 FROM identity.events e
         WHERE e.user_id=a.subject_user_id AND e.kind='access_change_withdrawn' AND e.detail->>'approvalId'=a.id::text
          AND e.actor_id=a.proposer_id)
        AND (CASE WHEN a.state IN ('rejected','expired') THEN LEAST(a.updated_at,a.expires_at)
         ELSE LEAST(a.expires_at,now()) END) > now()-interval '24 hours'
       LIMIT 1`,[proposer.id,subject.id])).rows.length;
      if(blocked) throw new AppError('RATE_LIMITED',PAIR_WAIT,429);
      // P15: close ballots that can no longer apply before the insert, as the admin path does
      const expired=(await tx.query<{id:string}>(`UPDATE identity.account_approvals SET state='expired',updated_at=now()
       WHERE kind='access_change' AND subject_user_id=$1 AND state IN ('pending','approved') AND (expires_at<=now() OR subject_account_version<>$2) RETURNING id`,
       [subject.id,subject.version])).rows.map(row=>row.id);
      // P16
      const traceId=randomUUID();
      let created:{id:string;expires_at:string|Date};
      try {
        created=(await tx.query<{id:string;expires_at:string|Date}>(`INSERT INTO identity.account_approvals
         (tenant_id,kind,subject_user_id,subject_account_version,previous_grants,proposer_id,grants,reason)
         VALUES($1,'access_change',$2,$3,$4,$5,$6,$7) RETURNING id,expires_at`,[this.identity.tenantId,subject.id,subject.version,
         JSON.stringify(before),proposer.id,JSON.stringify(after),reason])).rows[0];
      } catch(e) {
        if(isOneOpenBallot(e)) throw new AppError('APPROVAL_PENDING','Người này đang có một phiếu đổi quyền chưa xong.',409);
        throw e;
      }
      for(const seat of voters) await tx.query(`INSERT INTO identity.account_approval_voters
       (approval_id,tenant_id,seat,user_id) VALUES($1,$2,$3,$4)`,[created.id,this.identity.tenantId,seat.seat,seat.user_id]);
      await this.notify(tx,this.identity,created.id,voters,traceId);
      await tx.query(`INSERT INTO identity.events(tenant_id,user_id,actor_id,kind,detail) VALUES($1,$2,$3,'access_change_proposed',$4)`,
       [this.identity.tenantId,subject.id,proposer.id,JSON.stringify({approvalId:created.id,accountVersion:subject.version,before,after,reason,traceId,
        via:'project_manager',projectId,addedTypes:added,subjectIsCoordinator,...(expired.length?{expiredApprovalIds:expired}:{})})]);
      // P17: nothing about grants elsewhere, usernames, account versions or other projects
      return {approvalId:created.id,projectId,userId:subject.id,addedTypes:added,state:'pending',expiresAt:iso(created.expires_at),replayed:false};
    });
  }

  /** The caller's own open ballots that add document-approval codes in this project. Members of the project in any role see them (OQ-50 c). */
  async listOwn(p:Principal,input:unknown):Promise<DocApprovalProposal[]> {
    this.same(p);
    const {projectId}=listSchema.parse(input);
    const callerId=p.id.toLowerCase();
    if(callerId===this.adminId()) return [];
    return this.identity.scope(async tx=>{
      if(await this.identity.activeProjectRole(tx,callerId,projectId)===null) throw SCOPE_DENIED();
      const found=(await tx.query<{id:string;subject_user_id:string;grants:unknown;previous_grants:unknown;state:'pending'|'approved';expires_at:string|Date}>(
       `SELECT a.id,a.subject_user_id,a.grants,a.previous_grants,a.state,a.expires_at
        FROM identity.account_approvals a
        JOIN identity.users u ON (u.id,u.tenant_id)=(a.subject_user_id,a.tenant_id) AND u.account_version=a.subject_account_version
        WHERE a.kind='access_change' AND a.proposer_id=$1 AND a.state IN ('pending','approved') AND a.expires_at>now()
         AND EXISTS (SELECT 1 FROM jsonb_array_elements(a.grants) AS g(v) JOIN jsonb_array_elements(a.previous_grants) AS q(v)
           ON lower(q.v->>'projectId')=lower(g.v->>'projectId')
          WHERE lower(g.v->>'projectId')=$2 AND NOT ((g.v->'reportPermissions') <@ (q.v->'reportPermissions')))
        ORDER BY a.created_at,a.id LIMIT 200`,[callerId,projectId])).rows;
      const own:DocApprovalProposal[]=[];
      for(const row of found) {
        const grants=grantsSchema.safeParse(row.grants),previous=grantsSchema.safeParse(row.previous_grants);
        const delta=grants.success&&previous.success?docApprovalDelta(previous.data,grants.data):null;
        if(delta?.projectId!==projectId) continue;
        own.push({approvalId:row.id,projectId,userId:row.subject_user_id,addedTypes:delta.added,state:row.state,expiresAt:iso(row.expires_at),replayed:false});
      }
      return own;
    });
  }

  /** OQ-36 (b), OQ-50 (c), OQ-51 (b), N3 of gate round 2. `approvalId` comes from the path, not from the body (T7C-31); `input` is strict
   * {reason:5..500}. Only the person who proposed that ballot, still a member of its project in any role, and only while the ballot is
   * `pending`, unexpired and frozen at the subject's current account version. The ballot is closed as `expired`; the reason is in the event. */
  async withdraw(p:Principal,approvalId:string,input:unknown):Promise<{approvalId:string;state:'withdrawn'}> {
    const id=uuid.safeParse(approvalId);                                                              // R0: the path id, before the body
    if(!id.success) throw SCOPE_DENIED();
    const {reason}=withdrawSchema.parse(input);
    this.same(p);                                                                                     // R1
    const callerId=p.id.toLowerCase(),adminId=this.adminId();
    // the admin uses the cancel command; without this line the admin could withdraw an own ballot and bypass decision OQ-49 (a)
    if(!adminId||callerId===adminId) throw SCOPE_DENIED();
    return this.identity.scope(async tx=>{
      // R2: plain read; kind, proposer, subject, frozen version and both grant sets never change after the insert (the role may update only
      // state and updated_at), so no lock is needed for them. State and deadline are read again under the lock at R5.
      const row=(await tx.query<{id:string;kind:string;proposer_id:string;subject_user_id:string;subject_account_version:number;previous_grants:unknown;grants:unknown}>(
       `SELECT id,kind,state,expires_at,proposer_id,subject_user_id,subject_account_version,previous_grants,grants FROM identity.account_approvals WHERE id=$1`,
       [id.data])).rows[0];
      if(!row||row.kind!=='access_change'||row.proposer_id!==callerId||row.proposer_id===adminId) throw SCOPE_DENIED();
      const grants=grantsSchema.safeParse(row.grants),previous=grantsSchema.safeParse(row.previous_grants);
      const delta=grants.success&&previous.success?docApprovalDelta(previous.data,grants.data):null;
      if(!delta) throw SCOPE_DENIED();
      // R3: the account-admin row first (T7C-5), then the caller's own row
      if(!(await tx.query('SELECT id FROM identity.users WHERE id=$1 FOR KEY SHARE',[adminId])).rows.length) throw SCOPE_DENIED();
      if(!(await tx.query('SELECT id FROM identity.users WHERE id=$1 AND active AND password_hash IS NOT NULL FOR SHARE',[callerId])).rows.length) throw SCOPE_DENIED();
      // R4: decision OQ-50 (c): a member of that project in any role, viewer included; removed is the 404 of an unknown ballot
      if(await this.identity.activeProjectRole(tx,callerId,delta.projectId)===null) throw SCOPE_DENIED();
      // R5: the ballot row, then in this order: closed or past the deadline; dead by an account change (N3, T7C-30); approved (OQ-51 b)
      const locked=(await tx.query<{state:string;overdue:boolean}>(
       'SELECT state,expires_at<=now() AS overdue FROM identity.account_approvals WHERE id=$1 FOR UPDATE',[row.id])).rows[0];
      if(!locked||locked.overdue||!['pending','approved'].includes(locked.state)) throw APPROVAL_CLOSED();
      // Plain read of the subject's version (T7C-5 i): the only application write of account_version runs inside AccountService.command,
      // after `operator` locked the admin row FOR UPDATE, which the KEY SHARE above excludes. Under READ COMMITTED this is the committed value.
      const subject=(await tx.query<{account_version:number}>('SELECT account_version FROM identity.users WHERE id=$1',[row.subject_user_id])).rows[0];
      if(!subject||subject.account_version!==row.subject_account_version) throw APPROVAL_CLOSED();
      if(locked.state==='approved') throw new AppError('BALLOT_ALREADY_APPROVED',
        'Phiếu đã đủ xác nhận, không còn rút được ở đây. Nhờ quản trị tài khoản huỷ nếu cần.',409);
      if(locked.state!=='pending') throw APPROVAL_CLOSED();
      // R6: the lower-case ballot id in the event is what P14 of `propose` matches to exempt the pair from the wait
      await tx.query(`UPDATE identity.account_approvals SET state='expired',updated_at=now() WHERE id=$1`,[row.id]);
      await tx.query(`INSERT INTO identity.events(tenant_id,user_id,actor_id,kind,detail) VALUES($1,$2,$3,'access_change_withdrawn',$4)`,
       [this.identity.tenantId,row.subject_user_id,callerId,JSON.stringify({approvalId:row.id,reason,previousState:'pending',projectId:delta.projectId})]);
      return {approvalId:row.id,state:'withdrawn'};                                                   // R7
    });
  }
}
