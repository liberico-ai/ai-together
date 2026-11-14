import {requireBridgeConfig} from '@/server/bridge-config';
import {handleBridge} from '@/server/bridge';
import {database} from '@/server/db';
import {identityService} from '@/server/identity';
import {failure,success} from '@/server/http';
export const runtime='nodejs';
export async function POST(request:Request) {
 try {
  const config=await requireBridgeConfig('BRIDGE_UNCONFIGURED');
  return success(await handleBridge(request,await database(),identityService(),config.key,config.chatScopes));
 } catch(error) {return failure(error);}
}
