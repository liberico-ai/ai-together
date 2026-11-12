import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {identityService,SESSION_COOKIE} from '@/server/identity';
import {AccountApprovalService} from '@/server/account-approval';
import {Approvals} from '@/components/approvals';
import {AppError} from '@/server/errors';
export const dynamic='force-dynamic';

export default async function ApprovalPage() {
 const identity=identityService();
 let principal;
 try {principal=await identity.session((await cookies()).get(SESSION_COOKIE)?.value);}
 catch(error){if(error instanceof AppError&&error.status===401) redirect('/login');throw error;}
 try {
  const pending=await new AccountApprovalService(identity).pendingForPrincipal(principal);
  return <Approvals initial={JSON.parse(JSON.stringify(pending))}/>;
 } catch(error) {
  if(error instanceof AppError&&error.status===403) return <main className="failure"><h1>Không có quyền duyệt tài khoản</h1><a href="/">Về trang chính</a></main>;
  throw error;
 }
}
