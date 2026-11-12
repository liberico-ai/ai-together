import { ReportService } from '@/server/reports';
import { authenticatedPrincipal,checkOrigin,localHost } from '@/server/auth';
import { database } from '@/server/db';
import { body,failure,success } from '@/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';

async function handler(request:Request) {
  try {
    const principal=await authenticatedPrincipal(request);
    const fixtures=process.env.LIBETECH_LOCAL_AUTH==='1'&&localHost(request.headers.get('host')??'');
    const reports=new ReportService(await database(),fixtures);
    if(request.method==='POST') {
      checkOrigin(request);
      return success(await reports.command(principal,await body(request)),201);
    }
    const params=new URL(request.url).searchParams;
    return success(await reports.read(principal,{projectId:params.get('projectId'),
      runId:params.get('runId')??undefined,subjectId:params.get('subjectId')??undefined}));
  } catch(error) { return failure(error); }
}
export const GET=handler;
export const POST=handler;
