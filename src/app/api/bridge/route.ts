import {readFile} from 'node:fs/promises';
import {handleBridge} from '@/server/bridge';
import {database} from '@/server/db';
import {identityService} from '@/server/identity';
import {failure,success} from '@/server/http';
import {z} from 'zod';
export const runtime='nodejs';
export async function POST(request:Request) {
 try {
  const file=process.env.LIBETECH_BRIDGE_CONFIG;
  if(!file) return Response.json({error:{code:'BRIDGE_UNCONFIGURED'}},{status:503});
  const config=z.object({key:z.string().min(43),chatScopes:z.record(z.string().regex(/^-[1-9][0-9]*$/),z.array(z.string().uuid()))}).strict().parse(JSON.parse(await readFile(file,'utf8')));
  return success(await handleBridge(request,await database(),identityService(),config.key,config.chatScopes));
 } catch(error) {return failure(error);}
}
