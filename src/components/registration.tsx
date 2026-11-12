'use client';
import { useState,type FormEvent } from 'react';
import { api } from './api';
export function Registration() {
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();setBusy(true);setError('');
  const form=new FormData(event.currentTarget);
  try {
   await api('/api/auth/register',{username:form.get('username'),name:form.get('name'),
    projectInterest:form.get('projectInterest'),note:form.get('note')??''});
   setDone(true);
  } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
 }
 return <main className="team-page"><a href="/login">← Đăng nhập</a><section className="panel team-form" style={{maxWidth:580,margin:'28px auto'}}>
  <h1>Đăng ký Team Tech</h1><p>Gửi thông tin để quản trị đối chiếu danh tính và cấp đúng dự án. Sau khi nhận lời mời riêng, anh/chị tạo mật khẩu rồi ghép Telegram trong tài khoản.</p>
  {done?<div role="status" className="notice success">Đã nhận yêu cầu. Quản trị sẽ đối chiếu và gửi lời mời riêng nếu phù hợp. Nếu đã có tài khoản, hãy đăng nhập.</div>:
   <form className="action-form" onSubmit={submit}>
    <label>Họ tên<input name="name" required minLength={2} maxLength={100}/></label>
    <label>Tên đăng nhập mong muốn<input name="username" autoComplete="username" required minLength={3} maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,63}"/></label>
    <label>Dự án hoặc mảng đang tham gia<input name="projectInterest" required minLength={2} maxLength={200} placeholder="Ví dụ: Xeca, IBS HI, Liberico"/></label>
    <label>Thông tin để quản trị đối chiếu (không điền mật khẩu)<textarea name="note" maxLength={500} rows={3}/></label>
    {error&&<div role="alert" className="notice error">{error}</div>}
    <button className="primary" disabled={busy}>{busy?'Đang gửi…':'Gửi yêu cầu đăng ký'}</button>
   </form>}
 </section></main>;
}
