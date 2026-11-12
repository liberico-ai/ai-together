import { database } from '@/server/db';
import { handleDocumentsApi } from '@/server/documents-http';
import { failure } from '@/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handler(request:Request,ctx:{params:Promise<{path?:string[]}>}) {
  try { return await handleDocumentsApi(request,['documents',...((await ctx.params).path??[])],await database()); } catch(error) { return failure(error); }
}
export const GET=handler;
export const POST=handler;
