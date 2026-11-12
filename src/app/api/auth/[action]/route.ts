import {identityService} from '@/server/identity';
import {handleAuth} from '@/server/auth-http';
import {failure} from '@/server/http';
export const runtime='nodejs';
type Context={params:Promise<{action:string}>};
async function handle(request:Request,ctx:Context) {
 try {return handleAuth(request,(await ctx.params).action,identityService());}
 catch(error){return failure(error);}
}
export const GET=handle;
export const POST=handle;
