import { database } from '@/server/db';
import { handleReviewApi, reviewRouteFailure } from '@/server/review-http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handler(request:Request,ctx:{params:Promise<{path?:string[]}>}) {
  try { return await handleReviewApi(request,['reviews',...((await ctx.params).path??[])],await database()); } catch(error) { return reviewRouteFailure(error); }
}
// every method reaches the handler, so a method the path does not take answers the common 404 instead of a framework 405
export const GET=handler;
export const POST=handler;
export const PUT=handler;
export const PATCH=handler;
export const DELETE=handler;
