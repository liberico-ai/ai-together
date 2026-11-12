'use client';
import { useEffect,useState,type FormEvent } from 'react';
import { api } from './api';
import type { ReportService } from '@/server/reports';
import type { EvidenceFact } from '@/server/evidence-scores';
import type { Project } from '@/server/types';

type Report=Awaited<ReturnType<ReportService['read']>>;
const date=(value:string)=>new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'});
const number=(value:number)=>value.toLocaleString('vi-VN',{maximumFractionDigits:2});
const metricNames={K1:'Bàn giao đúng hạn',K2:'Phản hồi đúng hạn',K3:'Chất lượng phản hồi',K4:'Đóng góp GitHub'};
const stateNames={DRAFT:'Điểm nháp',PENDING_EVIDENCE:'Chờ bằng chứng',PENDING_REVIEW:'Chờ đánh giá',NOT_APPLICABLE:'Ngoài phạm vi'};
const factLabels={reported:'Lời báo',observed:'Đã quan sát',verified:'Đã đối chiếu'};
const metricUnits={K1:'việc',K2:'yêu cầu',K3:'điểm rubric',K4:'đơn vị đóng góp'};
const actionLabels={correction:'Đề nghị đính chính',quality_review:'Rà chất lượng',approval:'Chốt kết quả'};

function Fact({fact}:{fact:EvidenceFact}) {
  const github=fact.source_type==='github'&&/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(commit|pull)\/[a-z0-9]+$/.test(fact.source_id);
  return <article className="evidence-fact" id={'evidence-'+fact.id}>
    <strong>{fact.title}</strong><span className="report-tag">{factLabels[fact.confidence]} · {fact.workCode}</span>
    <p>{fact.detail}</p><small>{date(fact.occurredAt)} · {fact.source_type}</small>
    <div className="report-source">{github?<a href={fact.source_id} target="_blank" rel="noreferrer">Mở nguồn GitHub</a>:<code>{fact.source_id}</code>}</div>
    {fact.sourceSha&&<code className="report-source">{fact.sourceSha}</code>}
  </article>;
}

