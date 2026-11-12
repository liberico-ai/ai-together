import { createSession,endSession,COOKIE } from '@/server/auth';
import { body,success,failure } from '@/server/http';
export const runtime='nodejs';
export async function POST(request:Request) {
  try { const {token,principal}=createSession(request,await body(request)); const response=success({principal}); response.headers.set('Set-Cookie',COOKIE+'='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=14400'); return response; } catch(error) { return failure(error); }
}
export async function DELETE(request:Request) {
  try { endSession(request); const response=success({signedOut:true}); response.headers.set('Set-Cookie',COOKIE+'=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return response; } catch(error) { return failure(error); }
}
