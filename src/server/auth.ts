import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { demoProfiles } from './identities';
import type { Principal } from './types';
import { invariant } from './errors';
export const COOKIE = 'libetech_demo_session';
const store = globalThis as unknown as { libetechSessions?: Map<string,{principal:Principal; expires:number}> };
const sessions = () => store.libetechSessions ??= new Map();
export function localHost(host: string) {
  try { const url = new URL('http://' + host); return ['127.0.0.1','localhost','[::1]'].includes(url.hostname) && !url.username && !url.password && url.pathname === '/'; } catch { return false; }
}
export function requireDemoHost(host: string) {
  invariant(process.env.LIBETECH_DEMO === '1' && localHost(host),'DEMO_DISABLED','Phiên mô phỏng chỉ dùng trên máy cục bộ. Đăng nhập tổ chức chưa được kết nối.',403);
}
export function checkOrigin(request: Request) {
  const host = request.headers.get('host') ?? new URL(request.url).host;
  if(process.env.LIBETECH_DEMO!=='1') {
    const origins=[process.env.LIBETECH_ORIGIN,process.env.LIBETECH_TEAM_ORIGIN].filter((v):v is string=>Boolean(v));
    invariant(origins.length && origins.every(value=>{
      const url=new URL(value);
      return url.origin===value && (url.protocol==='https:' ||
        (localHost(url.host) && process.env.LIBETECH_LOCAL_AUTH==='1' && url.protocol==='http:'));
    }), 'ORIGIN_UNCONFIGURED','Cần cấu hình địa chỉ đăng nhập an toàn.',503);
    invariant(origins.some(value=>request.headers.get('origin')===value && host===new URL(value).host),
      'ORIGIN_DENIED','Nguồn gửi thao tác không hợp lệ.',403);
    return;
  }
  requireDemoHost(host);
  const origin = request.headers.get('origin');
  // Next may normalize Request.url to localhost while the browser used 127.0.0.1.
  // Compare the browser Origin with the validated Host, never trust forwarded headers.
  invariant(origin === 'http://' + host,'ORIGIN_DENIED','Nguồn gửi thao tác không hợp lệ.',403);
}
export function sessionPrincipal(token: string | undefined, host: string): Principal {
  requireDemoHost(host);
  const session = token ? sessions().get(token) : null;
  invariant(session && session.expires > Date.now(),'UNAUTHENTICATED','Chọn vai mô phỏng để mở không gian làm việc.',401);
  return session.principal;
}
export function principalFromRequest(request: Request) {
  const token = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  return sessionPrincipal(token,request.headers.get('host') ?? new URL(request.url).host);
}
export function createSession(request: Request, input: unknown): { token:string; principal:Principal } {
  requireDemoHost(request.headers.get('host')??new URL(request.url).host);
  checkOrigin(request);
  const { profileKey } = z.object({profileKey:z.enum(['manager','engineer','technical','business','customer','bot'])}).strict().parse(input);
  for (const [key,s] of sessions()) if (s.expires <= Date.now()) sessions().delete(key);
  invariant(sessions().size < 200,'SESSION_LIMIT','Đã đạt giới hạn phiên thử nghiệm; khởi động lại ứng dụng để xóa phiên cũ.',429);
  const token = randomBytes(32).toString('hex');
  const principal = demoProfiles[profileKey];
  sessions().set(token,{principal,expires:Date.now()+4*3600000});
  return {token,principal};
}
export function endSession(request: Request) {
  checkOrigin(request);
  const token = request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(token) sessions().delete(token);
}

export function cookieToken(request:Request,name:string) { return request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1); }
export async function authenticatedPrincipal(request:Request) {
 if(process.env.LIBETECH_DEMO==='1') return principalFromRequest(request);
 const {identityService,SESSION_COOKIE}=await import('./identity');
 return identityService().session(cookieToken(request,SESSION_COOKIE));
}
