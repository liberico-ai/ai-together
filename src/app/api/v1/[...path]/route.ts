import { database } from '@/server/db';
import { handleApi, failure } from '@/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handler(request:Request,ctx:{params:Promise<{path:string[]}>}) {
  try { return await handleApi(request,(await ctx.params).path,await database()); } catch(error) { return failure(error); }
}
export const GET=handler;
export const POST=handler;
