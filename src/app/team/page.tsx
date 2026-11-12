import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AccountService } from '@/server/accounts';
import { identityService,SESSION_COOKIE } from '@/server/identity';
import { database } from '@/server/db';
import { WorkService } from '@/server/service';
import { TeamAccounts } from '@/components/team-accounts';
import { AppError } from '@/server/errors';

export const dynamic='force-dynamic';
export default async function TeamPage() {
  const identity=identityService();
  const token=(await cookies()).get(SESSION_COOKIE)?.value;
  let principal;
  try { principal=await identity.session(token); }
  catch(error) {
    if(error instanceof AppError && error.status===401) redirect('/login');
    return <main className="failure"><h1>Chưa mở được tài khoản</h1><a href="/">Về trang chính</a></main>;
  }
  if(!principal.accountAdmin) return <main className="failure"><h1>Cần quyền quản trị tài khoản</h1><a href="/">Về trang chính</a></main>;
  const [accounts,requests,workspace]=await Promise.all([
    new AccountService(identity).list(principal),new AccountService(identity).pendingRegistrations(principal),
    new WorkService(await database()).workspace(principal),
  ]);
  return <TeamAccounts initial={accounts} requests={requests} projects={workspace.projects}/>;
}
