import { z } from 'zod';
import { invariant } from './errors';
import { calendarSchema,workingDueAt } from './working-time';

const instant=z.iso.datetime({offset:true});
const sha=z.string().regex(/^[a-f0-9]{40}$/);
const key=z.string().min(1).max(160);
const workCode=z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,39}$/);
const span=z.object({start:instant,end:instant,asOf:instant}).strict();
const provenance=z.object({
  id:key,workCode,source_id:z.string().min(1).max(1000),
  source_type:z.enum(['workbook','telegram','github','uat','release','audit']),
  ingested_at:instant,quality_score:z.number().min(0).max(1),
  occurredAt:instant,title:z.string().min(1).max(180),detail:z.string().max(1000),
  confidence:z.enum(['reported','observed','verified']),sourceSha:sha.optional(),
}).strict();
const projectWork=z.object({
  code:workCode,title:z.string().min(1).max(200),sourceStatus:z.string().min(1).max(120),
  technical:z.enum(['pending','verified']),business:z.enum(['pending','verified']),
  sourceSha:sha,sourceObservedAt:instant,gaps:z.array(z.string().min(1).max(300)).max(20),
  dueAt:instant.nullable(),
}).strict();
const scoreKey=z.enum(['K1','K2','K3','K4']);
const weight=z.object({K1:z.number().min(0).max(1),K2:z.number().min(0).max(1),K3:z.number().min(0).max(1),K4:z.number().min(0).max(1)}).strict()
  .refine(weights=>Math.abs(Object.values(weights).reduce((sum,value)=>sum+value,0)-1)<1e-9,'Trọng số phải có tổng bằng 1.');
const scorePolicy=z.object({
  version:key,approvedRef:z.string().trim().min(6).max(1000).nullable(),weights:weight,
  minimum:z.object({K1:z.number().int().positive(),K2:z.number().int().positive(),K3:z.number().int().positive()}).strict(),
  coverage:z.number().positive().max(1),reviewCoverage:z.number().positive().max(1),calendar:calendarSchema.optional(),
}).strict();
const subject=z.object({id:z.uuid(),name:z.string().min(1).max(120),githubTarget:z.number().int().positive().nullable(),githubCoverage:z.boolean()}).strict();
const scoredItem={id:key,workCode,userId:z.uuid(),evidenceId:key};
const delivery=z.object({...scoredItem,dueAt:instant.nullable(),coverage:z.boolean(),submittedAt:instant.nullable(),submissionEvidenceId:key.nullable()}).strict();
const request=z.object({...scoredItem,deliveredAt:instant.nullable(),dueAt:instant.nullable(),coverage:z.boolean(),slaMinutes:z.number().int().min(1).max(14400).optional()}).strict();
const reply=z.object({requestId:key,userId:z.uuid(),evidenceId:key,kind:z.enum(['ack','substantive']),version:z.number().int().positive()}).strict();
const review=z.object({evidenceId:key,reviewerId:z.uuid(),at:instant,criteria:z.tuple([z.boolean(),z.boolean(),z.boolean()])}).strict();
const contribution=z.object({...scoredItem,unitKey:key,githubId:z.string().regex(/^[1-9][0-9]{0,19}$/),accepted:z.boolean()}).strict();
export const reportInput=z.object({
  tenantId:z.uuid(),projectId:z.uuid(),synthetic:z.boolean(),period:span,policy:scorePolicy,
  subjects:z.array(subject).max(200),works:z.array(projectWork).max(500),evidence:z.array(provenance).max(5000),
  deliveries:z.array(delivery).max(3000),requests:z.array(request).max(5000),replies:z.array(reply).max(10000),
  reviews:z.array(review).max(5000),contributions:z.array(contribution).max(5000),
}).strict();
export type ReportInput=z.infer<typeof reportInput>;
export type EvidenceFact=z.infer<typeof provenance>;
export type ScoreKey=z.infer<typeof scoreKey>;
type MetricStatus='DRAFT'|'PENDING_EVIDENCE'|'PENDING_REVIEW'|'NOT_APPLICABLE';
export type Metric={
  key:ScoreKey;status:MetricStatus;value:number|null;numerator:number;denominator:number;
  missing:number;coverage:number|null;evidenceIds:string[];
};
export type PersonResult={
  name:string;metrics:Metric[];total:number|null;status:'DRAFT'|'PENDING_EVIDENCE'|'PENDING_REVIEW';
  reviewableEvidenceIds:string[];evidence:EvidenceFact[];
};
export type ProjectResult={
  works:(z.infer<typeof projectWork>&{overdue:boolean;facts:EvidenceFact[]})[];
  summary:{works:number;sourceCompleted:number;technical:number;business:number;missingDue:number;overdue:number;openRequests:number;unknownRequests:number};
  contributions:{workCode:string;label:string;kind:'delivery'|'reply'|'github';evidenceId:string}[];
};
const millis=(value:string)=>Date.parse(value);

