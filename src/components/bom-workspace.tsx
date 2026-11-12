'use client';

import { useState, type FormEvent } from 'react';
import { api } from './api';
import type { Allocation,BomView } from '@/server/bom';

const stateLabels={pending:'Đang chờ',applied:'Đã áp dụng',rejected:'Từ chối',revise:'Yêu cầu sửa',
  cancelled:'Đã hủy',expired:'Hết hạn',reconcile:'Cần đối soát'};
const choices={agree:'Đồng ý',reject:'Từ chối',revise:'Yêu cầu sửa'};
const localTime=(value:string)=>new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
type Part=Allocation['parts'][number];
const blankPart=():Part=>({owner_id:'',output:'',criteria:'',dueAt:null,dependency:''});

export function BomWorkspace({works,people,viewerId}:{works:{id:string;code:string;title:string}[];
  people:{id:string;name:string}[];viewerId:string}) {
  const [view,setView]=useState<BomView|null>(null);
  const [lead,setLead]=useState('');
  const [parts,setParts]=useState<(Part&{key:string})[]>([]);
  const [priorId,setPrior]=useState<string>();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const name=(id:string|null)=>people.find(person=>person.id===id)?.name??(id?'Thành viên trong hồ sơ':'Chưa phân công');
  function edit(value:Allocation,prior?:string) {
    setLead(value.lead_id??'');
    setParts(value.parts.map(part=>({...part,key:crypto.randomUUID()})));
    setPrior(prior);
  }
  async function load(workId:string) {
    const next=await api<BomView>('/api/team/bom?workId='+encodeURIComponent(workId));
    setView(next);
    return next;
  }
  async function select(workId:string) {
    setView(null);setError('');setBusy(true);
    try { if(workId) edit((await load(workId)).allocation); }
    catch(err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function send(data:unknown) {
    if(!view) return;
    setBusy(true);setError('');
    try { await api('/api/team/bom',data);edit((await load(view.work.id)).allocation); }
    catch(err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  function propose(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!view) return;
    const reason=String(new FormData(event.currentTarget).get('reason')??'');
    void send({action:'propose',workId:view.work.id,expectedVersion:view.work.version,priorId,
      allocation:{lead_id:lead,parts:parts.map(({key:_,...part})=>part)},reason});
  }
  function show(value:Allocation) {
    return <><strong>Chủ trì · {name(value.lead_id)}</strong>{value.parts.length>0&&<ul>
      {value.parts.map((part,index)=><li key={index}><b>{part.output}</b> · {name(part.owner_id)}
        <div>Tiêu chí · {part.criteria}</div>{part.dueAt&&<div>Hạn · {localTime(part.dueAt)}</div>}
        {part.dependency&&<div>Phụ thuộc · {part.dependency}</div>}</li>)}
    </ul>}</>;
  }
  const recipientOptions=(include:string)=><>
    <option value="">Chọn người có quyền thực hiện…</option>
    {[...new Set([...(view?.recipients??[]),...(include?[include]:[])])].map(id=><option value={id} key={id}>{name(id)}</option>)}
  </>;

  return <main className="team-page"><a href="/">← Không gian làm việc</a><h1>Phân công BoM Tech</h1>
    <p>Ba thành viên xác nhận trên cùng một phiếu. Phân công mới có hiệu lực trong AI OS khi đủ 3/3.</p>
    {works.length>0?<label>Đầu việc<select disabled={busy} onChange={event=>void select(event.target.value)}>
      <option value="">Chọn việc…</option>
      {works.map(work=><option value={work.id} key={work.id}>{work.code} · {work.title}</option>)}
    </select></label>:<p>Chưa có đầu việc BoM trong phạm vi của tài khoản này.</p>}
    {error&&<p className="notice error" role="alert">{error}</p>}
    {busy&&<p role="status">Đang xử lý…</p>}
    {view&&<div className="report-grid">
      <section className="panel" style={{padding:20}}>
        <h2>Phân công đang hiệu lực</h2>{show(view.allocation)}
        <p>{view.work.code} · Phiên bản việc {view.work.version} · Hồ sơ r{view.work.revision}</p>
        {view.work.source_sha&&<p><code>{view.work.source_sha}</code></p>}
        <p>Nghiệm thu kỹ thuật · {name(view.work.technical_id)}<br/>Nghiệm thu nghiệp vụ · {name(view.work.business_id)}</p>
        {view.source?<p>Nguồn · {view.source.source_ref}<br/>Đối soát · {localTime(view.source.checked_at)}</p>
          :<p>Chờ đối soát lại nguồn.</p>}
        {!view.enabled&&<p>Chờ mở phạm vi và đủ ba ghế BoM đã xác minh.</p>}
      </section>
      {view.enabled&&view.source&&view.allocation.lead_id&&view.work.state!=='done'&&
        <form className="panel action-form" style={{padding:20}} onSubmit={propose} key={view.work.id+'-'+priorId+'-'+view.cards[0]?.proposal.id}>
          <h2>{priorId?'Trình phiên bản mới':'Đề xuất chia lại việc'}</h2>
          <label>Chủ trì<select required value={lead} onChange={event=>setLead(event.target.value)}>{recipientOptions(lead)}</select></label>
          {parts.map((part,index)=><fieldset key={part.key}><legend>Phần việc {index+1}</legend>
            <label>Người chịu trách nhiệm<select required value={part.owner_id} onChange={event=>setParts(list=>
              list.map(item=>item.key===part.key?{...item,owner_id:event.target.value}:item))}>{recipientOptions(part.owner_id)}</select></label>
            {(['output','criteria','dependency'] as const).map(field=><label key={field}>{({output:'Đầu ra',criteria:'Tiêu chí',dependency:'Phụ thuộc'})[field]}
              <input required={field!=='dependency'} value={part[field]} maxLength={field==='criteria'?1000:field==='output'?240:500}
                onChange={event=>setParts(list=>list.map(item=>item.key===part.key?{...item,[field]:event.target.value}:item))}/>
            </label>)}
            <label>Hạn (16:00 VN)<input type="date" value={part.dueAt?part.dueAt.slice(0,10):''} onChange={event=>
              setParts(list=>list.map(item=>item.key===part.key?{...item,dueAt:event.target.value
                ?new Date(event.target.value+'T16:00:00+07:00').toISOString():null}:item))}/></label>
            <button type="button" onClick={()=>setParts(list=>list.filter(item=>item.key!==part.key))}>Bỏ phần việc</button>
          </fieldset>)}
          <button type="button" disabled={parts.length>=20||busy} onClick={()=>setParts(list=>[...list,{...blankPart(),key:crypto.randomUUID()}])}>Thêm phần việc</button>
          <label>Lý do<textarea name="reason" minLength={5} maxLength={2000} required/></label>
          <button className="primary" disabled={busy}>Gửi phiếu 0/3</button>
        </form>}
      {view.cards.map(({proposal,votes,receipt})=>{
        const state=proposal.state==='pending'&&Date.parse(proposal.expires_at)<=Date.now()?'expired':proposal.state;
        return <section className="panel" style={{padding:20}} key={proposal.id}>
          <h2>{stateLabels[state]} · {votes.filter(vote=>vote.choice==='agree').length}/3</h2>
          <p>{name(proposal.proposer_id)} · {localTime(proposal.created_at)} · Dựa trên phiên bản việc {proposal.work_version}</p>
          <p>{proposal.reason}</p>
          <h3>Trước</h3>{show(proposal.before_assignment)}
          <h3>Đề xuất</h3>{show(proposal.proposed_assignment)}
          <ul>{proposal.seat_ids.map(id=>{
            const vote=votes.find(item=>item.voter_id===id);
            return <li key={id}>{name(id)} · {vote?choices[vote.choice]+' · '+localTime(vote.created_at):'Chưa xác nhận'}</li>;
          })}</ul>
          {receipt&&<p>Biên nhận {receipt.proposal_id} · {localTime(receipt.created_at)} · Phiên bản việc {receipt.work_version}</p>}
          {state==='pending'&&view.enabled&&!votes.some(vote=>vote.voter_id===viewerId)&&
            <form className="action-form" onSubmit={event=>{
              event.preventDefault();const form=new FormData(event.currentTarget);
              void send({action:'vote',proposalId:proposal.id,choice:form.get('choice'),note:form.get('note')});
            }}><label>Lựa chọn<select name="choice" required><option value="">Chọn…</option>
              {Object.entries(choices).map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select></label><label>Ghi chú<textarea name="note" minLength={5} maxLength={2000} required/></label>
              <button className="primary" disabled={busy}>Ghi xác nhận</button></form>}
          {state==='pending'&&proposal.proposer_id===viewerId&&
            <form className="action-form" onSubmit={event=>{
              event.preventDefault();void send({action:'cancel',proposalId:proposal.id,note:new FormData(event.currentTarget).get('note')});
            }}><label>Lý do hủy<input name="note" minLength={5} maxLength={2000} required/></label>
              <button disabled={busy}>Hủy phiếu</button></form>}
          {view.enabled&&state!=='pending'&&state!=='applied'&&!view.cards.some(card=>card.proposal.prior_id===proposal.id)&&
            <button disabled={busy} onClick={()=>edit(proposal.proposed_assignment,proposal.id)}>Soạn phiên bản mới</button>}
        </section>;
      })}
    </div>}
  </main>;
}
