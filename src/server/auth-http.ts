import { IdentityService,SESSION_COOKIE } from './identity';
import { checkOrigin,cookieToken } from './auth';
import { body,success,failure } from './http';
import { AppError } from './errors';
export async function handleAuth(request:Request,action:string,service:IdentityService) {
 try {
  if(request.method==='GET'&&action==='me') { const principal=await service.session(cookieToken(request,SESSION_COOKIE));return success({principal,telegram:await service.linkStatus(principal)}); }
  if(request.method!=='POST') throw new AppError('NOT_FOUND','Không có đường dẫn này.',404);
  checkOrigin(request);
  if(action==='register') return success(await service.requestRegistration(await body(request)),202);
  if(action==='login'||action==='activate') {
   const result=action==='login'?await service.login(await body(request)):await service.activate(await body(request));
   const response=success({principal:result.principal});
   const secure=request.headers.get('origin')?.startsWith('https://')?'; Secure':'';
   response.headers.set('Set-Cookie',`${SESSION_COOKIE}=${result.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`);
   return response;
  }
  if(action==='logout') {
   await service.logout(cookieToken(request,SESSION_COOKIE)); const response=success({signedOut:true});
   response.headers.set('Set-Cookie',`${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${request.headers.get('origin')?.startsWith('https://')?'; Secure':''}`); return response;
  }
  if(action==='telegram-unlink') return success(await service.unlinkTelegram(await service.session(cookieToken(request,SESSION_COOKIE))));
  if(action==='telegram-code') return success(await service.pairingCode(await service.session(cookieToken(request,SESSION_COOKIE))));
  throw new AppError('NOT_FOUND','Không có đường dẫn này.',404);
 } catch(error) { return failure(error); }
}
