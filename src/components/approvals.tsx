'use client';
import {useState} from 'react';
import {api} from './api';

type Grant={name:string;role:string;reportPermissions:string[]};
export type Pending={id:string;kind?:'registration'|'access_change';name:string;username:string;project_interest:string|null;reason:string;
  grant_details:Grant[];previous_grant_details?:Grant[]|null;expires_at:string};
const roles:Record<string,string>={viewer:'Chỉ đọc',engineer:'Thực hiện',manager:'Điều phối',
 technical:'Nghiệm thu kỹ thuật',business:'Nghiệm thu nghiệp vụ'};

const grantText=(grants:Grant[]|null|undefined,empty:string)=>grants?.length?grants.map(g=>
  `${g.name} (${roles[g.role]??g.role}${g.reportPermissions?.length?', quyền báo cáo: '+g.reportPermissions.join(', '):''})`).join('; '):empty;

/** A ballot shows what it is. An access change names the account and puts the frozen current grants next to the proposed ones, so a voter never approves a widening they cannot see. */
export function ApprovalItem({item,busy,onVote}:{item:Pending;busy:boolean;onVote:(id:string,choice:'agree'|'reject')=>void|Promise<void>}) {
 const change=item.kind==='access_change';
 return <div className="action-form" data-kind={change?'access_change':'registration'}>
  <p><strong>{change?'Phiếu đổi quyền':'Phiếu đăng ký thành viên'}</strong><br/><strong>{item.name}</strong> · {item.username}
   {!change&&<><br/><small>Người đăng ký đề nghị: {item.project_interest}</small></>}</p>
  {change?<p>Quyền hiện tại: {grantText(item.previous_grant_details,'chưa có quyền nào')}<br/>
    <span aria-hidden="true">→</span> Quyền đề nghị: {grantText(item.grant_details,'chưa có')}</p>
   :<p>Phạm vi trình duyệt: {grantText(item.grant_details,'chưa có')}</p>}
  <p className="muted">Căn cứ: {item.reason}</p>
  <div className="team-actions"><button className="primary" disabled={busy} onClick={()=>onVote(item.id,'agree')}>Yes · Duyệt</button>
   <button className="secondary" disabled={busy} onClick={()=>onVote(item.id,'reject')}>No · Từ chối</button></div>
 </div>;
}

export function Approvals({initial}:{initial:Pending[]}) {
 const [pending,setPending]=useState(initial),[busy,setBusy]=useState<string|null>(null);
 const [notice,setNotice]=useState(''),[error,setError]=useState('');
 async function vote(id:string,choice:'agree'|'reject') {
  setBusy(id);setNotice('');setError('');
  try {
   const result=await api<{state:string}>('/api/team/approvals',{approvalId:id,choice});
   setPending(await api<Pending[]>('/api/team/approvals'));
   const change=pending.find(p=>p.id===id)?.kind==='access_change';
   setNotice(result.state==='approved'?(change?'Đủ anh và một thành viên BoM. Quản trị có thể áp quyền đã được duyệt.':'Đủ anh và một thành viên BoM. Quản trị có thể tạo lời mời.'):
    result.state==='rejected'?'Phiếu đã từ chối.':'Đã ghi nhận lựa chọn; chờ người duyệt còn lại.');
  } catch(e){
   setError((e as Error).message);
   // A ballot that closed while the page was open must not stay on screen as if it could still be voted.
   if((e as Error).message.includes('[APPROVAL_CLOSED]')) try {setPending(await api<Pending[]>('/api/team/approvals'));} catch(reload){setError((reload as Error).message);}
  } finally{setBusy(null);}
 }
 return <main className="team-page"><a href="/">← Không gian LibeTech</a>
  <h1>Duyệt thành viên và đổi quyền Team Tech</h1>
  <p>Mỗi phiếu cần anh và một trong ba thành viên BoM xác nhận. Chỉ chọn Yes hoặc No sau khi kiểm đúng người và quyền dự án; phiếu đổi quyền hiện cả quyền hiện tại và quyền đề nghị.</p>
  {notice&&<div role="status" className="notice success">{notice}</div>}
  {error&&<div role="alert" className="notice error">{error}</div>}
  <section className="panel team-form"><h2>Phiếu cần tôi duyệt · {pending.length}</h2>
   {pending.length?pending.map(item=><ApprovalItem key={item.id} item={item} busy={busy!==null} onVote={vote}/>):<p className="muted">Không có phiếu nào chờ xác nhận của bạn.</p>}
  </section></main>;
}
