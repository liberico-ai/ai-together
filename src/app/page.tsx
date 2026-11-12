import { cookies, headers } from 'next/headers';
import { COOKIE, sessionPrincipal, localHost } from '@/server/auth';
import { database } from '@/server/db';
import { WorkService } from '@/server/service';
import { Workspace } from '@/components/workspace';
import { Login } from '@/components/login';
import { identityService, SESSION_COOKIE } from '@/server/identity';
import { Welcome } from '@/components/welcome';
import { APP_VERSION } from '@/server/version';
import { bridgeStatus, bridgeVerifiedAt } from '@/server/integration-status';
export const dynamic='force-dynamic';
export default async function Page() {
  const host=(await headers()).get('host')??'';
  const demo=process.env.LIBETECH_DEMO==='1' && localHost(host);
  let principal;
  try { principal=demo?sessionPrincipal((await cookies()).get(COOKIE)?.value,host):await identityService().session((await cookies()).get(SESSION_COOKIE)?.value); }
  catch { return demo?<Welcome enabled={demo}/>:<Login/>; }
  try {
    const data=await new WorkService(await database()).workspace(principal);
    return <Workspace key={principal.id} principal={principal} initial={JSON.parse(JSON.stringify(data))} demo={demo} version={APP_VERSION} bridge={bridgeStatus({configured:Boolean(process.env.LIBETECH_BRIDGE_CONFIG),verifiedAt:await bridgeVerifiedAt()})}/>;
  } catch {
    return <main className="failure"><h1>Chưa mở được kho dữ liệu</h1><p>Kiểm tra tiến trình ứng dụng và quyền thư mục dữ liệu. Không tạo dữ liệu thay thế khi chưa đối soát.</p><a href="/">Thử tải lại</a></main>;
  }
}
