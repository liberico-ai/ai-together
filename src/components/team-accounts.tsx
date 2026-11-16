'use client';
import { useState,type FormEvent } from 'react';
import { api,ApiError } from './api';
import type { GrantPermission,Project,ProjectGrant,ReportPermission } from '@/server/types';
import type { OpenAccessChange } from '@/server/accounts';
import { DOC_APPROVAL_TYPES,docApprovalCode,widensAccess } from '../server/access-grants';
import { PERMISSION_LABELS,ROLE_LABELS } from './grant-labels';
import { TYPE_NAMES } from './documents-view';
import { grantText } from './approvals';

type Account={id:string;username:string;name:string;active:boolean;activated:boolean;version:number;grants:ProjectGrant[];githubId:string|null;
  accessChange?:OpenAccessChange|null};
type Result={invitation?:{token:string;expiresInHours:number};pendingTelegramApproval?:boolean;approvalId?:string};
type RegistrationRequest={id:string;username:string;name:string;project_interest:string;note:string;created_at:string;
  approval_id:string|null;approval_state:string|null;approval_agreed:number;chairman_agreed:boolean;bom_agreed:number;approval_grants:ProjectGrant[]|null};
const roles=ROLE_LABELS,permissions=PERMISSION_LABELS;

/** `withDocApproval` draws the eight per-type approval boxes, ticked from the account's current grants. Only the form of an account that already exists
 * turns it on: a registration cannot carry the right, and nobody ticks it for themselves here. */
export function Grants({projects,initial=[],withDocApproval=false}:{projects:Project[];initial?:ProjectGrant[];withDocApproval?:boolean}) {
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
      {withDocApproval&&<fieldset className="team-doc-approval"><legend>{`Duyệt bản chuẩn theo loại tài liệu — ${project.name}`}</legend>
        {DOC_APPROVAL_TYPES.map(type=><label key={type} className="team-check">
          <input type="checkbox" name={project.id+'-report'} value={docApprovalCode(type)} defaultChecked={previous?.reportPermissions.includes(docApprovalCode(type))}/>{TYPE_NAMES[type]}
        </label>)}
      </fieldset>}
    </div>;
  })}</fieldset>;
}

/** The server's own rule (AccountService): anything that is not a pure reduction needs a ballot. */
export const expandsAccess=(before:ProjectGrant[],after:ProjectGrant[]):boolean=>widensAccess(before,after);

/** Widening goes through a ballot; the server still refuses a widening save without an approved ballot. Reducing keeps the direct save. */
export function AccessActions({expands,busy}:{expands:boolean;busy:boolean}) {
  return expands?<>
    <button type="submit" className="primary" disabled={busy} value="propose_access_change">Trình phiếu đổi quyền</button>
    <button type="submit" className="secondary" disabled={busy} value="access">Áp quyền đã được duyệt</button>
  </>:<button type="submit" className="primary" disabled={busy} value="access">Lưu quyền</button>;
}

/** Task 7c (T7C-15, OQ-37 c, OQ-49 a): the open access-change ballot of the selected account, as the server listed it. The screen computes no
 * right: the stage, the proposer's standing and who may cancel all come from `accessChange`; every refusal comes from the server. */
export function OpenBallot({change,projects,busy}:{change:OpenAccessChange|null|undefined;projects:Project[];busy:boolean}) {
  if(!change) return null;
  // the shape grantText of /approvals takes; a project that is not in the list is shown by its id (F10)
  const named=(grants:ProjectGrant[])=>grants.map(grant=>({name:projects.find(project=>project.id===grant.projectId)?.name??grant.projectId,
    role:grant.role,reportPermissions:grant.reportPermissions}));
  const coordinator=change.viaProjectManager;
  return <div className="action-form" data-ballot={change.state}>
    {change.state==='approved'?<>
      <p>Phiếu đổi quyền đã đủ xác nhận.</p>
      <p>Quyền hiện tại: {grantText(named(change.previousGrants),'chưa có quyền nào')}<br/>
        <span aria-hidden="true">→</span> Quyền đề nghị: {grantText(named(change.grants),'chưa có')}</p>
    </>:<p>Đang có phiếu đổi quyền chờ một thành viên BoM.</p>}
    <p className="muted">Căn cứ: <bdi dir="auto">{change.reason}</bdi></p>
    {coordinator&&<p>Phiếu này do điều phối dự án trình. Huỷ phiếu không đổi tài khoản và không thu hồi phiên của thành viên.</p>}
    {coordinator&&change.proposerIsCoordinator===false&&<p role="note">Người trình không còn là điều phối đang hoạt động của dự án này. Phiếu vẫn áp được; cân nhắc trước khi áp.</p>}
    {(change.state==='approved'||coordinator)&&<div className="team-actions">
      {change.state==='approved'&&<button type="submit" className="primary" disabled={busy} value="apply_frozen">Áp đúng bộ quyền đã được duyệt</button>}
      {coordinator&&<button type="submit" className="secondary" disabled={busy} value="cancel_access_change">Huỷ phiếu của điều phối</button>}
    </div>}
  </div>;
}

