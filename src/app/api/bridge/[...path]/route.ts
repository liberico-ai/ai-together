import {handleBridgeIo} from '@/server/bridge-io';
import {loadBridgeConfig} from '@/server/bridge-config';
import {pooledDatabase,type Database} from '@/server/db';
import {identityService} from '@/server/identity';
import {failure,success} from '@/server/http';
import {AppError} from '@/server/errors';
export const runtime='nodejs';
const g=globalThis as unknown as {libetechIntakeDb?:Database};
export async function POST(request:Request,context:{params:Promise<{path:string[]}>}) {
 try {
  const url=process.env.INTAKE_DATABASE_URL;
  if(!url||process.env.LIBETECH_DEMO==='1') throw new AppError('INTAKE_UNCONFIGURED','Tiếp nhận chưa được cấu hình.',503);
  const config=await loadBridgeConfig();
  if(!config) throw new AppError('INTAKE_UNCONFIGURED','Tiếp nhận chưa được cấu hình.',503);
  g.libetechIntakeDb??=pooledDatabase(url,true);
  const identity=identityService();
  const {path}=await context.params;
  return success(await handleBridgeIo(request,path,{intakeDb:g.libetechIntakeDb,identity,config,tenantId:identity.tenantId}));
 } catch(error) {return failure(error);}
}
