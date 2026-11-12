import type { EvidenceFact,ReportInput } from '../src/server/evidence-scores';

const time=(hm:string)=>'2026-11-09T'+hm+':00+07:00';
export function scoreFixture(tenantId:string,projectId:string,user:{id:string;name:string},reviewerId:string):ReportInput {
  const evidence:EvidenceFact[]=[];
  const workCode='FIX-001';
  const put=(id:string,hm:string,type:EvidenceFact['source_type'],code=workCode)=>{
    evidence.push({id,workCode:code,source_id:'fixture:'+id,source_type:type,ingested_at:time('17:10'),
      quality_score:1,occurredAt:time(hm),title:id,detail:'Dữ liệu giả lập',confidence:'verified'});
    return id;
  };
  const deliveries=['FIX-001','FIX-002'].map((code,i)=>({
    id:'delivery-'+i,workCode:code,userId:user.id,dueAt:time('11:00'),coverage:true,
    evidenceId:put('assign-'+i,'08:00','workbook',code),submittedAt:time(i?'11:30':'10:00'),
    submissionEvidenceId:put('submitted-'+i,i?'11:30':'10:00','audit',code),
  }));
  const requests=[0,1,2].map(i=>({id:'request-'+i,workCode,userId:user.id,
    evidenceId:put('request-'+i,'09:00','telegram'),deliveredAt:i===2?null:time('09:00'),dueAt:i===2?null:time('10:00'),coverage:i!==2}));
  const replies=[
    {requestId:'request-0',userId:user.id,evidenceId:put('ack-0','09:05','telegram'),kind:'ack' as const,version:1},
    {requestId:'request-0',userId:user.id,evidenceId:put('reply-0','09:30','telegram'),kind:'substantive' as const,version:1},
    {requestId:'request-1',userId:user.id,evidenceId:put('reply-1','10:30','telegram'),kind:'substantive' as const,version:1},
  ];
  const github={id:'event-gh',workCode,userId:user.id,evidenceId:put('merged-pr','12:00','github'),unitKey:'repo-1/pull/1',githubId:'12345',accepted:true};
  return {
    tenantId,projectId,synthetic:true,period:{start:time('00:00'),end:'2026-11-16T00:00:00+07:00',asOf:time('17:30')},
    policy:{version:'fixture-E01',approvedRef:null,weights:{K1:.35,K2:.2,K3:.25,K4:.2},minimum:{K1:2,K2:2,K3:2},coverage:.65,reviewCoverage:1},
    subjects:[{id:user.id,name:user.name,githubTarget:2,githubCoverage:true}],
    works:['FIX-001','FIX-002'].map(code=>({code,title:'Ca giả lập '+code,sourceStatus:'Đang làm',
      technical:'pending',business:'pending',sourceSha:'1'.repeat(40),sourceObservedAt:time('17:00'),gaps:[],dueAt:time('11:00')})),
    evidence,deliveries,requests,replies,
    reviews:[{reviewerId,evidenceId:'reply-0',at:time('13:00'),criteria:[true,true,true]},
      {reviewerId,evidenceId:'reply-1',at:time('13:00'),criteria:[true,false,false]}],
    contributions:[github,{...github,id:'event-gh-replay'}],
  };
}
