import { database } from '@/server/db';
import { requireDemoHost } from '@/server/auth';
import { failure,success } from '@/server/http';
import { APP_VERSION } from '@/server/version';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {
    if(process.env.LIBETECH_DEMO==='1') requireDemoHost(request.headers.get('host')??new URL(request.url).host);
    const db=await database();
    const rows=(await db.query<{version:string}>('SELECT version FROM schema_migrations ORDER BY version')).rows;
    return success({status:'ready',version:APP_VERSION,buildDigest:process.env.LIBETECH_BUILD_DIGEST??null,sourceSha:/^[a-f0-9]{40}$/.test(process.env.SOURCE_SHA??'')?process.env.SOURCE_SHA:null,schema:rows.map(r=>r.version),storage:process.env.DATABASE_URL?'postgresql-server':'local-persistent-pglite',synthetic:process.env.LIBETECH_DEMO==='1',integrations:{bot:process.env.LIBETECH_BRIDGE_CONFIG?'configured-not-runtime-verified':'not-configured',botWriteFlow:'not-connected',github:'read-only-snapshot',factory:'not-connected'}});
  } catch(error) { return failure(error); }
}