function ReportActions({report,viewerId,reload}:{report:Report;viewerId:string;reload:()=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
  if(!report.run) return null;
  const run=report.run;
  const subjectId=report.person?.user_id??viewerId;
  async function submit(event:FormEvent<HTMLFormElement>,kind:keyof typeof actionLabels) {
    event.preventDefault();
    const form=new FormData(event.currentTarget),element=event.currentTarget;
    setBusy(true);setError('');setSaved('');
    try {
      await api('/api/team/reports',{projectId:run.project_id,runId:run.id,subjectId,kind,
        requestKey:crypto.randomUUID(),reason:form.get('reason'),
        ...(kind==='quality_review'?{evidenceId:form.get('evidenceId'),criteria:['answers','evidence','next'].map(key=>form.has(key))}:{})});
      setSaved(kind==='quality_review'?'Đã ghi rà soát. Bản tính kế tiếp sẽ sử dụng kết quả này.':'Đã lưu vào lịch sử của kỳ.');
      element.reset();
      reload();
    } catch(error){setError((error as Error).message);}
    finally {setBusy(false);}
  }
  return <section className="panel team-form">
    <h2>Rà soát kết quả</h2>
    {error&&<p role="alert" className="notice error">{error}</p>}
    {saved&&<p role="status" className="notice success">{saved}</p>}
    {subjectId===viewerId&&<form className="action-form" onSubmit={event=>submit(event,'correction')}>
      <label>Đề nghị đính chính và mã bằng chứng<textarea required minLength={5} maxLength={800} name="reason"/></label>
      <button className="secondary" disabled={busy}>Gửi đề nghị</button>
    </form>}
    {report.canReview&&Boolean(report.person?.result.reviewableEvidenceIds.length)&&<form className="action-form" onSubmit={event=>submit(event,'quality_review')}>
      <label>Phản hồi cần rà<select name="evidenceId" required><option value="">Chọn phản hồi</option>
        {report.person?.result.evidence.filter(fact=>report.person?.result.reviewableEvidenceIds.includes(fact.id))
          .map(fact=><option key={fact.id} value={fact.id}>{fact.workCode} · {fact.title}</option>)}
      </select></label>
      <fieldset><legend>Tiêu chí đạt</legend>
        <label className="team-check"><input name="answers" type="checkbox"/>Trả lời đúng việc</label>
        <label className="team-check"><input name="evidence" type="checkbox"/>Có căn cứ hoặc cách kiểm phần còn thiếu</label>
        <label className="team-check"><input name="next" type="checkbox"/>Kết quả hoặc bước tiếp theo phù hợp</label>
      </fieldset>
      <label>Căn cứ đánh giá<textarea name="reason" required minLength={5} maxLength={800}/></label>
      <button className="secondary" disabled={busy}>Lưu rà soát</button>
    </form>}
    {report.canApprove&&report.person?.result.total!=null&&!report.actions.some(item=>item.kind==='approval')&&
      <form className="action-form" onSubmit={event=>submit(event,'approval')}>
        <label>Căn cứ chốt điểm<textarea name="reason" required minLength={5} maxLength={800}/></label>
        <button className="primary" disabled={busy}>Chốt kết quả</button>
      </form>}
    <ul>{report.actions.map((item,i)=><li key={item.created_at+i}>{actionLabels[item.kind]} · {date(item.created_at)} · {item.detail.reason}</li>)}</ul>
  </section>;
}

export function Reports({projects,viewerId}:{projects:Project[];viewerId:string}) {
  const [projectId,setProject]=useState(projects[0]?.id??''),[runId,setRun]=useState(''),[subjectId,setSubject]=useState('');
  const [tab,setTab]=useState<'project'|'person'>('project'),[data,setData]=useState<Report>(),[error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  const query=new URLSearchParams({projectId,...(runId?{runId}:{}),...(subjectId?{subjectId}:{})}).toString();
  useEffect(()=>{
    if(!projectId) return;
    let active=true;
    setData(undefined);setError('');
    api<Report>('/api/team/reports?'+query).then(result=>{if(active)setData(result);},
      error=>{if(active)setError(error.message);});
    return ()=>{active=false;};
  },[projectId,query,revision]);
  function reload() { setRevision(value=>value+1); }
  async function download() {
    try {
      const fresh=await api<Report>('/api/team/reports?'+query);
      const payload=tab==='project'?{run:fresh.run,project:fresh.project}:{run:fresh.run,person:fresh.person,actions:fresh.actions};
      const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download='libetech-'+tab+'-report.json';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(error) {setError((error as Error).message);}
  }
  const summary=data?.project?.summary;
  const person=data?.person?.result;
  const scoreApproved=data?.actions.some(action=>action.kind==='approval');
  return <main className="team-page reports-page">
    <a href="/">← Không gian LibeTech</a><h1>Dashboard LibeTech</h1>
    <div className="team-actions">
      <button className={tab==='project'?'primary':'secondary'} aria-pressed={tab==='project'} onClick={()=>{setSubject('');setTab('project');}}>Dự án</button>
      <button className={tab==='person'?'primary':'secondary'} aria-pressed={tab==='person'} onClick={()=>setTab('person')}>Nhân sự</button>
    </div>
    <div className="report-filters panel">
      <label>Dự án<select value={projectId} onChange={event=>{setData(undefined);setProject(event.target.value);setRun('');setSubject('');}}>
        {projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}
      </select></label>
      <label>Kỳ và bản chốt<select value={runId} onChange={event=>{setData(undefined);setRun(event.target.value);setSubject('');}}>
        <option value="">Bản mới nhất</option>{data?.periods.map(run=><option key={run.id} value={run.id}>{date(run.period_start)} · chốt {date(run.as_of)} · {run.policy_version} · {run.id.slice(0,6)}</option>)}
      </select></label>
      {tab==='person'&&data?.people.some(row=>row.user_id!==viewerId)&&<label>Thành viên<select value={subjectId} onChange={event=>{setData(undefined);setSubject(event.target.value);}}>
        <option value="">Kết quả của tôi</option>{data.people.filter(row=>row.user_id!==viewerId).map(row=><option key={row.user_id} value={row.user_id}>{row.name}</option>)}
      </select></label>}
      {data?.run&&<button className="secondary" onClick={download}>Tải dữ liệu đang xem</button>}
    </div>
    {error&&<p className="notice error" role="alert">{error}</p>}
    {!error&&!data&&<p role="status">{projectId?'Đang đọc dữ liệu…':'Chưa có dự án được cấp quyền.'}</p>}
    {data&&!data.run&&<p className="notice neutral">Dự án chưa có bản đối soát cho dashboard.</p>}
    {data?.run&&<p className="notice neutral">Chốt {date(data.run.as_of)} (giờ Việt Nam) · công thức {data.run.policy_version}
      {data.run.synthetic?' · Dữ liệu giả lập':!data.run.policy_approved?' · Chính sách điểm đang thử':''}</p>}
    {tab==='project'&&data?.project&&summary&&<>
      <h2>Tiến độ và bằng chứng dự án</h2>
      <div className="report-metrics">
        {[['Công việc đối soát',summary.works],['Nguồn báo hoàn thành',summary.sourceCompleted],['Nghiệm thu kỹ thuật',summary.technical],
          ['Nghiệm thu nghiệp vụ',summary.business],['Thiếu hạn',summary.missingDue],['Việc quá hạn',summary.overdue],
          ['Chờ phản hồi quá hạn',summary.openRequests],['Thiếu dữ liệu phản hồi',summary.unknownRequests]].map(([label,value])=>
          <div className="panel report-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      {data.project.works.map(work=><section className="panel team-form" key={work.code}>
        <h3>{work.code} · {work.title}</h3>
        <div className="team-actions"><span className="report-tag">Bảng việc {work.sourceStatus}</span>
          <span className="report-tag">Kỹ thuật {work.technical==='verified'?'Đã xác nhận':'Chờ đủ bằng chứng'}</span>
          <span className="report-tag">Nghiệp vụ {work.business==='verified'?'Đã nghiệm thu':'Chờ xác nhận người dùng'}</span></div>
        <p className="muted">Quan sát nguồn {date(work.sourceObservedAt)} · {work.dueAt?'Hạn '+date(work.dueAt):'Hạn chờ xác nhận'}</p>
        <code className="report-source">{work.sourceSha}</code>
        {work.gaps.length>0&&<><h4>Việc cần đối soát</h4><ul>{work.gaps.map(gap=><li key={gap}>{gap}</li>)}</ul></>}
        <details open><summary>Bằng chứng ({work.facts.length})</summary>{work.facts.map(fact=><Fact key={fact.id} fact={fact}/>)}</details>
        {data.project?.contributions.some(row=>row.workCode===work.code)&&<><h4>Đóng góp đủ điều kiện</h4><ul>
          {data.project.contributions.filter(row=>row.workCode===work.code).map(row=>
            <li key={row.kind+row.evidenceId+row.label}>{row.label} · <a href={'#evidence-'+row.evidenceId}>Xem căn cứ</a></li>)}</ul></>}
      </section>)}
    </>}
    {tab==='person'&&data?.run&&<>
      <h2>Đóng góp và điểm theo kỳ</h2>
      {!person?<p className="notice neutral">Chưa đủ bằng chứng gắn với tài khoản để tính điểm trong kỳ này. Mở tab Dự án để xem hồ sơ nguồn.</p>:<>
        <p><strong>{person.name}</strong> · {scoreApproved?'Đã chốt':stateNames[person.status]} · {person.total===null?'Chưa có điểm tổng':number(person.total)+' / 100'}</p>
        <div className="report-metrics">{person.metrics.map(item=><article className="panel report-stat" key={item.key}>
          <span>{metricNames[item.key]}</span><strong>{item.value===null?'—':number(item.value)}</strong>
          <small>{stateNames[item.status]} · {item.numerator}/{item.denominator} {metricUnits[item.key]}</small>
          <small>Độ phủ {item.coverage===null?'—':number(item.coverage*100)+'%'} · Thiếu {item.missing}</small>
          {item.evidenceIds.map(id=><a key={id} href={'#evidence-'+id}>Bằng chứng {person.evidence.find(fact=>fact.id===id)?.title??id}</a>)}
        </article>)}</div>
        <section className="panel team-form"><h3>Căn cứ tính điểm</h3>{person.evidence.map(fact=><Fact key={fact.id} fact={fact}/>)}</section>
      </>}
      <ReportActions key={data.run.id+':'+(data.person?.user_id??viewerId)} report={data} viewerId={viewerId} reload={reload}/>
    </>}
  </main>;
}
