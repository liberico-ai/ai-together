import { z } from 'zod';
import { scoped,type Database,type Queryable } from './db';
import { invariant } from './errors';
import type { PersonResult,ProjectResult } from './evidence-scores';
import type { Principal,ReportPermission } from './types';

const uuid=z.uuid();
const view=z.object({projectId:uuid,runId:uuid.optional(),subjectId:uuid.optional()}).strict();
const actionFields={projectId:uuid,runId:uuid,subjectId:uuid,requestKey:uuid,reason:z.string().trim().min(5).max(800)};
const action=z.discriminatedUnion('kind',[
  z.object({...actionFields,kind:z.literal('correction')}).strict(),
  z.object({...actionFields,kind:z.literal('approval')}).strict(),
  z.object({...actionFields,kind:z.literal('quality_review'),evidenceId:z.string().min(1).max(160),
    criteria:z.tuple([z.boolean(),z.boolean(),z.boolean()])}).strict(),
]);
const metadata='id,project_id,period_start,period_end,as_of,policy_version,synthetic,policy_approved,created_at';
type Run={id:string;project_id:string;period_start:string;period_end:string;as_of:string;policy_version:string;synthetic:boolean;policy_approved:boolean;created_at:string};
type PersonRow={user_id:string;result:PersonResult};
type ActionRow={kind:'correction'|'approval'|'quality_review';detail:{reason:string;criteria?:boolean[];evidenceId?:string};created_at:string};
const can=(p:Principal,projectId:string,permission:ReportPermission)=>
  p.grants?.some(grant=>grant.projectId===projectId&&grant.reportPermissions.includes(permission))??false;
export class ReportService {
  constructor(private db:Database,private includeSynthetic=false) {}

  private within<T>(p:Principal,projectId:string,fn:(tx:Queryable)=>Promise<T>) {
    invariant(p.role!=='bot' && p.projectIds.includes(projectId),'SCOPE_DENIED','Dự án ngoài phạm vi được cấp.',403);
    const permitted=(permission:ReportPermission)=>can(p,projectId,permission)?projectId:'';
    return scoped(this.db,{...p,projectIds:[projectId]},async tx=>{
      await tx.query(`SELECT set_config('app.person_id',$1,true),set_config('app.people_projects',$2,true),
        set_config('app.review_projects',$3,true),set_config('app.approve_projects',$4,true)`,
        [p.id,permitted('people_read'),permitted('quality_review'),permitted('report_approve')]);
      return fn(tx);
    });
  }

  async read(p:Principal,raw:unknown) {
    const {projectId,runId,subjectId}=view.parse(raw);
    invariant(!subjectId||subjectId===p.id||can(p,projectId,'people_read'),'SCOPE_DENIED','Chưa được cấp quyền xem điểm nhân sự này.',403);
    return this.within(p,projectId,async tx=>{
      const periods=(await tx.query<Run>(`SELECT ${metadata} FROM analytics.evidence_runs
        WHERE project_id=$1 AND ($2 OR NOT synthetic) ORDER BY period_start DESC,as_of DESC,created_at DESC LIMIT 100`,
        [projectId,this.includeSynthetic])).rows;
      const selected=runId??periods[0]?.id;
      if(!selected) return {periods,run:null,project:null,person:null,people:[],actions:[],canReview:false,canApprove:false};
      const run=(await tx.query<Run&{summary:ProjectResult}>(`SELECT ${metadata},summary FROM analytics.evidence_runs
        WHERE id=$1 AND project_id=$2 AND ($3 OR NOT synthetic)`,[selected,projectId,this.includeSynthetic])).rows[0];
      invariant(run,'SCOPE_DENIED','Không tìm thấy kỳ trong dự án được cấp.',404);
      const subject=subjectId??p.id;
      const people=(await tx.query<{user_id:string;name:string}>("SELECT user_id,result->>'name' AS name FROM analytics.evidence_people WHERE run_id=$1 ORDER BY name",[run.id])).rows;
      const person=(await tx.query<PersonRow>('SELECT user_id,result FROM analytics.evidence_people WHERE run_id=$1 AND user_id=$2',[run.id,subject])).rows[0]??null;
      const actions=(await tx.query<ActionRow>('SELECT kind,detail,created_at FROM public.report_actions WHERE run_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 100',[run.id,subject])).rows;
      const {summary,...runMetadata}=run;
      return {periods,run:runMetadata,project:summary,person,people,actions,
        canReview:person!==null&&subject!==p.id&&can(p,projectId,'quality_review'),
        canApprove:person!==null&&subject!==p.id&&can(p,projectId,'report_approve')&&run.policy_approved&&!run.synthetic};
    });
  }

  async command(p:Principal,raw:unknown) {
    const cmd=action.parse(raw);
    const self=cmd.subjectId===p.id;
    invariant(cmd.kind==='correction'?self:!self&&can(p,cmd.projectId,'people_read')&&
      can(p,cmd.projectId,cmd.kind==='approval'?'report_approve':'quality_review'),
      'REPORT_ACTION_DENIED','Thao tác ngoài quyền đánh giá được giao.',403);
    return this.within(p,cmd.projectId,async tx=>{
      const run=(await tx.query<Pick<Run,'policy_approved'|'synthetic'>>(`SELECT policy_approved,synthetic FROM analytics.evidence_runs
        WHERE id=$1 AND project_id=$2 AND ($3 OR NOT synthetic)`,[cmd.runId,cmd.projectId,this.includeSynthetic])).rows[0];
      invariant(run,'SCOPE_DENIED','Không tìm thấy kỳ trong dự án được cấp.',404);
      const row=(await tx.query<PersonRow>('SELECT user_id,result FROM analytics.evidence_people WHERE run_id=$1 AND user_id=$2',[cmd.runId,cmd.subjectId])).rows[0];
      invariant(row||cmd.kind==='correction','SCOPE_DENIED','Chưa có hồ sơ nhân sự được cấp.',404);
      if(cmd.kind==='approval') invariant(run.policy_approved&&!run.synthetic&&row.result.total!==null,
        'APPROVAL_NOT_READY','Cần đủ bằng chứng và chính sách đã duyệt trước khi chốt điểm.',422);
      if(cmd.kind==='quality_review') invariant(row.result.reviewableEvidenceIds.includes(cmd.evidenceId),
        'EVIDENCE_NOT_REVIEWABLE','Chọn phản hồi hợp lệ trong kỳ này.',422);
      const detail=cmd.kind==='quality_review'?{reason:cmd.reason,evidenceId:cmd.evidenceId,criteria:cmd.criteria}:{reason:cmd.reason};
      const inserted=(await tx.query<{id:string}>(`INSERT INTO public.report_actions
        (tenant_id,project_id,run_id,user_id,actor_id,request_key,kind,detail)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING id`,
        [p.tenantId,cmd.projectId,cmd.runId,cmd.subjectId,p.id,cmd.requestKey,cmd.kind,JSON.stringify(detail)])).rows[0];
      if(inserted) return {id:inserted.id,replayed:false};
      const previous=(await tx.query<{id:string}>(`SELECT id FROM public.report_actions WHERE actor_id=$1 AND request_key=$2
        AND run_id=$3 AND user_id=$4 AND kind=$5 AND detail=$6::jsonb`,[p.id,cmd.requestKey,cmd.runId,cmd.subjectId,cmd.kind,JSON.stringify(detail)])).rows[0];
      invariant(previous,'REPORT_ACTION_CONFLICT','Yêu cầu đã được dùng hoặc bản điểm đã chốt.',409);
      return {id:previous.id,replayed:true};
    });
  }
}
