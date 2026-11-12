import { z } from 'zod';
import { scoped, type Database, type Queryable } from './db';
import { invariant } from './errors';
import { append, deduplicate, workRow } from './service';
import { projectWorkSummary } from './projector';
import type { Principal, Work } from './types';

const uuid = z.string().uuid();
const note = z.string().trim().min(5).max(2000);
const allocation = z.object({
  lead_id:uuid,
  parts:z.array(z.object({
    owner_id:uuid, output:z.string().trim().min(3).max(240),
    criteria:z.string().trim().min(3).max(1000), dueAt:z.iso.datetime().nullable(),
    dependency:z.string().trim().max(500),
  }).strict()).max(20),
}).strict();
const command = z.discriminatedUnion('action',[
  z.object({action:z.literal('propose'),workId:uuid,expectedVersion:z.number().int().positive(),
    priorId:uuid.optional(),allocation,reason:note}).strict(),
  z.object({action:z.literal('vote'),proposalId:uuid,choice:z.enum(['agree','reject','revise']),note}).strict(),
  z.object({action:z.literal('cancel'),proposalId:uuid,note}).strict(),
]);
export type Allocation = {lead_id:string|null;parts:z.infer<typeof allocation>['parts']};
type Scope = {version:number;seat_ids:string[];enabled:boolean};
type Source = {source_ref:string;fingerprint:string;checked_at:string};
type State = 'pending'|'applied'|'rejected'|'revise'|'cancelled'|'expired'|'reconcile';
type Proposal = {
  id:string;project_id:string;work_id:string;prior_id:string|null;proposer_id:string;work_version:number;scope_version:number;
  seat_ids:string[];source_ref:string;source_fingerprint:string;before_assignment:Allocation;
  proposed_assignment:Allocation;reason:string;state:State;created_at:string;expires_at:string;finished_at:string|null;
};
type Vote = {voter_id:string;choice:'agree'|'reject'|'revise';note:string;created_at:string};
type Receipt = {proposal_id:string;work_version:number;source_checked_at:string;created_at:string};
type Member = {user_id:string;project_role:string;linked:boolean};
type Card = {proposal:Proposal;votes:Vote[];receipt:Receipt|null};
export type BomView = {work:Work;allocation:Allocation;enabled:boolean;source:Source|null;cards:Card[];recipients:string[]};

async function scopeFor(tx:Queryable,projectId:string,lock=false) {
  return (await tx.query<Scope>('SELECT version,seat_ids,enabled FROM bom_scopes WHERE project_id=$1'+(lock?' FOR SHARE':''),[projectId])).rows[0];
}
async function liveSource(tx:Queryable,workId:string,lock=false) {
  return (await tx.query<Source>(`SELECT source_ref,fingerprint,checked_at FROM bom_sources
    WHERE work_id=$1 AND checked_at<=clock_timestamp() AND valid_until>clock_timestamp()`+(lock?' FOR SHARE':''),[workId])).rows[0];
}
async function members(tx:Queryable,projectId:string,ids:string[],lock=false) {
  return (await tx.query<Member>('SELECT * FROM bom_eligible_members($1,$2,$3)',[projectId,ids,lock])).rows;
}
const seatsReady = (scope:Scope,eligible:Member[]) =>
  scope.seat_ids.every(id=>eligible.some(member=>member.user_id===id&&member.linked));
function assertSeat(p:Principal,scope:Scope|undefined):asserts scope is Scope {
  invariant(p.role!=='bot'&&scope?.seat_ids.includes(p.id),'SCOPE_DENIED','Không tìm thấy hồ sơ BoM trong phạm vi được cấp.',404);
}
const owners = (value:Allocation) => [...new Set([value.lead_id,...value.parts.map(part=>part.owner_id)].filter((id):id is string=>id!==null))];
const canReceive = (member:Member,scope:Scope) =>
  member.project_role==='engineer'||(member.project_role==='manager'&&scope.seat_ids.includes(member.user_id));
