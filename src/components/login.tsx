'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Layers3,ShieldCheck,ArrowRight} from 'lucide-react';
import {api} from './api';
export function Login({activate=false}:{activate?:boolean}) {
 const router=useRouter(); const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(activate){setToken(location.hash.slice(1));history.replaceState(null,'','/activate');}},[activate]);
 async function submit(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault();setError('');const f=new FormData(event.currentTarget),password=String(f.get('password')??'');
  if(activate&&password!==f.get('confirm')){setError('Hai mật khẩu chưa trùng nhau.');return;}
  setBusy(true);
  try {await api('/api/auth/'+(activate?'activate':'login'),activate?{token,password}:{username:String(f.get('username')??''),password});router.replace('/');router.refresh();}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <div className="welcome"><section className="welcome-story"><div className="brand"><span className="brand-icon"><Layers3/></span><span>LibeTech <strong>AI OS</strong></span></div><div className="welcome-copy"><div className="eyebrow light">KHÔNG GIAN LÀM VIỆC CỦA LIBETECH</div><h1>Công việc rõ ràng.<br/>Bằng chứng đầy đủ.<br/><em>Trách nhiệm xuyên suốt.</em></h1><p>Đăng nhập để xem dự án được giao, theo dõi công việc và đối soát bằng chứng. Sau đó ghép Telegram để dùng cùng danh tính với bot.</p></div><div className="welcome-bottom">LibeTech · AI OS</div></section><section className="welcome-entry"><div className="demo-pill">TÀI KHOẢN TỔ CHỨC</div><h2>{activate?'Tạo mật khẩu của anh/chị':'Chào mừng trở lại'}</h2><p className="muted">{activate?'Lời mời đã gắn với vai trò và dự án được giao. Mật khẩu chỉ do anh/chị lựa chọn.':'Dùng tên đăng nhập và mật khẩu đã được cấp quyền.'}</p><form className="action-form" onSubmit={submit}>{!activate&&<label>Tên đăng nhập<input name="username" autoComplete="username" required maxLength={64} autoFocus/></label>}<label>Mật khẩu<input name="password" type="password" autoComplete={activate?'new-password':'current-password'} required minLength={activate?12:1} maxLength={128}/></label>{activate&&<><label>Nhập lại mật khẩu<input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label><p className="form-hint">Dùng ít nhất 12 ký tự. Có thể chọn một cụm từ dễ nhớ.</p></>}{error&&<div className="notice error" role="alert">{error}</div>}<button className="primary full" disabled={busy||(activate&&!token)}>{busy?'Đang kiểm tra…':activate?'Kích hoạt tài khoản':'Đăng nhập'}<ArrowRight size={17}/></button></form>{!activate&&<p><a href="/register">Thành viên Tech mới? Gửi yêu cầu đăng ký</a></p>}<div className="entry-note"><ShieldCheck size={18}/><span>Chỉ thấy các dự án được giao. Nếu quên mật khẩu hoặc cần quyền mới, liên hệ người quản trị LibeTech.</span></div></section></div>;
}
