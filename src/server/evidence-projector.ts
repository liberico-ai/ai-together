import { createHash } from 'node:crypto';
import { calculateEvidenceReport,reportInput } from './evidence-scores';
import { z } from 'zod';
import type { Database } from './db';
import { invariant } from './errors';

function stable(value:unknown):string {
  if(Array.isArray(value)) return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object') return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b))
    .map(([key,item])=>JSON.stringify(key)+':'+stable(item)).join(',')+'}';
  return JSON.stringify(value);
}

/** Operator import from a bounded, normalized evidence export. No upstream writes. */
export async function projectEvidence(db:Database,raw:unknown,options:{allowSynthetic?:boolean;reviewRunId?:string}={}) {
  const parsed=reportInput.parse(raw);
  invariant(!parsed.synthetic||options.allowSynthetic,'SYNTHETIC_DENIED','Dữ liệu giả lập chỉ dùng trong kho thử.',403);
  return db.transaction(async tx=>{
    if(options.reviewRunId){
      const runId=z.uuid().parse(options.reviewRunId);
      const records=(await tx.query<{actor_id:string;detail:{evidenceId:string;criteria:[boolean,boolean,boolean]};created_at:Date}>(`
        SELECT a.actor_id,a.detail,a.created_at FROM public.report_actions a JOIN analytics.evidence_runs r ON
        (r.id,r.tenant_id,r.project_id)=(a.run_id,a.tenant_id,a.project_id)
        WHERE r.id=$1 AND r.tenant_id=$2 AND r.project_id=$3 AND r.period_start=$4 AND r.period_end=$5
          AND r.synthetic=$6 AND a.kind='quality_review' AND a.created_at<=$7 ORDER BY a.created_at,a.id`,
        [runId,parsed.tenantId,parsed.projectId,parsed.period.start,parsed.period.end,parsed.synthetic,parsed.period.asOf])).rows;
      parsed.reviews.push(...records.map(row=>({reviewerId:row.actor_id,evidenceId:row.detail.evidenceId,
        criteria:row.detail.criteria,at:new Date(row.created_at).toISOString()})));
    }
    const {input,project,people}=calculateEvidenceReport(parsed);
    const inputDigest=createHash('sha256').update(stable(input)).digest('hex');
    // Validate against the platform's own identity store before assuming the projector role.
    const memberships=(await tx.query<{id:string;name:string;active:boolean;report_permissions:string[]}>(`
      SELECT u.id,u.name,u.active,m.report_permissions
      FROM identity.memberships m JOIN identity.users u ON (u.id,u.tenant_id)=(m.user_id,m.tenant_id)
      WHERE m.tenant_id=$1 AND m.project_id=$2`,[input.tenantId,input.projectId])).rows;
    const members=new Map(memberships.map(member=>[member.id,member]));
    for(const subject of input.subjects){
      const member=members.get(subject.id);
      invariant(member?.active && member.name===subject.name,'UNKNOWN_SUBJECT','Danh tính ngoài dự án hoặc tên chưa khớp hồ sơ đã xác minh.',422);
    }
    for(const review of input.reviews){
      const member=members.get(review.reviewerId);
      invariant(member?.active && member.report_permissions.includes('quality_review'),
        'REVIEW_SCOPE_DENIED','Người đánh giá chưa được giao quyền trong dự án.',403);
    }
    if(!input.synthetic){
      const facts=new Map(input.evidence.map(fact=>[fact.id,fact]));
      const github=(await tx.query<{user_id:string;github_id:string;created_at:Date;ended_at:Date|null}>(`
        SELECT user_id,github_id,created_at,ended_at FROM identity.github_links
        WHERE tenant_id=$1 AND user_id=ANY($2::uuid[])`,[input.tenantId,input.subjects.map(person=>person.id)])).rows;
      for(const unit of input.contributions.filter(row=>row.accepted)){
        const time=Date.parse(facts.get(unit.evidenceId)!.occurredAt);
        invariant(github.some(link=>link.user_id===unit.userId && link.github_id===unit.githubId &&
          new Date(link.created_at).getTime()<=time && (link.ended_at===null||new Date(link.ended_at).getTime()>time)),
          'GITHUB_ID_UNVERIFIED','Chưa có liên kết GitHub hiệu lực tại thời điểm đóng góp.',422);
      }
    }
    await tx.query('SET LOCAL ROLE libetech_projector');
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[input.tenantId,input.projectId]);
    const written=(await tx.query<{id:string}>(`INSERT INTO analytics.evidence_runs
      (tenant_id,project_id,period_start,period_end,as_of,policy_version,input_digest,input,summary,synthetic,policy_approved)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(tenant_id,project_id,input_digest) DO NOTHING RETURNING id`,
      [input.tenantId,input.projectId,input.period.start,input.period.end,input.period.asOf,input.policy.version,inputDigest,
        JSON.stringify(input),JSON.stringify(project),input.synthetic,!input.synthetic&&Boolean(input.policy.approvedRef)])).rows[0];
    if(!written){
      const previous=(await tx.query<{id:string}>('SELECT id FROM analytics.evidence_runs WHERE tenant_id=$1 AND project_id=$2 AND input_digest=$3',
        [input.tenantId,input.projectId,inputDigest])).rows[0];
      return {runId:previous.id,replayed:true,workCount:project.works.length,personCount:people.size};
    }
    for(const [userId,result] of people){
      await tx.query('INSERT INTO analytics.evidence_people(tenant_id,project_id,run_id,user_id,result) VALUES($1,$2,$3,$4,$5)',
        [input.tenantId,input.projectId,written.id,userId,JSON.stringify(result)]);
    }
    return {runId:written.id,replayed:false,workCount:project.works.length,personCount:people.size};
  });
}
