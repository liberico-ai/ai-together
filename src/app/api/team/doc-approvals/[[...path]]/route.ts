import { handleDocApprovalApi } from '@/server/doc-approval-http';
import { identityService } from '@/server/identity';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handler(request:Request,ctx:{params:Promise<{path?:string[]}>}) {
  return handleDocApprovalApi(request,(await ctx.params).path??[],identityService);
}
// every method reaches the handler, so a method the path does not take answers the common 404 instead of a framework 405
export const GET=handler;
export const POST=handler;
export const PUT=handler;
export const PATCH=handler;
export const DELETE=handler;
