import {z} from 'zod';
import {IdentityService} from './identity';
import {invariant} from './errors';
import {enqueueDm} from './outbox';
import type {Queryable} from './db';
import type {Principal} from './types';

export const approvalChoice=z.enum(['agree','reject']);
const bomSeats=['bom_chu','bom_quan','bom_phuong'] as const;
type Seat={seat:string;user_id:string;telegram_id:string|null;active:boolean;activated:boolean};
type VerifiedSeat=Seat&{telegram_id:string};
type Voter={seat:string;user_id:string};
type Vote={voter_id:string;choice:string};
export type ApprovalKind='registration'|'access_change';
type Approval={id:string;kind:ApprovalKind;registration_id:string|null;subject_user_id:string|null;subject_account_version:number|null;
 state:string;expires_at:string;proposer_id:string};
const APPROVAL_COLS='id,kind,registration_id,subject_user_id,subject_account_version,state,expires_at,proposer_id';
/** The one DM per frozen voter of a ballot; the dedupe key makes a repeated notice a no-op. */
export const ballotDmKey=(approvalId:string,userId:string)=>'account_approval.pending:'+approvalId+':'+userId;

function validSeats(rows:Voter[],adminId:string|undefined) {
 return rows.length>=2&&rows.length<=4&&rows.some(row=>row.seat==='chairman'&&row.user_id===adminId)
  &&rows.some(row=>bomSeats.some(name=>name===row.seat))
  &&rows.every(row=>row.seat==='chairman'||bomSeats.some(name=>name===row.seat))
  &&new Set(rows.map(row=>row.seat)).size===rows.length
  &&new Set(rows.map(row=>row.user_id)).size===rows.length;
}

/** Seats able to vote now. `excludeUserId` drops the seat of the person an access change is about: nobody votes on their own access. */
export async function verifiedApprovalSeats(tx:Queryable,identity:IdentityService,excludeUserId?:string):Promise<VerifiedSeat[]> {
 const rows=(await tx.query<Seat>(`SELECT s.seat,s.user_id,l.telegram_id,u.active,
  u.password_hash IS NOT NULL AS activated
  FROM identity.account_approval_seats s
  JOIN identity.users u ON (u.id,u.tenant_id)=(s.user_id,s.tenant_id)
  LEFT JOIN identity.telegram_links l ON (l.user_id,l.tenant_id)=(u.id,u.tenant_id)
  ORDER BY s.seat`)).rows;
 const eligible=rows.filter((row):row is VerifiedSeat=>row.active&&row.activated&&Boolean(row.telegram_id)&&row.user_id!==excludeUserId);
 invariant(validSeats(eligible,identity.adminId),
  'APPROVERS_NOT_READY','Cần ghép Telegram cho Chairman và ít nhất một thành viên BoM Tech.',409);
 return eligible;
}

async function frozenVoters(tx:Queryable,identity:IdentityService,approval:Pick<Approval,'id'|'subject_user_id'>,seats:Seat[]) {
 const voters=(await tx.query<Voter>(
  'SELECT seat,user_id FROM identity.account_approval_voters WHERE approval_id=$1',[approval.id])).rows;
 invariant(validSeats(voters,identity.adminId)
  &&voters.every(v=>seats.some(s=>s.seat===v.seat&&s.user_id===v.user_id))
  &&voters.every(v=>v.user_id!==approval.subject_user_id),
  'APPROVERS_CHANGED','Danh sách người duyệt đã đổi; cần đối soát lại.',409);
 return voters;
}

/** SPEC-007 (a): one DM per frozen voter, written in the caller's identity.scope transaction (E-INT-06). The payload names nobody,
 * no grant and no ballot id; the gateway learns only that a ballot waits, and the voter opens it in the private chat. */
export async function notifyVoters(tx:Queryable,identity:IdentityService,approvalId:string,
 voters:{user_id:string;telegram_id:string}[],traceId:string):Promise<void> {
 for(const voter of voters) await enqueueDm(tx,{tenantId:identity.tenantId,recipientUserId:voter.user_id,telegramId:voter.telegram_id,
  template:'account_approval.pending',dedupeKey:ballotDmKey(approvalId,voter.user_id),params:{},traceId,correlationId:traceId,causationId:null});
}

async function tally(tx:Queryable,approvalId:string,voters:Voter[]) {
 const votes=(await tx.query<Vote>(`SELECT voter_id,choice FROM identity.account_approval_votes
  WHERE approval_id=$1`,[approvalId])).rows;
 const chairman=voters.find(v=>v.seat==='chairman')!;
 const bom=voters.filter(v=>v.seat!=='chairman');
 const choice=(id:string)=>votes.find(v=>v.voter_id===id)?.choice;
 const chairmanAgreed=choice(chairman.user_id)==='agree';
 const bomAgreed=bom.filter(v=>choice(v.user_id)==='agree').length;
 const agreed=votes.filter(v=>v.choice==='agree').length;
 const state=chairmanAgreed&&bomAgreed>=1?'approved':
  choice(chairman.user_id)==='reject'||bom.every(v=>choice(v.user_id)==='reject')?'rejected':'pending';
 return {state,agreed,chairmanAgreed,bomAgreed,required:'chairman+1bom'};
}

