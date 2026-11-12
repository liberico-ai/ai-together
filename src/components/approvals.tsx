'use client';
import {useState} from 'react';
import {api} from './api';

type Grant={name:string;role:string;reportPermissions:string[]};
type Pending={id:string;name:string;username:string;project_interest:string;reason:string;
  grant_details:Grant[];expires_at:string};
const roles:Record<string,string>={viewer:'Chỉ đọc',engineer:'Thực hiện',manager:'Điều phối',
 technical:'Nghiệm thu kỹ thuật',business:'Nghiệm thu nghiệp vụ'};

export function Approvals({initial}:{initial:Pending[]}) {
 const [pending,setPending]=useState(initial),[busy,setBusy]=useState<string|null>(null);
 const [notice,setNotice]=useState(''),[error,setError]=useState('');
 async function vote(id:string,choice:'agree'|'reject') {
  setBusy(id);setNotice('');setError('');
  try {
   const result=await api<{state:string}>('/api/team/approvals',{approvalId:id,choice});
   setPending(await api<Pending[]>('/api/team/approvals'));
   setNotice(result.state==='approved'?'Đủ anh và một thành viên BoM. Quản trị có thể tạo lời mời.':
    result.state==='rejected'?'Phiếu đã từ chối.':'Đã ghi nhận lựa chọn; chờ người duyệt còn lại.');
  } catch(e){setError((e as Error).message);} finally{setBusy(null);}
 }
 return <main className="team-page"><a href="/">← Không gian LibeTech</a>
  <h1>Duyệt thành viên Team Tech</h1>
  <p>Mỗi phiếu cần anh và một trong ba thành viên BoM xác nhận. Chỉ chọn Yes hoặc No sau khi kiểm đúng người và quyền dự án.</p>
  {notice&&<div role="status" className="notice success">{notice}</div>}
  {error&&<div role="alert" className="notice error">{error}</div>}
  <section className="panel team-form"><h2>Phiếu cần tôi duyệt · {pending.length}</h2>
   {pending.length?pending.map(item=><div className="action-form" key={item.id}>
    <p><strong>{item.name}</strong> · {item.username}<br/><small>Người đăng ký đề nghị: {item.project_interest}</small></p>
    <p>Phạm vi trình duyệt: {item.grant_details.length?item.grant_details.map(g=>
      `${g.name} (${roles[g.role]??g.role}${g.reportPermissions.length?', quyền báo cáo: '+g.reportPermissions.join(', '):''})`).join('; '):'chưa có'}</p>
    <p className="muted">Căn cứ: {item.reason}</p>
    <div className="team-actions"><button className="primary" disabled={busy!==null} onClick={()=>vote(item.id,'agree')}>Yes · Duyệt</button>
      <button className="secondary" disabled={busy!==null} onClick={()=>vote(item.id,'reject')}>No · Từ chối</button></div>
   </div>):<p className="muted">Không có phiếu nào chờ xác nhận của bạn.</p>}
  </section></main>;
}