function validAllocation(work:Work,value:Allocation,scope:Scope,eligible:Member[]) {
  return work.state!=='done'&&work.assignee_id!==null&&owners(value).every(id=>
    id!==work.technical_id&&id!==work.business_id&&eligible.some(member=>member.user_id===id&&canReceive(member,scope)));
}
async function currentAllocation(tx:Queryable,work:Work):Promise<Allocation> {
  const row=(await tx.query<{parts:Allocation['parts']}>(`SELECT b.proposed_assignment->'parts' AS parts
    FROM bom_receipts r JOIN bom_proposals b ON b.id=r.proposal_id
    WHERE r.work_id=$1 ORDER BY r.work_version DESC LIMIT 1`,[work.id])).rows[0];
  return {lead_id:work.assignee_id,parts:row?.parts??[]};
}
async function card(tx:Queryable,proposal:Proposal):Promise<Card> {
  const iso=(time:string)=>new Date(time).toISOString();
  const votes=(await tx.query<Vote>('SELECT voter_id,choice,note,created_at FROM bom_votes WHERE proposal_id=$1 ORDER BY created_at,voter_id',[proposal.id])).rows;
  const receipt=(await tx.query<Receipt>('SELECT proposal_id,work_version,source_checked_at,created_at FROM bom_receipts WHERE proposal_id=$1',[proposal.id])).rows[0];
  return {
    proposal:{...proposal,created_at:iso(proposal.created_at),expires_at:iso(proposal.expires_at),
      finished_at:proposal.finished_at?iso(proposal.finished_at):null},
    votes:votes.map(vote=>({...vote,created_at:iso(vote.created_at)})),
    receipt:receipt?{...receipt,created_at:iso(receipt.created_at),source_checked_at:iso(receipt.source_checked_at)}:null,
  };
}
async function finish(tx:Queryable,proposal:Proposal,state:State) {
  return (await tx.query<Proposal>(`UPDATE bom_proposals SET state=$2,finished_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE id=$1 RETURNING *`,[proposal.id,state])).rows[0];
}

export class BomService {
  constructor(private db:Database) {}

  read(p:Principal,id:string,candidateIds:string[]):Promise<BomView> {
    return scoped(this.db,p,async tx=>{
      const work=await workRow(tx,id);
      const scope=await scopeFor(tx,work.project_id);
      assertSeat(p,scope);
      const eligible=await members(tx,work.project_id,[...new Set([...scope.seat_ids,...candidateIds])]);
      invariant(eligible.some(member=>member.user_id===p.id&&member.linked),'SCOPE_DENIED','Cần ghép Telegram và có phạm vi dự án.',403);
      const proposals=(await tx.query<Proposal>('SELECT * FROM bom_proposals WHERE work_id=$1 ORDER BY created_at DESC,id LIMIT 30',[id])).rows;
      const cards:Card[]=[];
      for(const proposal of proposals) cards.push(await card(tx,proposal));
      return {work,allocation:await currentAllocation(tx,work),enabled:scope.enabled&&seatsReady(scope,eligible),
        source:await liveSource(tx,id)??null,cards,recipients:eligible.filter(member=>canReceive(member,scope)).map(member=>member.user_id)};
    });
  }

