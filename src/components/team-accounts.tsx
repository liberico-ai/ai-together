'use client';
import { useState,type FormEvent } from 'react';
import { api } from './api';
import type { Project,ProjectGrant,ReportPermission } from '@/server/types';

type Account={id:string;username:string;name:string;active:boolean;activated:boolean;version:number;grants:ProjectGrant[];githubId:string|null};
type Result={invitation?:{token:string;expiresInHours:number};pendingTelegramApproval?:boolean;approvalId?:string};
type RegistrationRequest={id:string;username:string;name:string;project_interest:string;note:string;created_at:string;
  approval_id:string|null;approval_state:string|null;approval_agreed:number;chairman_agreed:boolean;bom_agreed:number;approval_grants:ProjectGrant[]|null};
const roles={viewer:'Chỉ đọc',engineer:'Thực hiện',manager:'Điều phối',technical:'Nghiệm thu kỹ thuật',business:'Nghiệm thu nghiệp vụ'};
const permissions:Record<ReportPermission,string>={people_read:'Xem điểm nhân sự',quality_review:'Đánh giá phản hồi',report_approve:'Chốt kết quả'};

function Grants({projects,initial=[]}:{projects:Project[];initial?:ProjectGrant[]}) {
  return <fieldset><legend>Phạm vi dự án</legend>{projects.map(project=>{
    const previous=initial.find(grant=>grant.projectId===project.id);
    return <div className="team-grant" key={project.id}>
      <label>{project.name}<select name={project.id} defaultValue={previous?.role??''}>
        <option value="">Chưa cấp</option>
        {Object.entries(roles).map(([role,label])=><option key={role} value={role}>{label}</option>)}
      </select></label>
      {Object.entries(permissions).map(([key,label])=><label key={key} className="team-check">
        <input type="checkbox" name={project.id+'-report'} value={key} defaultChecked={previous?.reportPermissions.includes(key as ReportPermission)}/>{label}
      </label>)}
    </div>;
  })}</fieldset>;
}

/** Mirrors the server rule (AccountService reducesAccess): anything that is not a pure reduction needs a ballot. */
export function expandsAccess(before:ProjectGrant[],after:ProjectGrant[]):boolean {
  return !after.every(next=>{
    const prior=before.find(grant=>grant.projectId===next.projectId);
    return prior&&(next.role===prior.role||next.role==='viewer')&&next.reportPermissions.every(permission=>prior.reportPermissions.includes(permission));
  });
}

/** Widening goes through a ballot; the server still refuses a widening save without an approved ballot. Reducing keeps the direct save. */
export function AccessActions({expands,busy}:{expands:boolean;busy:boolean}) {
  return expands?<>
    <button type="submit" className="primary" disabled={busy} value="propose_access_change">Trình phiếu đổi quyền</button>
    <button type="submit" className="secondary" disabled={busy} value="access">Áp quyền đã được duyệt</button>
  </>:<button type="submit" className="primary" disabled={busy} value="access">Lưu quyền</button>;
}

function readGrants(form:FormData,projects:Project[]):ProjectGrant[] {
  return projects.flatMap(({id})=>{
    const role=form.get(id) as ProjectGrant['role']|'';
    return role?[{projectId:id,role,reportPermissions:form.getAll(id+'-report') as ReportPermission[]}]:[];
  });
}

