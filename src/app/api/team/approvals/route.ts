import {authenticatedPrincipal,checkOrigin} from '@/server/auth';
import {AccountApprovalService} from '@/server/account-approval';
import {identityService} from '@/server/identity';
import {body,failure,success} from '@/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:Request) {
 try {return success(await new AccountApprovalService(identityService()).pendingForPrincipal(await authenticatedPrincipal(request)));}
 catch(error){return failure(error);}
}
export async function POST(request:Request) {
 try {
  checkOrigin(request);
  const p=await authenticatedPrincipal(request);
  const {approvalId,choice}=await body(request) as {approvalId:string;choice:unknown};
  return success(await new AccountApprovalService(identityService()).voteForPrincipal(p,approvalId,choice));
 } catch(error){return failure(error);}
}