/** An approved, unexpired ballot of exactly `kind` whose frozen voters still hold their seats and still agree.
 * Invitations ask for 'registration' only, so an access-change ballot can never open an invitation. */
export async function approvalReady(tx:Queryable,identity:IdentityService,approvalId:string,kind:ApprovalKind) {
 const approval=(await tx.query<Approval>(`SELECT ${APPROVAL_COLS}
  FROM identity.account_approvals WHERE id=$1 FOR UPDATE`,[approvalId])).rows[0];
 invariant(approval&&approval.kind===kind&&approval.state==='approved'&&new Date(approval.expires_at).getTime()>Date.now(),
  'APPROVAL_NOT_READY','Chưa có đủ xác nhận còn hiệu lực.',409);
 const seats=await verifiedApprovalSeats(tx,identity);
 const voters=await frozenVoters(tx,identity,approval,seats);
 invariant((await tally(tx,approvalId,voters)).state==='approved',
  'APPROVAL_NOT_READY','Cần xác nhận của Chairman và một thành viên BoM.',409);
 return approval;
}

export class AccountApprovalService {
 constructor(private identity:IdentityService) {}

 private async voter(telegramId:string,chatId:string,chatType:string) {
  invariant(['private','dm'].includes(chatType)&&chatId===telegramId,
   'PRIVATE_CHAT_REQUIRED','Chỉ duyệt trong tin nhắn riêng với bot.',403);
  return this.identity.telegramPrincipal(telegramId);
 }

 async pending(telegramId:string,chatId:string,chatType:string) {
  const p=await this.voter(telegramId,chatId,chatType);
  return this.pendingForPrincipal(p);
 }

 async pendingForPrincipal(p:Principal) {
  invariant(p.tenantId===this.identity.tenantId&&p.role!=='bot',
   'APPROVER_REQUIRED','Không có quyền duyệt tài khoản.',403);
  return this.identity.scope(async tx=>{
   const seats=await verifiedApprovalSeats(tx,this.identity);
   invariant(seats.some(seat=>seat.user_id===p.id),'APPROVER_REQUIRED','Không có quyền duyệt tài khoản.',403);
   // Both kinds: a registration names the applicant; an access change names the account and shows its frozen current grants.
   // Project names join within the ballot's own tenant only; a ballot whose account changed since the proposal is not offered.
   return (await tx.query(`SELECT a.id,a.kind,a.state,a.expires_at,
     COALESCE(r.name,su.name) AS name,COALESCE(r.username,su.username) AS username,r.project_interest,
     a.reason,a.grants,
     COALESCE((SELECT jsonb_agg(jsonb_build_object('name',proj.name,'role',item.value->>'role',
       'reportPermissions',item.value->'reportPermissions') ORDER BY proj.name)
       FROM jsonb_array_elements(a.grants) item
       JOIN projects proj ON proj.id=(item.value->>'projectId')::uuid
         AND proj.tenant_id=a.tenant_id),'[]'::jsonb) AS grant_details,
     CASE WHEN a.previous_grants IS NULL THEN NULL ELSE
     COALESCE((SELECT jsonb_agg(jsonb_build_object('name',proj.name,'role',item.value->>'role',
       'reportPermissions',item.value->'reportPermissions') ORDER BY proj.name)
       FROM jsonb_array_elements(a.previous_grants) item
       JOIN projects proj ON proj.id=(item.value->>'projectId')::uuid
         AND proj.tenant_id=a.tenant_id),'[]'::jsonb) END AS previous_grant_details,
     (SELECT count(*)::integer FROM identity.account_approval_votes v
       WHERE v.approval_id=a.id AND v.choice='agree') AS agreed
    FROM identity.account_approvals a
    JOIN identity.account_approval_voters av ON av.approval_id=a.id AND av.user_id=$1
    LEFT JOIN identity.registration_requests r ON (r.id,r.tenant_id)=(a.registration_id,a.tenant_id)
    LEFT JOIN identity.users su ON (su.id,su.tenant_id)=(a.subject_user_id,a.tenant_id)
    WHERE a.state='pending' AND a.expires_at>now()
      AND ((a.kind='registration' AND r.id IS NOT NULL)
        OR (a.kind='access_change' AND su.active AND su.account_version=a.subject_account_version))
      AND NOT EXISTS(SELECT 1 FROM identity.account_approval_votes v
        WHERE v.approval_id=a.id AND v.voter_id=$1)
    ORDER BY a.created_at LIMIT 20`,[p.id])).rows;
  });
 }

