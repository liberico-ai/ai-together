// The trail of one message: received, triaged, request or link, BoM decision, and who it waits for (GIAO VIỆC 5 B). Pure; no I/O.
// It is built from the rows the viewer may read. A step is shown only from its own row, never inferred from another; «received» proves the first step only.
export type TrailRequest={id:string;state:'pending'|'approved'|'rejected';filedAt:string|null;filedBy:string|null;decidedBy:string|null;decidedAt:string|null;workCode:string|null};
export type TrailInput={
 kind:'candidate'|'pool';receivedAt:string;
 candidateState?:'new'|'needs_info'|'confirmed'|'duplicate'|'dismissed';
 poolState?:'unassigned'|'assigned'|'dismissed';
 projectName:string|null;triagedAt:string|null;triagedBy:string|null;
 /** the requests the viewer may read (the requester, the decider and BoM seats read them) */
 requests:TrailRequest[];
 /** the links to existing work the viewer may read */
 workLinks:{workCode:string|null;at:string}[];
 /** links that exist but the viewer may not read: they show that something was made, never what */
 hiddenLinks:number;
 /** a BoM scope is enabled for the project; null when the viewer cannot tell */
 seatOpen:boolean|null;
};
export type TrailStep={key:'received'|'triaged'|'request'|'decision';label:string;state:'done'|'waiting'|'skipped';at:string|null;actor:string|null};
export type IntakeTrail={label:string;waitingOn:string;steps:TrailStep[]};

export const NEUTRAL_WAIT='Yêu cầu chờ ghế BoM của dự án.';
export const WAIT_TRIAGER='người phân loại (Team Tech)',WAIT_MANAGER='điều phối dự án',WAIT_SEAT='ghế BoM của dự án',WAIT_NO_SEAT='dự án chưa có ghế BoM';
const latest=<T>(xs:T[],at:(x:T)=>string|null):T|undefined=>[...xs].sort((a,b)=>(at(b)??'').localeCompare(at(a)??''))[0];

export function intakeTrail(i:TrailInput):IntakeTrail {
 const pending=latest(i.requests.filter(r=>r.state==='pending'),r=>r.filedAt);
 const approved=latest(i.requests.filter(r=>r.state==='approved'),r=>r.decidedAt);
 const rejected=latest(i.requests.filter(r=>r.state==='rejected'),r=>r.decidedAt);
 const made=i.requests.length>0||i.workLinks.length>0||i.hiddenLinks>0;
 const closed=i.kind==='pool'?i.poolState==='dismissed':(i.candidateState==='dismissed'||i.candidateState==='duplicate');
 const triaged:TrailStep=i.kind==='pool'
  ?{key:'triaged',label:i.poolState==='unassigned'?'Chờ phân loại':i.poolState==='dismissed'?'Đã bỏ qua':'Đã phân loại và gán dự án',state:i.poolState==='unassigned'?'waiting':'done',at:i.triagedAt,actor:i.triagedBy}
  :{key:'triaged',label:i.candidateState==='confirmed'?'Điều phối đã xác nhận':'Chờ điều phối xác nhận',state:i.candidateState==='confirmed'?'done':'waiting',at:null,actor:null};
 const received:TrailStep={key:'received',label:'Đã nhận tin',state:'done',at:i.receivedAt,actor:null};
 const request:TrailStep={key:'request',label:made?'Có yêu cầu hoặc liên kết việc':'Chưa thấy yêu cầu hay liên kết việc nào trong phạm vi của bạn',
  state:made?'done':(triaged.state==='done'&&!closed?'waiting':'skipped'),at:latest(i.requests,r=>r.filedAt)?.filedAt??null,actor:latest(i.requests,r=>r.filedAt)?.filedBy??null};
 const decided=approved??rejected;
 const decision:TrailStep=pending?{key:'decision',label:'Chờ BoM duyệt',state:'waiting',at:null,actor:null}
  :decided?{key:'decision',label:decided.state==='approved'?'BoM đã duyệt':'BoM đã từ chối',state:'done',at:decided.decidedAt,actor:decided.decidedBy}
  :{key:'decision',label:'Chưa có quyết định BoM',state:'skipped',at:null,actor:null};
 const steps=[received,triaged,request,decision];

 if(pending) return {steps,label:'Đã lập yêu cầu — chờ BoM duyệt',waitingOn:i.seatOpen===false?WAIT_NO_SEAT:i.seatOpen===true?WAIT_SEAT:NEUTRAL_WAIT};
 if(approved) return {steps,label:`Đã duyệt — việc ${approved.workCode??''}`.trim(),waitingOn:''};
 if(i.workLinks.length) return {steps,label:'Đã liên kết việc '+i.workLinks.map(l=>l.workCode).filter(Boolean).join(', '),waitingOn:''};
 if(rejected) return {steps,label:'Bị từ chối',waitingOn:''};
 if(i.hiddenLinks>0) return {steps,label:`Đã gán dự án ${i.projectName??''}`.trim(),waitingOn:NEUTRAL_WAIT};
 if(closed) return {steps,label:'Đã bỏ qua',waitingOn:''};
 if(i.kind==='pool'&&i.poolState==='unassigned') return {steps,label:'Đã nhận — chưa gán dự án',waitingOn:WAIT_TRIAGER};
 // nothing the viewer may read: the copy neither says work exists nor that it does not
 return {steps,label:'Đã nhận — chưa thấy yêu cầu hay việc nào trong phạm vi của bạn',waitingOn:i.kind==='candidate'?WAIT_MANAGER:''};
}