/** {proposerIsCoordinator} when the account has an open coordinator ballot (the boolean of accessChange); otherwise {}. */
export function standingEcho(user:{accessChange?:OpenAccessChange|null}):{proposerIsCoordinator?:boolean} {
  const standing=user.accessChange?.proposerIsCoordinator;
  return typeof standing==='boolean'?{proposerIsCoordinator:standing}:{};
}

/** The two ballot commands, built from the ballot the server listed, never from the ticked boxes. */
export function ballotCommand(action:'apply_frozen'|'cancel_access_change',user:{id:string;version:number;accessChange:OpenAccessChange},reason:unknown):Record<string,unknown> {
  return action==='apply_frozen'
    ?{kind:'access',userId:user.id,expectedVersion:user.version,reason,grants:user.accessChange.grants,...standingEcho(user)}
    :{kind:'cancel_access_change',userId:user.id,expectedVersion:user.version,reason,approvalId:user.accessChange.approvalId};
}

/** A VERSION_CONFLICT means what the page shows is stale (the account, or the proposer's standing): reload the list. */
export function shouldReloadAccounts(e:unknown):boolean {
  return e instanceof ApiError&&e.code==='VERSION_CONFLICT';
}

/** Every checked box of a project, old report permissions and doc_approve codes alike (they share the field name). */
export function readGrants(form:FormData,projects:Project[]):ProjectGrant[] {
  return projects.flatMap(({id})=>{
    const role=form.get(id) as ProjectGrant['role']|'';
    return role?[{projectId:id,role,reportPermissions:form.getAll(id+'-report') as GrantPermission[]}]:[];
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
    // The two ballot buttons of OpenBallot: the body comes from the listed ballot, not from the boxes
    const onBallot=kind==='apply_frozen'||kind==='cancel_access_change';
    const change=user?.accessChange;
    if(onBallot&&(!user||!change)) return;
    const command=isNew?{kind,username:form.get('username'),name:form.get('name'),reason,grants}:
      onBallot&&user&&change?ballotCommand(kind,{id:user.id,version:user.version,accessChange:change},reason):
      {kind,userId:user?.id,expectedVersion:user?.version,reason,
        ...(kind==='access'||kind==='propose_access_change'?{grants}:{}),
        // T7C-11: the manual save also echoes the standing this page showed; the server reads it only when a coordinator ballot is applied
        ...(kind==='access'?standingEcho(user??{}):{}),
        ...(kind==='verify_github'?{githubId:form.get('githubId'),sourceId:form.get('sourceId')}:{}),
      };
    setBusy(true);setError('');setNotice('');setInvitation('');
    try {
      const result=await api<Result>('/api/team/accounts',command);
      if(result.invitation) setInvitation(location.origin+'/activate#'+result.invitation.token);
      setAccounts(await api<Account[]>('/api/team/accounts'));
      setNotice(kind==='propose_access_change'?'Đã trình phiếu đổi quyền. Cần ít nhất một thành viên BoM chọn Yes trên nền; quyền chưa đổi cho tới khi áp quyền đã được duyệt.':
        kind==='cancel_access_change'?'Đã huỷ phiếu. Phiên bản tài khoản và phiên đăng nhập của thành viên không đổi.':'Đã lưu thay đổi tài khoản.');
      if(isNew) element.reset();
    } catch(error) {
      setError((error as Error).message);
      // The account or the proposer's standing changed: show the list as it is now, so the note (or its absence) sits on the button
      if(shouldReloadAccounts(error)) try {setAccounts(await api<Account[]>('/api/team/accounts'));} catch(reload) {setError((reload as Error).message);}
    }
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
          <OpenBallot change={user.accessChange} projects={projects} busy={busy}/>
          <Grants projects={projects} initial={user.grants} withDocApproval/>
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