export function TeamAccounts({initial,requests:initialRequests,projects}:{initial:Account[];requests:RegistrationRequest[];projects:Project[]}) {
  const [accounts,setAccounts]=useState(initial),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false);
  const [requests,setRequests]=useState(initialRequests);
  const [invitation,setInvitation]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const user=accounts.find(account=>account.id===selected);
  const [expands,setExpands]=useState(false);
  async function review(event:FormEvent<HTMLFormElement>,requestId:string) {
    event.preventDefault();const form=new FormData(event.currentTarget);
    const button=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    const kind=button?.value;
    if(kind!=='approve_registration'&&kind!=='reject_registration'&&kind!=='issue_approved_registration') return;
    setBusy(true);setError('');setNotice('');setInvitation('');
    try {
      const result=await api<Result>('/api/team/registrations',{kind,requestId,reason:form.get('reason'),
        ...(kind==='approve_registration'?{grants:readGrants(form,projects)}:{})});
      if(result.invitation) setInvitation(location.origin+'/activate#'+result.invitation.token);
      setRequests(await api<RegistrationRequest[]>('/api/team/registrations'));
      setAccounts(await api<Account[]>('/api/team/accounts'));setExpands(false);
      setNotice(kind==='approve_registration'?'Đã tạo phiếu. Anh và ít nhất một thành viên BoM chọn Yes trên nền.':
        kind==='issue_approved_registration'?'Đã có xác nhận của anh và BoM. Gửi riêng liên kết mời cho đúng người.':'Đã từ chối yêu cầu.');
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  async function submit(event:FormEvent<HTMLFormElement>,isNew:boolean) {
    event.preventDefault();
    const form=new FormData(event.currentTarget),element=event.currentTarget;
    const button=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    const kind=isNew?'invite':button?.value;
    if(!kind||(!isNew&&!user)) return;
    const reason=form.get('reason'),grants=readGrants(form,projects);
    const command=isNew?{kind,username:form.get('username'),name:form.get('name'),reason,grants}:
      {kind,userId:user?.id,expectedVersion:user?.version,reason,
        ...(kind==='access'||kind==='propose_access_change'?{grants}:{}),
        ...(kind==='verify_github'?{githubId:form.get('githubId'),sourceId:form.get('sourceId')}:{}),
      };
    setBusy(true);setError('');setNotice('');setInvitation('');
    try {
      const result=await api<Result>('/api/team/accounts',command);
      if(result.invitation) setInvitation(location.origin+'/activate#'+result.invitation.token);
      setAccounts(await api<Account[]>('/api/team/accounts'));
      setNotice(kind==='propose_access_change'?'Đã trình phiếu đổi quyền. Anh và ít nhất một thành viên BoM chọn Yes trên nền; quyền chưa đổi cho tới khi áp quyền đã được duyệt.':'Đã lưu thay đổi tài khoản.');
      if(isNew) element.reset();
    } catch(error) { setError((error as Error).message); }
    finally {setBusy(false);}
  }
  return <main className="team-page">
    <a href="/">← Không gian LibeTech</a><h1>Quản trị tài khoản Team Tech</h1>
    {notice&&<div role="status" className="notice success">{notice}</div>}
    {error&&<div role="alert" className="notice error">{error}</div>}
    {invitation&&<div className="notice warning"><label>Liên kết mời dùng một lần<input readOnly value={invitation} onFocus={e=>e.target.select()}/></label>
      <p>Gửi riêng cho đúng người. Lời mời hết hạn sau 24 giờ.</p><button className="secondary" onClick={()=>setInvitation('')}>Ẩn lời mời</button></div>}
    <div className="team-grid">
      <section className="panel team-form"><h2>Yêu cầu đăng ký đang chờ · {requests.length}</h2>
        {requests.length?requests.map(request=><form key={request.id} className="action-form" onSubmit={e=>review(e,request.id)}>
          <p><strong>{request.name}</strong> · {request.username}<br/><small>Đề nghị: {request.project_interest}</small></p>
          {request.note&&<p className="muted">{request.note}</p>}
          {request.approval_id&&<p className="muted">Phiếu xác nhận: {request.approval_state} · Anh: {request.chairman_agreed?'đã duyệt':'chưa duyệt'} · BoM: {request.bom_agreed}/1 tối thiểu
            <br/><code>{request.approval_id}</code></p>}
          {request.approval_grants&&<p className="muted">Phạm vi đã trình: {request.approval_grants.map(grant=>
            `${projects.find(project=>project.id===grant.projectId)?.name??grant.projectId} (${roles[grant.role]})`).join(', ')}</p>}
          {(!request.approval_id||['expired','rejected'].includes(request.approval_state??''))&&<Grants projects={projects}/>}
          <label>Căn cứ xác nhận hoặc từ chối<input name="reason" required minLength={5} maxLength={500}/></label>
          <div className="team-actions">{(!request.approval_id||['expired','rejected'].includes(request.approval_state??''))&&
            <button className="primary" type="submit" value="approve_registration" disabled={busy}>Trình duyệt</button>}
            {request.approval_state==='approved'&&<button className="primary" type="submit"
              value="issue_approved_registration" disabled={busy}>Đủ anh + 1 BoM · Tạo lời mời</button>}
            <button className="secondary" type="submit" value="reject_registration" disabled={busy}>Từ chối</button></div>
        </form>):<p className="muted">Chưa có yêu cầu mới.</p>}
      </section>
      <section className="panel team-form"><h2>Thành viên mới</h2><p>Thành viên gửi yêu cầu tại
        <a href="/register"> /register</a>. Quản trị trình phạm vi; lời mời chỉ được tạo sau xác nhận của anh và ít nhất một thành viên BoM.</p>
        <p><a href="/approvals">Mở phiếu để chọn Yes hoặc No trên nền</a>.</p></section>
      <section className="panel team-form">
        <h2>Tài khoản đã tạo</h2>
        <label>Thành viên<select value={selected} onChange={event=>{setSelected(event.target.value);setExpands(false);}}>
          <option value="">Chọn tài khoản</option>{accounts.map(account=><option key={account.id} value={account.id}>{account.name} · {account.username}</option>)}
        </select></label>
        {user?<form key={user.id+':'+user.version} className="action-form" onSubmit={event=>submit(event,false)}
          onChange={event=>setExpands(expandsAccess(user.grants,readGrants(new FormData(event.currentTarget),projects)))}>
          <p>{!user.active?'Đã khóa':user.activated?'Đang hoạt động':'Chờ kích hoạt'}</p>
          <Grants projects={projects} initial={user.grants}/>
          {user.active&&user.activated&&<details><summary>Xác minh tài khoản GitHub</summary>
            <label>ID GitHub bất biến<input name="githubId" inputMode="numeric" defaultValue={user.githubId??''}/></label>
            <label>Đường dẫn căn cứ đã kiểm<input name="sourceId" type="url"/></label>
            <button type="submit" className="secondary" disabled={busy} value="verify_github">Xác nhận danh tính</button>
            {user.githubId&&<button type="submit" className="secondary" disabled={busy} value="unlink_github">Gỡ GitHub</button>}
          </details>}
          <label>Lý do thay đổi<input name="reason" required minLength={5} maxLength={500}/></label>
          <div className="team-actions">
            <AccessActions expands={expands} busy={busy}/>
            {user.active&&!user.activated&&<><button className="secondary" disabled={busy} value="reissue">Cấp lại lời mời</button>
              <button className="secondary" disabled={busy} value="cancel">Hủy lời mời</button></>}
            {user.active&&user.activated&&<button className="secondary" disabled={busy} value="revoke_sessions">Thu hồi phiên</button>}
            <button className="secondary" disabled={busy} value={user.active?'disable':'enable'}>{user.active?'Khóa tài khoản':'Mở khóa'}</button>
          </div>
        </form>:<p className="muted">Chọn một thành viên để xem quyền và quản lý phiên.</p>}
      </section>
    </div>
  </main>;
}
