import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';
import { pooledDatabase, type Database, type Queryable } from './db';
import { invariant } from './errors';
import type { Principal, ProjectGrant, ReportPermission, Role } from './types';

export const SESSION_COOKIE='libetech_session';
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export const secret=()=>randomBytes(32).toString('base64url');
const passwordSchema=z.string().min(12).max(128);
const options={algorithm:2,memoryCost:19456,timeCost:2,parallelism:1};
export const passwordHash=(password:string)=>hash(passwordSchema.parse(password),options);
const store=globalThis as unknown as {identityDb?:Database;dummyPassword?:Promise<string>};
const dummy=()=>store.dummyPassword??=hash(secret(),options);
type User={id:string;tenant_id:string;username:string;name:string;role:Role;password_hash:string|null;active:boolean};

export class IdentityService {
 constructor(private db:Database,readonly tenantId:string,readonly adminId?:string) { z.uuid().parse(tenantId); if(adminId) z.uuid().parse(adminId); }
 scope<T>(fn:(tx:Queryable)=>Promise<T>) {
  return this.db.transaction(async tx=>{
   await tx.query('SET LOCAL ROLE libetech_identity');
   await tx.query("SELECT set_config('app.tenant_id',$1,true)",[this.tenantId]);
   return fn(tx);
  });
 }
 private async event(tx:Queryable,userId:string|null,kind:string) {
  await tx.query('INSERT INTO identity.events(tenant_id,user_id,kind) VALUES($1,$2,$3)',[this.tenantId,userId,kind]);
 }
 async throttle(bucket:string,limit:number,seconds=900) {
  // Committed separately: rejected login transactions must not roll back attempt counts.
  const attempts=await this.scope(async tx=>(await tx.query<{attempts:number}>(`INSERT INTO identity.throttle(tenant_id,bucket) VALUES($1,$2)
   ON CONFLICT(tenant_id,bucket) DO UPDATE SET
   attempts=CASE WHEN identity.throttle.window_start < now()-($3*interval '1 second') THEN 1 ELSE identity.throttle.attempts+1 END,
   window_start=CASE WHEN identity.throttle.window_start < now()-($3*interval '1 second') THEN now() ELSE identity.throttle.window_start END,updated_at=now() RETURNING attempts`,[this.tenantId,digest(bucket),seconds])).rows[0].attempts);
  invariant(attempts<=limit,'RATE_LIMITED','Thử lại sau ít phút.',429);
 }
 async grants(tx:Queryable,id:string):Promise<ProjectGrant[]> {
  const rows=(await tx.query<{project_id:string;role:ProjectGrant['role'];report_permissions:ReportPermission[]}>(`SELECT m.project_id,coalesce(m.project_role,u.role) AS role,m.report_permissions
    FROM identity.memberships m JOIN identity.users u ON (u.id,u.tenant_id)=(m.user_id,m.tenant_id)
    WHERE m.user_id=$1 ORDER BY m.project_id`,[id])).rows;
  return rows.map(row=>({projectId:row.project_id,role:row.role,reportPermissions:row.report_permissions}));
 }
 private async principal(tx:Queryable,id:string):Promise<Principal> {
  const u=(await tx.query<User>('SELECT id,tenant_id,name,role,active FROM identity.users WHERE id=$1 AND active',[id])).rows[0];
  invariant(u,'UNAUTHENTICATED','Cần đăng nhập lại.',401);
  const grants=await this.grants(tx,id);
  invariant(grants.length,'NO_PROJECT_ACCESS','Tài khoản chưa được giao dự án.',403);
  const roles=new Set(grants.map(grant=>grant.role));
  return {id:u.id,tenantId:u.tenant_id,name:u.name,role:roles.size===1?grants[0].role:'viewer',
   projectIds:grants.map(grant=>grant.projectId),grants,accountAdmin:id===this.adminId};
 }
 private async issue(tx:Queryable,userId:string) {
  const token=secret();
  await tx.query(`INSERT INTO identity.sessions(tenant_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')`,[this.tenantId,userId,digest(token)]);
  await this.event(tx,userId,'session_started');
  return {token,principal:await this.principal(tx,userId)};
 }
 async login(input:unknown) {
  const data=z.object({username:z.string().trim().min(1).max(64).transform(v=>v.toLowerCase()),password:z.string().min(1).max(128)}).strict().parse(input);
  await this.throttle('login-global',100,60); await this.throttle('login:'+data.username,8);
  const user=await this.scope(async tx=>(await tx.query<User>('SELECT * FROM identity.users WHERE username=$1',[data.username])).rows[0]);
  const valid=await verify(user?.password_hash??await dummy(),data.password).catch(()=>false);
  invariant(valid&&user?.active&&user.password_hash,'LOGIN_FAILED','Tên đăng nhập hoặc mật khẩu chưa đúng.',401);
  return this.scope(async tx=>{
   // Lock/recheck to close disable/password-change races during expensive hashing.
   const current=(await tx.query<User>('SELECT * FROM identity.users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];
   invariant(current?.active&&current.password_hash===user.password_hash,'LOGIN_FAILED','Tên đăng nhập hoặc mật khẩu chưa đúng.',401);
   return this.issue(tx,user.id);
  });
 }
 async requestRegistration(input:unknown) {
  const data=z.object({username:z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/),
   name:z.string().trim().min(2).max(100),projectInterest:z.string().trim().min(2).max(200),
   note:z.string().trim().max(500).default('')}).strict().parse(input);
  await this.throttle('registration-global',30,3600);
  await this.throttle('registration:'+data.username,3,86400);
  return this.scope(async tx=>{
   // Do not disclose whether a username already belongs to a real account.
   const existing=(await tx.query(`SELECT id FROM identity.users WHERE username=$1
    UNION ALL SELECT user_id FROM identity.registration_requests
    WHERE username=$1 AND state='approved' AND user_id IS NOT NULL LIMIT 1`,[data.username])).rows.length;
   if(!existing) await tx.query(`INSERT INTO identity.registration_requests
    (tenant_id,username,name,project_interest,note) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT DO NOTHING`,[this.tenantId,data.username,data.name,data.projectInterest,data.note]);
   return {received:true};
  });
 }
 async activate(input:unknown) {
  const {token,password}=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/),password:passwordSchema}).strict().parse(input);
  await this.throttle('activate',30,300);
  const encoded=await passwordHash(password);
  return this.scope(async tx=>{
   const row=(await tx.query<{id:string;user_id:string;issuer_id:string|null;account_approval_id:string|null}>(`SELECT i.id,i.user_id,i.issuer_id,i.account_approval_id FROM identity.invitations i JOIN identity.users u ON u.id=i.user_id AND u.tenant_id=i.tenant_id
    WHERE i.token_hash=$1 AND i.consumed_at IS NULL AND i.expires_at>now() AND u.active AND u.password_hash IS NULL
    AND (i.issuer_id IS NULL OR i.account_version=u.account_version) FOR UPDATE OF i,u`,[digest(token)])).rows[0];
   invariant(row,'INVITATION_INVALID','Lời mời đã hết hạn hoặc đã được sử dụng.',403);
   if(!row.issuer_id&&this.adminId) invariant(row.user_id===this.adminId,
    'TELEGRAM_APPROVAL_REQUIRED','Lời mời khởi tạo chỉ dành cho quản trị ban đầu.',403);
   if(row.issuer_id){
    const pilot=(await tx.query<{id:string}>(`SELECT e.id FROM identity.pilot_onboarding_exceptions e
      JOIN identity.registration_requests r ON (r.id,r.tenant_id)=(e.registration_id,e.tenant_id)
      WHERE e.invitation_id=$1 AND e.user_id=$2 AND e.authorized_by=$3
       AND e.batch_key='pilot-20261111' AND e.expires_at>now()
       AND r.state='approved' AND r.user_id=$2`,[row.id,row.user_id,this.adminId])).rows[0];
    if(!pilot){
     invariant(row.account_approval_id,'TELEGRAM_APPROVAL_REQUIRED','Lời mời chưa qua phiếu duyệt.',403);
     // Only a registration ballot opens an invitation; an access-change ballot (018) never does.
     const approved=(await tx.query<{id:string}>(`SELECT a.id FROM identity.account_approvals a
       JOIN identity.registration_requests r ON (r.id,r.tenant_id)=(a.registration_id,a.tenant_id)
       WHERE a.id=$1 AND a.kind='registration' AND a.state='issued' AND r.state='approved' AND r.user_id=$2
       AND EXISTS (SELECT 1 FROM identity.account_approval_voters av
         JOIN identity.account_approval_votes v ON v.approval_id=av.approval_id AND v.voter_id=av.user_id
         WHERE av.approval_id=a.id AND av.seat='chairman' AND av.user_id=$3 AND v.choice='agree')
       AND EXISTS (SELECT 1 FROM identity.account_approval_voters av
         JOIN identity.account_approval_votes v ON v.approval_id=av.approval_id AND v.voter_id=av.user_id
         WHERE av.approval_id=a.id AND av.seat IN ('bom_chu','bom_quan','bom_phuong') AND v.choice='agree')`,
       [row.account_approval_id,row.user_id,this.adminId])).rows[0];
     invariant(approved,'TELEGRAM_APPROVAL_REQUIRED','Lời mời cần anh và một thành viên BoM xác nhận.',403);
    }
    const issuer=(await tx.query<{id:string}>('SELECT id FROM identity.users WHERE id=$1 AND active AND password_hash IS NOT NULL',[row.issuer_id])).rows[0];
    const projects=new Set((await this.grants(tx,row.issuer_id)).map(grant=>grant.projectId));
    const invited=await this.grants(tx,row.user_id);
    invariant(issuer && issuer.id===this.adminId && invited.length && invited.every(grant=>projects.has(grant.projectId)),
     'INVITATION_INVALID','Lời mời không còn hiệu lực.',403);
   }
   await tx.query('UPDATE identity.users SET password_hash=$1,updated_at=now() WHERE id=$2',[encoded,row.user_id]);
   await tx.query('UPDATE identity.invitations SET consumed_at=now(),updated_at=now() WHERE id=$1',[row.id]);
   await this.event(tx,row.user_id,'invitation_activated');
   return this.issue(tx,row.user_id);
  });
 }
 async session(token:string|undefined) {
  invariant(token&&/^[A-Za-z0-9_-]{43}$/.test(token),'UNAUTHENTICATED','Cần đăng nhập để tiếp tục.',401);
  return this.scope(async tx=>{
   const row=(await tx.query<{user_id:string}>('SELECT user_id FROM identity.sessions WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now()',[digest(token)])).rows[0];
   invariant(row,'UNAUTHENTICATED','Phiên đã hết hạn. Đăng nhập lại để tiếp tục.',401);
   return this.principal(tx,row.user_id);
  });
 }
 async logout(token:string|undefined) {
  if(!token) return;
  await this.scope(async tx=>{ await tx.query('UPDATE identity.sessions SET revoked_at=now(),updated_at=now() WHERE token_hash=$1',[digest(token)]); });
 }
 async directory(p:Principal):Promise<Principal[]> {
  invariant(p.tenantId===this.tenantId,'SCOPE_DENIED','Không có quyền truy cập.',403);
  return this.scope(async tx=>{
   const rows=(await tx.query<{id:string;name:string;project_id:string;role:ProjectGrant['role']}>(`SELECT u.id,u.name,m.project_id,coalesce(m.project_role,u.role) AS role
    FROM identity.users u JOIN identity.memberships m ON (u.id,u.tenant_id)=(m.user_id,m.tenant_id)
    WHERE u.active AND m.project_id=ANY($1::uuid[]) ORDER BY u.name,m.project_id`,[p.projectIds])).rows;
   const people=new Map<string,Principal>();
   for(const row of rows){
    const person=people.get(row.id)??{id:row.id,tenantId:p.tenantId,name:row.name,role:row.role,projectIds:[],grants:[]};
    if(person.role!==row.role) person.role='viewer';
    person.projectIds.push(row.project_id);
    person.grants?.push({projectId:row.project_id,role:row.role,reportPermissions:[]});
    people.set(row.id,person);
   }
   return [...people.values()];
  });
 }
 async linkStatus(p:Principal) {
  invariant(p.tenantId===this.tenantId,'SCOPE_DENIED','Không có quyền truy cập.',403);
  return this.scope(async tx=>{
   const row=(await tx.query<{telegram_id:string;created_at:string}>('SELECT telegram_id,created_at FROM identity.telegram_links WHERE user_id=$1',[p.id])).rows[0];
   return row?{linked:true,telegramId:row.telegram_id,linkedAt:row.created_at}:{linked:false};
  });
 }
 async pairingCode(p:Principal) {
  invariant(p.tenantId===this.tenantId&&p.role!=='bot','SCOPE_DENIED','Không có quyền truy cập.',403);
  await this.throttle('pairing:'+p.id,5,300);
  const code=secret();
  await this.scope(async tx=>{
   invariant((await tx.query('SELECT id FROM identity.users WHERE id=$1 AND active FOR UPDATE',[p.id])).rows.length,
    'UNAUTHENTICATED','Cần đăng nhập lại.',401);
   invariant(!(await tx.query('SELECT id FROM identity.telegram_links WHERE user_id=$1',[p.id])).rows.length,'ALREADY_LINKED','Tài khoản đã ghép Telegram.',409);
   await tx.query('UPDATE identity.telegram_codes SET consumed_at=now(),updated_at=now() WHERE user_id=$1 AND consumed_at IS NULL',[p.id]);
   await tx.query(`INSERT INTO identity.telegram_codes(tenant_id,user_id,code_hash,expires_at) VALUES($1,$2,$3,now()+interval '5 minutes')`,[this.tenantId,p.id,digest(code)]);
  });
  return {code,expiresIn:300};
 }
 // Only invoked by the authenticated gateway bridge. Never expose as a browser user-ID form.
 async pair(code:string,telegramId:string,chatId:string,chatType:string) {
  invariant(/^[1-9][0-9]{0,19}$/.test(telegramId)&&chatId===telegramId&&['dm','private'].includes(chatType),'PRIVATE_CHAT_REQUIRED','Chỉ ghép trong tin nhắn riêng với bot.',403);
  z.string().regex(/^[A-Za-z0-9_-]{43}$/).parse(code);
  await this.throttle('pair-telegram:'+telegramId,5,300);
  return this.scope(async tx=>{
   const row=(await tx.query<{id:string;user_id:string}>(`SELECT c.id,c.user_id FROM identity.telegram_codes c JOIN identity.users u ON u.id=c.user_id AND u.tenant_id=c.tenant_id
    WHERE c.code_hash=$1 AND c.consumed_at IS NULL AND c.expires_at>now() AND u.active FOR UPDATE OF c,u`,[digest(code)])).rows[0];
   invariant(row,'PAIRING_INVALID','Mã ghép đã hết hạn hoặc đã sử dụng.',403);
   invariant(!(await tx.query('SELECT id FROM identity.telegram_links WHERE user_id=$1 OR telegram_id=$2',[row.user_id,telegramId])).rows.length,'IDENTITY_CONFLICT','Danh tính đã được ghép; cần người quản trị xử lý.',409);
   await tx.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3)',[this.tenantId,row.user_id,telegramId]);
   await tx.query('UPDATE identity.telegram_codes SET consumed_at=now(),updated_at=now() WHERE id=$1',[row.id]);
   await this.event(tx,row.user_id,'telegram_verified');
   return {linked:true};
  });
 }
 async unlinkTelegram(p:Principal) {
  invariant(p.tenantId===this.tenantId && p.role!=='bot','SCOPE_DENIED','Không có quyền truy cập.',403);
  return this.scope(async tx=>{
   invariant((await tx.query('SELECT id FROM identity.users WHERE id=$1 AND active FOR UPDATE',[p.id])).rows.length,
    'UNAUTHENTICATED','Cần đăng nhập lại.',401);
   const removed=await tx.query('DELETE FROM identity.telegram_links WHERE user_id=$1 RETURNING id',[p.id]);
   await tx.query('UPDATE identity.telegram_codes SET consumed_at=now(),updated_at=now() WHERE user_id=$1 AND consumed_at IS NULL',[p.id]);
   if(removed.rows.length) await this.event(tx,p.id,'telegram_unlinked');
   return {linked:false};
  });
 }
 async telegramPrincipal(telegramId:string) {
  return this.scope(async tx=>{
   const row=(await tx.query<{user_id:string}>('SELECT user_id FROM identity.telegram_links WHERE telegram_id=$1',[telegramId])).rows[0];
   invariant(row,'TELEGRAM_NOT_LINKED','Cần ghép tài khoản Telegram trong LibeTech AI OS trước.',403);
   return this.principal(tx,row.user_id);
  });
 }
}
export function identityService() {
 invariant(process.env.LIBETECH_DEMO!=='1'&&process.env.IDENTITY_DATABASE_URL&&process.env.LIBETECH_TENANT_ID,'IDENTITY_UNAVAILABLE','Đăng nhập chưa được cấu hình.',503);
 store.identityDb??=pooledDatabase(process.env.IDENTITY_DATABASE_URL,true);
 return new IdentityService(store.identityDb,process.env.LIBETECH_TENANT_ID,process.env.LIBETECH_ACCOUNT_ADMIN_ID);
}
