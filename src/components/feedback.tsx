'use client';
import { useState,type FormEvent } from 'react';
import type { Project } from '@/server/types';
import { api } from './api';

type Report={id:string;project_id:string;kind:string;title:string;description:string;page_path:string;state:string;version:number;created_at:string};
export function Feedback({projects,initial,managerProjects}:{projects:Project[];initial:Report[];managerProjects:string[]}) {
 const [rows,setRows]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();setBusy(true);setError('');setNotice('');
  const element=event.currentTarget,form=new FormData(element);
  try {
   await api('/api/team/feedback',{projectId:form.get('projectId'),requestKey:crypto.randomUUID(),
    kind:form.get('kind'),title:form.get('title'),description:form.get('description'),
    pagePath:form.get('pagePath'),expected:form.get('expected')??'',actual:form.get('actual')??''});
   setRows(await api<Report[]>('/api/team/feedback'));
   element.reset();setNotice('Đã ghi nhận. Nhóm phụ trách có thể xem và đối chiếu.');
  } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
 }
 async function resolve(event:FormEvent<HTMLFormElement>,report:Report) {
  event.preventDefault();const form=new FormData(event.currentTarget);
  const button=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
  const state=button?.value;
  if(state!=='reviewing'&&state!=='closed') return;
  setBusy(true);setError('');setNotice('');
  try {
   await api('/api/team/feedback',{projectId:report.project_id,reportId:report.id,
    requestKey:crypto.randomUUID(),expectedVersion:report.version,state,reason:form.get('reason')},'PATCH');
   setRows(await api<Report[]>('/api/team/feedback'));
   setNotice('Đã lưu trạng thái và căn cứ xử lý.');
  } catch(e){setError((e as Error).message);} finally{setBusy(false);}
 }
 return <main className="team-page"><a href="/">← Không gian LibeTech</a><h1>Báo lỗi và góp ý</h1>
  <p>Mô tả điều xảy ra và kết quả anh/chị mong đợi. Báo cáo được gắn với dự án; người quản lý dự án thấy để xử lý. Nội dung báo lỗi không tự thay trạng thái công việc hoặc điểm nhân sự.</p>
  <div className="team-grid"><form className="panel action-form team-form" onSubmit={submit}>
    <h2>Gửi phản hồi</h2><label>Dự án<select name="projectId" required>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Loại<select name="kind"><option value="bug">Lỗi</option><option value="idea">Đề xuất cải tiến</option></select></label>
    <label>Tiêu đề<input name="title" required minLength={5} maxLength={140}/></label>
    <label>Mô tả và cách lặp lại<textarea name="description" required minLength={20} maxLength={4000} rows={5}/></label>
    <label>Đường dẫn trang<input name="pagePath" required defaultValue="/" maxLength={300}/></label>
    <label>Mong đợi<textarea name="expected" maxLength={2000} rows={2}/></label>
    <label>Thực tế<textarea name="actual" maxLength={2000} rows={2}/></label>
    {error&&<div role="alert" className="notice error">{error}</div>}{notice&&<div role="status" className="notice success">{notice}</div>}
    <button className="primary" disabled={busy}>{busy?'Đang gửi…':'Gửi phản hồi'}</button>
  </form><section className="panel team-form"><h2>Phản hồi trong phạm vi của anh/chị</h2>
    {rows.length?rows.map(r=><article key={r.id} className="evidence-fact"><strong>{r.title}</strong><p className="muted">{projects.find(p=>p.id===r.project_id)?.name??'Dự án được cấp'} · {r.kind==='bug'?'Lỗi':'Góp ý'} · {r.state}</p><p>{r.description}</p><small>{new Date(r.created_at).toLocaleString('vi-VN')}</small>
      {managerProjects.includes(r.project_id)&&r.state!=='closed'&&<form className="action-form" onSubmit={e=>resolve(e,r)}>
        <label>Căn cứ xử lý<input name="reason" required minLength={5} maxLength={1000}/></label>
        <div className="team-actions">{r.state==='new'&&<button className="secondary" type="submit" value="reviewing" disabled={busy}>Đã nhận, đang xử lý</button>}
          <button className="secondary" type="submit" value="closed" disabled={busy}>Đã xử lý</button></div>
      </form>}
    </article>):<p className="muted">Chưa có phản hồi.</p>}
  </section></div></main>;
}