 async vote(telegramId:string,chatId:string,chatType:string,approvalId:string,choice:unknown) {
  z.uuid().parse(approvalId); const decision=approvalChoice.parse(choice);
  const p=await this.voter(telegramId,chatId,chatType);
  return this.voteForPrincipal(p,approvalId,decision);
 }

 async voteForPrincipal(p:Principal,approvalId:string,choice:unknown) {
  z.uuid().parse(approvalId); const decision=approvalChoice.parse(choice);
  invariant(p.tenantId===this.identity.tenantId&&p.role!=='bot',
   'APPROVER_REQUIRED','Không có quyền duyệt tài khoản.',403);
  const outcome=await this.identity.scope(async tx=>{
   const seats=await verifiedApprovalSeats(tx,this.identity);
   invariant(seats.some(seat=>seat.user_id===p.id),'APPROVER_REQUIRED','Không có quyền duyệt tài khoản.',403);
   const row=(await tx.query<Approval>(`SELECT ${APPROVAL_COLS}
    FROM identity.account_approvals WHERE id=$1 FOR UPDATE`,[approvalId])).rows[0];
   invariant(row,'APPROVAL_NOT_FOUND','Không tìm thấy phiếu duyệt.',404);
   const voters=await frozenVoters(tx,this.identity,row,seats);
   invariant(voters.some(v=>v.user_id===p.id),'APPROVER_REQUIRED','Không có quyền duyệt phiếu này.',403);
   if(row.kind==='access_change'&&['pending','approved'].includes(row.state)) {
    // The ballot froze the account at one version. If the account changed since, the card is stale: close the ballot, record no vote.
    // Plain read (no lock): account commands lock the user before the ballot, so locking here would invert that order. A change that
    // commits after this read is caught where it matters, in `access`, which requires the frozen version to equal the current one.
    const subject=(await tx.query<{account_version:number}>(
     'SELECT account_version FROM identity.users WHERE id=$1',[row.subject_user_id])).rows[0];
    if(subject?.account_version!==row.subject_account_version) {
     await tx.query(`UPDATE identity.account_approvals SET state='expired',updated_at=now() WHERE id=$1`,[approvalId]);
     await tx.query(`INSERT INTO identity.events(tenant_id,user_id,actor_id,kind,detail)
      VALUES($1,$2,$3,'access_change_expired',$4)`,[this.identity.tenantId,row.subject_user_id,p.id,
       JSON.stringify({approvalId,reason:'account_changed',frozenVersion:row.subject_account_version,
        accountVersion:subject?.account_version??null,previousState:row.state})]);
     return {closed:true} as const;
    }
   }
   const previous=(await tx.query<{choice:string}>(
    'SELECT choice FROM identity.account_approval_votes WHERE approval_id=$1 AND voter_id=$2',[approvalId,p.id])).rows[0];
   if(previous) {
    invariant(previous.choice===decision,'VOTE_LOCKED','Phiếu đã ghi lựa chọn khác.',409);
    return {approvalId,...await tally(tx,approvalId,voters),state:row.state,replayed:true};
   }
   invariant(row.state==='pending'&&new Date(row.expires_at).getTime()>Date.now(),
    'APPROVAL_CLOSED','Phiếu đã kết thúc hoặc hết hạn.',409);
   await tx.query(`INSERT INTO identity.account_approval_votes(approval_id,tenant_id,voter_id,choice)
    VALUES($1,$2,$3,$4)`,[approvalId,this.identity.tenantId,p.id,decision]);
   // The voter acted on the ballot: their own DM is recipient-acknowledged. Delivery stays whatever the gateway reported;
   // a ballot created before the DMs existed has no row, which is not an error.
   await tx.query(`UPDATE outbox_messages SET acknowledged_at=now(),updated_at=now()
    WHERE tenant_id=$1 AND dedupe_key=$2 AND acknowledged_at IS NULL`,[this.identity.tenantId,ballotDmKey(approvalId,p.id)]);
   const result=await tally(tx,approvalId,voters);
   if(result.state!=='pending') await tx.query(`UPDATE identity.account_approvals SET state=$2,updated_at=now()
    WHERE id=$1`,[approvalId,result.state]);
   await tx.query(`INSERT INTO identity.events(tenant_id,actor_id,kind,detail)
    VALUES($1,$2,'account_approval_vote',$3)`,[this.identity.tenantId,p.id,
     JSON.stringify({approvalId,choice:decision,...result})]);
   return {approvalId,...result,replayed:false};
  });
  // The expiry above is committed before the refusal, so a stale card closes the ballot for everyone.
  invariant(!('closed' in outcome),'APPROVAL_CLOSED','Phiếu đã kết thúc hoặc hết hạn.',409);
  return outcome;
 }
}