  async command(p:Principal,input:unknown,key:string):Promise<Card> {
    const cmd=command.parse(input);
    return scoped(this.db,p,async tx=>{
      if(cmd.action==='propose') {
        const work=await workRow(tx,cmd.workId);
        assertSeat(p,await scopeFor(tx,work.project_id));
        const prior=cmd.priorId?(await tx.query<Proposal>('SELECT * FROM bom_proposals WHERE id=$1 AND work_id=$2 FOR UPDATE',[cmd.priorId,work.id])).rows[0]:null;
        const current=await workRow(tx,work.id,true);
        const live=await scopeFor(tx,current.project_id,true);
        assertSeat(p,live);
        const eligible=await members(tx,current.project_id,[...live.seat_ids,...owners(cmd.allocation)],true);
        invariant(eligible.some(member=>member.user_id===p.id&&member.linked),'SCOPE_DENIED','Cần ghép Telegram và có phạm vi dự án.',403);
        return deduplicate(tx,p,work.project_id,key,{bom:cmd},async()=>{
          if(cmd.priorId) {
            invariant(prior&&prior.work_id===work.id&&!['pending','applied'].includes(prior.state)
              && !(await tx.query('SELECT 1 FROM bom_proposals WHERE prior_id=$1',[prior.id])).rows.length,
            'INVALID_PRIOR','Chỉ trình lại một lần từ phiên bản đã kết thúc và chưa áp dụng.',409);
          }
          invariant(current.version===cmd.expectedVersion,'VERSION_CONFLICT','Đầu việc đã đổi. Mở lại hồ sơ trước khi gửi.',409);
          invariant(live.enabled&&seatsReady(live,eligible),'BOM_UNAVAILABLE','Chưa đủ ba ghế BoM có hiệu lực trong dự án.',409);
          invariant(validAllocation(current,cmd.allocation,live,eligible),'INVALID_ASSIGNMENT',
            'Cần người nhận đủ quyền, tách khỏi người nghiệm thu, trên đầu việc đang có phân công.',422);
          const source=await liveSource(tx,current.id,true);
          invariant(source,'SOURCE_RECONCILE','Cần đọc lại nguồn trước khi gửi phiếu.',409);
          const before=await currentAllocation(tx,current);
          invariant(JSON.stringify(allocation.parse(before)) !== JSON.stringify(cmd.allocation),
            'NO_CHANGE','Phân công mới cần khác phân công hiện hành.',422);
          const proposal=(await tx.query<Proposal>(`INSERT INTO bom_proposals(tenant_id,project_id,work_id,prior_id,proposer_id,
            work_version,scope_version,seat_ids,source_ref,source_fingerprint,before_assignment,proposed_assignment,reason)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[p.tenantId,current.project_id,current.id,
            cmd.priorId??null,p.id,current.version,live.version,live.seat_ids,source.source_ref,source.fingerprint,
            JSON.stringify(before),JSON.stringify(cmd.allocation),cmd.reason])).rows[0];
          return card(tx,proposal);
        });
      }
      const proposal=(await tx.query<Proposal>('SELECT * FROM bom_proposals WHERE id=$1 FOR UPDATE',[cmd.proposalId])).rows[0];
      invariant(proposal&&proposal.seat_ids.includes(p.id),'SCOPE_DENIED','Không tìm thấy hồ sơ BoM trong phạm vi được cấp.',404);
      const work=await workRow(tx,proposal.work_id,true);
      const scope=await scopeFor(tx,work.project_id,true);
      assertSeat(p,scope);
      const eligible=await members(tx,work.project_id,[...scope.seat_ids,...owners(proposal.proposed_assignment)],true);
      invariant(eligible.some(member=>member.user_id===p.id&&member.linked),'SCOPE_DENIED','Cần ghép Telegram và có phạm vi dự án.',403);
      return deduplicate(tx,p,work.project_id,key,{bom:cmd},async()=>{
        const existing=await card(tx,proposal);
        const vote=existing.votes.find(v=>v.voter_id===p.id);
        if(cmd.action==='vote'&&vote) {
          invariant(vote.choice===cmd.choice&&vote.note===cmd.note,'VOTE_LOCKED','Lựa chọn đã ghi. Dùng phiên bản mới nếu cần đổi.',409);
          return existing;
        }
        invariant(proposal.state==='pending','PROPOSAL_CLOSED','Vòng xác nhận đã kết thúc.',409);
        if((await tx.query('SELECT 1 FROM bom_proposals WHERE id=$1 AND expires_at<=clock_timestamp()',[proposal.id])).rows.length) {
          return card(tx,await finish(tx,proposal,'expired'));
        }
        if(cmd.action==='cancel') {
          invariant(proposal.proposer_id===p.id,'SCOPE_DENIED','Chỉ người gửi được hủy phiếu.',403);
          await append(tx,p,work,'bom_cancelled',{proposalId:proposal.id,note:cmd.note});
          return card(tx,await finish(tx,proposal,'cancelled'));
        }
        const source=await liveSource(tx,work.id,true);
        if(!scope.enabled||scope.version!==proposal.scope_version||scope.seat_ids.some((id,i)=>id!==proposal.seat_ids[i])
          ||!seatsReady(scope,eligible)||work.version!==proposal.work_version||!source||source.source_ref!==proposal.source_ref
          ||source.fingerprint!==proposal.source_fingerprint||!validAllocation(work,proposal.proposed_assignment,scope,eligible)) {
          return card(tx,await finish(tx,proposal,'reconcile'));
        }
        await tx.query(`INSERT INTO bom_votes(proposal_id,tenant_id,project_id,voter_id,choice,note)
          VALUES($1,$2,$3,$4,$5,$6)`,[proposal.id,p.tenantId,work.project_id,p.id,cmd.choice,cmd.note]);
        if(cmd.choice!=='agree') {
          return card(tx,await finish(tx,proposal,cmd.choice==='reject'?'rejected':'revise'));
        }
        if(existing.votes.filter(v=>v.choice==='agree').length!==2) return card(tx,proposal);
        await tx.query(`INSERT INTO bom_receipts(proposal_id,tenant_id,project_id,work_id,work_version,source_checked_at)
          VALUES($1,$2,$3,$4,$5,$6)`,[proposal.id,p.tenantId,work.project_id,work.id,work.version+1,source.checked_at]);
        const next=(await tx.query<Work>(`UPDATE work_items SET assignee_id=$1,version=version+1,updated_at=clock_timestamp()
          WHERE id=$2 AND version=$3 RETURNING *`,[proposal.proposed_assignment.lead_id,work.id,work.version])).rows[0];
        invariant(next,'VERSION_CONFLICT','Đầu việc vừa thay đổi. Cần đối soát lại.',409);
        await append(tx,p,next,'bom_allocation_applied',{proposalId:proposal.id,before:proposal.before_assignment,after:proposal.proposed_assignment});
        await projectWorkSummary(tx,p.tenantId,work.project_id);
        return card(tx,await finish(tx,proposal,'applied'));
      });
    });
  }
}
