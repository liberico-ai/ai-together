import { AccountService } from '@/server/accounts';
import { authenticatedPrincipal,checkOrigin } from '@/server/auth';
import { identityService } from '@/server/identity';
import { body,failure,success } from '@/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {return success(await new AccountService(identityService()).pendingRegistrations(await authenticatedPrincipal(request)));}
  catch(error){return failure(error);}
}
export async function POST(request:Request) {
  try {checkOrigin(request);return success(await new AccountService(identityService()).registrationDecision(
    await authenticatedPrincipal(request),await body(request)));}
  catch(error){return failure(error);}
}
