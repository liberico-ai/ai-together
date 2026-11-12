'use client';
import {useEffect,useState} from 'react';
import {api} from './api';
export function TelegramLink() {
 const [status,setStatus]=useState<{linked:boolean;telegramId?:string}>(),[code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function refresh(){try{const result=await api<{telegram:{linked:boolean;telegramId?:string}}>('/api/auth/me');setStatus(result.telegram);if(result.telegram.linked)setCode('');}catch(e){setError((e as Error).message);}}
 useEffect(()=>{void refresh();},[]);
 async function unlink(){
  setBusy(true);setError('');
  try {await api('/api/auth/telegram-unlink',{});setStatus({linked:false});setCode('');}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function generate(){setBusy(true);setError('');try{setCode((await api<{code:string}>('/api/auth/telegram-code',{})).code);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="panel" style={{padding:24,marginBottom:24}}><div className="eyebrow">DANH TÍNH CỦA BẠN</div><h2>Ghép tài khoản Telegram</h2>{status?.linked?<><p>Đã xác minh Telegram ID <code>{status.telegramId}</code>.</p><details><summary>Quản lý liên kết</summary><p>Sau khi gỡ, anh/chị có thể tạo mã ghép mới.</p><button className="secondary" disabled={busy} onClick={unlink}>Gỡ Telegram</button></details></>:<><p className="muted">Tạo mã, rồi gửi riêng cho @LiBeAiTogetherBot. Việc ghép không mở thêm quyền dự án.</p><button className="secondary" onClick={generate} disabled={busy}>{busy?'Đang tạo…':'Tạo mã ghép 5 phút'}</button>{code&&<div className="notice neutral"><p>Gửi tin nhắn riêng:</p><code style={{overflowWrap:'anywhere'}}>/libetech_link {code}</code><p>Không gửi mã vào nhóm hoặc chia sẻ cho người khác.</p><button className="secondary" onClick={refresh}>Kiểm tra đã ghép</button></div>}</>}{error&&<p role="alert">{error}</p>}</section>;
}
