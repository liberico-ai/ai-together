import { z } from 'zod';
import { scoped,type Database } from './db';
import { invariant } from './errors';
import { projectRole,type Principal } from './types';

const input=z.object({projectId:z.uuid(),requestKey:z.uuid(),kind:z.enum(['bug','idea']),
 title:z.string().trim().min(5).max(140),description:z.string().trim().min(20).max(4000),
 pagePath:z.string().startsWith('/').max(300).refine(x=>!x.startsWith('//')),
 expected:z.string().trim().max(2000).default(''),actual:z.string().trim().max(2000).default('')}).strict();
const command=z.object({projectId:z.uuid(),reportId:z.uuid(),requestKey:z.uuid(),
 expectedVersion:z.number().int().positive(),state:z.enum(['reviewing','closed']),
 reason:z.string().trim().min(5).max(1000)}).strict();

export class FeedbackService {
 constructor(private db:Database){}
 async list(p:Principal) {
  invariant(p.role!=='bot','SCOPE_DENIED','Cần tài khoản thành viên.',403);
  return scoped(this.db,p,async tx=>(await tx.query(`SELECT id,project_id,reporter_id,kind,title,
    description,page_path,expected,actual,state,version,created_at FROM feedback_reports
    WHERE reporter_id=$1 OR project_id=ANY($2::uuid[]) ORDER BY created_at DESC LIMIT 200`,
    [p.id,p.grants?.filter(g=>g.role==='manager').map(g=>g.projectId)??[]])).rows);
 }
 async create(p:Principal,raw:unknown) {
  const x=input.parse(raw);
  invariant(p.role!=='bot' && p.projectIds.includes(x.projectId) && projectRole(p,x.projectId)!=='bot',
    'SCOPE_DENIED','Dự án ngoài phạm vi được cấp.',403);
  return scoped(this.db,{...p,projectIds:[x.projectId]},async tx=>{
   const values=[p.tenantId,x.projectId,p.id,x.requestKey,x.kind,x.title,x.description,
    x.pagePath,x.expected,x.actual];
   const row=(await tx.query<{id:string}>(`INSERT INTO feedback_reports
     (tenant_id,project_id,reporter_id,request_key,kind,title,description,page_path,expected,actual)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING id`,values)).rows[0];
   if(row) return {id:row.id,replayed:false};
   const prior=(await tx.query<{id:string}>(`SELECT id FROM feedback_reports WHERE tenant_id=$1 AND
     project_id=$2 AND reporter_id=$3 AND request_key=$4 AND kind=$5 AND title=$6 AND description=$7 AND
     page_path=$8 AND expected=$9 AND actual=$10`,values)).rows[0];
   invariant(prior,'FEEDBACK_KEY_CONFLICT','Yêu cầu đã dùng cho nội dung khác.',409);
   return {id:prior.id,replayed:true};
  });
 }
 async resolve(p:Principal,raw:unknown) {
  const x=command.parse(raw);
  invariant(p.projectIds.includes(x.projectId)&&projectRole(p,x.projectId)==='manager',
    'FEEDBACK_MANAGER_REQUIRED','Cần quyền điều phối trong dự án.',403);
  return scoped(this.db,{...p,projectIds:[x.projectId]},async tx=>{
   const prior=(await tx.query<{id:string;project_id:string;report_id:string;prior_version:number;next_state:string;reason:string}>(`
    SELECT id,project_id,report_id,prior_version,next_state,reason FROM feedback_actions
    WHERE tenant_id=$1 AND actor_id=$2 AND request_key=$3`,[p.tenantId,p.id,x.requestKey])).rows[0];
   if(prior) {
    invariant(prior.project_id===x.projectId&&prior.report_id===x.reportId&&
     prior.prior_version===x.expectedVersion&&prior.next_state===x.state&&prior.reason===x.reason,
      'FEEDBACK_KEY_CONFLICT','Yêu cầu đã dùng cho nội dung khác.',409);
    return {id:prior.id,replayed:true};
   }
   const report=(await tx.query<{state:string;version:number}>(`
    SELECT state,version FROM feedback_reports WHERE id=$1 AND project_id=$2 FOR UPDATE`,
    [x.reportId,x.projectId])).rows[0];
   invariant(report,'SCOPE_DENIED','Không tìm thấy phản hồi trong dự án.',404);
   invariant(report.version===x.expectedVersion,'VERSION_CONFLICT','Phản hồi đã đổi. Tải lại trước khi xử lý.',409);
   invariant((report.state==='new'&&['reviewing','closed'].includes(x.state))||
    (report.state==='reviewing'&&x.state==='closed'),
    'FEEDBACK_STATE_CONFLICT','Trạng thái chuyển không hợp lệ.',409);
   await tx.query(`UPDATE feedback_reports SET state=$3,version=version+1,updated_at=now()
    WHERE id=$1 AND project_id=$2`,[x.reportId,x.projectId,x.state]);
   const action=(await tx.query<{id:string}>(`INSERT INTO feedback_actions
    (tenant_id,project_id,report_id,actor_id,request_key,prior_version,next_state,reason)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [p.tenantId,x.projectId,x.reportId,p.id,x.requestKey,x.expectedVersion,x.state,x.reason])).rows[0];
   return {id:action.id,replayed:false};
  });
 }
}