function index<T>(rows:T[],id:(row:T)=>string) {
  const result=new Map<string,T>();
  for(const row of rows){
    const key=id(row);
    const previous=result.get(key);
    invariant(!previous || JSON.stringify(previous)===JSON.stringify(row),'CONFLICTING_EVENT','Cùng mã sự kiện có nội dung khác nhau.',422);
    result.set(key,row);
  }
  return result;
}

function metrics(key:ScoreKey,numerator:number,denominator:number,missing:number,minimum:number,threshold:number,
  evidenceIds:string[],pending:MetricStatus='PENDING_EVIDENCE',eligible=denominator+missing):Metric {
  const coverage=eligible?denominator/eligible:null;
  const ready=denominator>=minimum && coverage!==null && coverage>=threshold;
  return {key,status:ready?'DRAFT':pending,value:ready?Math.min(100,100*numerator/denominator):null,
    numerator,denominator,missing,coverage,evidenceIds:[...new Set(evidenceIds)]};
}

export function calculateEvidenceReport(raw:unknown) {
  const input=reportInput.parse(raw);
  const start=millis(input.period.start),end=millis(input.period.end),asOf=millis(input.period.asOf);
  invariant(start<end&&start<=asOf,'INVALID_PERIOD','Kỳ báo cáo không hợp lệ.',422);
  const inPeriod=(value:string)=>millis(value)>=start&&millis(value)<end&&millis(value)<=asOf;
  const past=(value:string)=>millis(value)<=asOf;
  const works=index(input.works,row=>row.code),subjects=index(input.subjects,row=>row.id);
  const evidence=index(input.evidence,row=>row.id);
  const sourceKeys=new Map<string,string>();
  for(const fact of evidence.values()){
    invariant(works.has(fact.workCode)&&past(fact.occurredAt)&&past(fact.ingested_at),
      'EVIDENCE_OUT_OF_SCOPE','Bằng chứng ngoài việc hoặc mốc chốt báo cáo.',422);
    const sourceKey=JSON.stringify([fact.source_type,fact.source_id]);
    invariant(!sourceKeys.has(sourceKey)||sourceKeys.get(sourceKey)===fact.id,
      'DUPLICATE_SOURCE','Dùng chung mã bằng chứng cho cùng một sự kiện nguồn.',422);
    sourceKeys.set(sourceKey,fact.id);
  }
  const verifyRef=(evidenceId:string,work:string)=> {
    const fact=evidence.get(evidenceId);
    invariant(fact?.workCode===work,'EVIDENCE_OUT_OF_SCOPE','Bằng chứng không khớp mã việc.',422);
    return fact;
  };
  const deliveries=[...index(input.deliveries,row=>row.workCode).values()];
  const requests=[...index(input.requests,row=>row.id).values()].map(row=>{
    if(row.slaMinutes===undefined||!row.deliveredAt) return row;
    if(!input.policy.calendar) return {...row,dueAt:null,coverage:false};
    const dueAt=workingDueAt(row.deliveredAt,row.slaMinutes,input.policy.calendar);
    invariant(!row.dueAt||millis(row.dueAt)===millis(dueAt),'DUE_MISMATCH','Hạn phản hồi lệch với lịch và SLA đã chọn.',422);
    return {...row,dueAt};
  });
  const requestsById=new Map(requests.map(row=>[row.id,row]));
  const contributions=[...index(input.contributions,row=>row.id).values()];
  for(const event of [...deliveries,...requests,...contributions]){
    invariant(subjects.has(event.userId),'UNKNOWN_SUBJECT','Chưa xác nhận người thực hiện.',422);
    verifyRef(event.evidenceId,event.workCode);
  }
  for(const delivery of deliveries){
    if(delivery.submissionEvidenceId){
      const fact=verifyRef(delivery.submissionEvidenceId,delivery.workCode);
      invariant(delivery.submittedAt && millis(delivery.submittedAt)===millis(fact.occurredAt),
        'EVIDENCE_TIME_MISMATCH','Mốc bàn giao cần khớp bằng chứng.',422);
    }
  }
  const firstReplies=new Map<string,EvidenceFact>();
  const replyVersions=new Map<string,EvidenceFact>();
  const replyTargets=new Map<string,string>();
  for(const reply of index(input.replies,row=>JSON.stringify([row.requestId,row.evidenceId,row.version])).values()){
    const target=requestsById.get(reply.requestId);
    invariant(target,'UNKNOWN_REQUEST','Phản hồi chưa gắn với yêu cầu.',422);
    const fact=verifyRef(reply.evidenceId,target.workCode);
    if(reply.kind!=='substantive'||reply.userId!==target.userId||!target.deliveredAt||fact.source_type!=='telegram'||
      fact.confidence!=='verified'||millis(fact.occurredAt)<millis(target.deliveredAt)) continue;
    const already=replyTargets.get(fact.id);
    invariant(!already||already===target.id,'DUPLICATE_REPLY','Một phản hồi chỉ được quy cho một yêu cầu.',422);
    replyTargets.set(fact.id,target.id);
    const earlier=firstReplies.get(target.id);
    if(!earlier || millis(earlier.occurredAt)>millis(fact.occurredAt) ||
      (millis(earlier.occurredAt)===millis(fact.occurredAt)&&earlier.id>fact.id)) firstReplies.set(target.id,fact);
    replyVersions.set(fact.id,fact);
  }
  const reviews=new Map<string,z.infer<typeof review>>();
  for(const row of input.reviews){
    invariant(replyVersions.has(row.evidenceId),'UNKNOWN_REVIEW','Đánh giá chưa gắn phản hồi hợp lệ.',422);
    if(!past(row.at)||millis(row.at)<millis(replyVersions.get(row.evidenceId)!.occurredAt)) continue;
    const existing=reviews.get(row.evidenceId);
    if(existing&&millis(existing.at)===millis(row.at))
      invariant(JSON.stringify(existing)===JSON.stringify(row),'CONFLICTING_REVIEW','Đánh giá cùng thời điểm có xung đột.',422);
    if(!existing||millis(existing.at)<millis(row.at)) reviews.set(row.evidenceId,row);
  }
  const requestEligible=(row:z.infer<typeof request>)=>Boolean(row.coverage&&row.deliveredAt&&row.dueAt&&
    millis(row.dueAt)>=millis(row.deliveredAt)&&inPeriod(row.dueAt)&&verifyRef(row.evidenceId,row.workCode).confidence==='verified');
  const activity:ProjectResult['contributions']=[];
  const people=new Map<string,PersonResult>();
  const policy=input.policy;
  for(const person of subjects.values()){
    const assigned=deliveries.filter(row=>row.userId===person.id&&(!row.dueAt||inPeriod(row.dueAt)));
    const due=assigned.filter(row=>row.dueAt&&row.coverage&&verifyRef(row.evidenceId,row.workCode).confidence==='verified');
    const onTime=due.filter(row=>row.submittedAt&&row.submissionEvidenceId&&
      verifyRef(row.submissionEvidenceId,row.workCode).confidence==='verified'&&millis(row.submittedAt)<=millis(row.dueAt!));
    const k1=metrics('K1',onTime.length,due.length,assigned.length-due.length,policy.minimum.K1,policy.coverage,
      assigned.flatMap(row=>row.submissionEvidenceId?[row.evidenceId,row.submissionEvidenceId]:[row.evidenceId]));
    for(const row of due){
      if(row.submissionEvidenceId&&verifyRef(row.submissionEvidenceId,row.workCode).confidence==='verified')
        activity.push({workCode:row.workCode,label:person.name,kind:'delivery',evidenceId:row.submissionEvidenceId});
    }
    const allRequests=requests.filter(row=>row.userId===person.id&&(!row.dueAt||inPeriod(row.dueAt)));
    const eligible=allRequests.filter(requestEligible);
    const replied=eligible.flatMap(row=>{
      const fact=firstReplies.get(row.id);
      return fact?[{row,fact}]:[];
    });
    const k2=metrics('K2',replied.filter(({row,fact})=>millis(fact.occurredAt)<=millis(row.dueAt!)).length,
      eligible.length,allRequests.length-eligible.length,policy.minimum.K2,policy.coverage,
      [...allRequests.map(row=>row.evidenceId),...replied.map(({fact})=>fact.id)]);
    for(const {row,fact} of replied) activity.push({workCode:row.workCode,label:person.name,kind:'reply',evidenceId:fact.id});
    const assessed=replied.flatMap(({fact})=>{
      const row=reviews.get(fact.id);
      invariant(!row||row.reviewerId!==person.id,'SELF_REVIEW','Không thể tự chấm phản hồi của mình.',403);
      return row?[row]:[];
    });
    const k3=metrics('K3',assessed.reduce((sum,row)=>sum+row.criteria.filter(Boolean).length,0),assessed.length*3,
      (replied.length-assessed.length)*3,policy.minimum.K3*3,policy.reviewCoverage,replied.map(({fact})=>fact.id),'PENDING_REVIEW');
    const units=new Map<string,z.infer<typeof contribution>>();
    const candidates=contributions.filter(row=>row.userId===person.id).sort((a,b)=>a.id.localeCompare(b.id));
    const countedFacts=new Set<string>();
    for(const row of candidates){
      const fact=verifyRef(row.evidenceId,row.workCode);
      if(row.accepted&&fact.source_type==='github'&&fact.confidence==='verified'&&inPeriod(fact.occurredAt)&&
        !units.has(row.unitKey)&&!countedFacts.has(fact.id)){
        units.set(row.unitKey,row);
        countedFacts.add(fact.id);
      }
    }
    for(const row of units.values()) activity.push({workCode:row.workCode,label:person.name,kind:'github',evidenceId:row.evidenceId});
    const k4=metrics('K4',units.size,person.githubTarget??0,person.githubCoverage?0:1,1,policy.coverage,candidates.map(row=>row.evidenceId));
    if(!person.githubCoverage || !person.githubTarget) {
      k4.value=null;
      k4.status='PENDING_EVIDENCE';
      k4.coverage=person.githubCoverage?1:null;
    }
    const items=[k1,k2,k3,k4];
    for(const item of items){
      if(policy.weights[item.key]===0){
        item.status='NOT_APPLICABLE';
        item.value=null;
      }
    }
    const weighted=items.filter(item=>policy.weights[item.key]>0);
    const ready=weighted.every(item=>item.value!==null);
    const total=ready?Math.round(weighted.reduce((sum,item)=>sum+policy.weights[item.key]*(item.value??0),0)*100)/100:null;
    const status=ready?'DRAFT':weighted.some(item=>item.status==='PENDING_REVIEW')?'PENDING_REVIEW':'PENDING_EVIDENCE';
    const refs=[...new Set(items.flatMap(item=>item.evidenceIds))].map(id=>evidence.get(id)!);
    people.set(person.id,{name:person.name,metrics:items,total,status,evidence:refs,
      reviewableEvidenceIds:replied.map(({fact})=>fact.id)});
  }
  const projectWorks=[...works.values()].map(work=>({...work,overdue:Boolean(work.dueAt&&millis(work.dueAt)<asOf&&work.business!=='verified'),
    facts:[...evidence.values()].filter(fact=>fact.workCode===work.code).sort((a,b)=>millis(a.occurredAt)-millis(b.occurredAt))}));
  const project:ProjectResult={
    works:projectWorks,contributions:activity,
    summary:{works:works.size,sourceCompleted:projectWorks.filter(row=>row.sourceStatus==='Hoàn thành').length,
      technical:projectWorks.filter(row=>row.technical==='verified').length,business:projectWorks.filter(row=>row.business==='verified').length,
      missingDue:projectWorks.filter(row=>!row.dueAt).length,overdue:projectWorks.filter(row=>row.overdue).length,
      openRequests:requests.filter(row=>requestEligible(row)&&!firstReplies.has(row.id)).length,
      unknownRequests:requests.filter(row=>!row.dueAt||(inPeriod(row.dueAt)&&!requestEligible(row))).length},
  };
  return {input,project,people};
}
