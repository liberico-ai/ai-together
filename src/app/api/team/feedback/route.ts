import { authenticatedPrincipal,checkOrigin } from '@/server/auth';
import { database } from '@/server/db';
import { FeedbackService } from '@/server/feedback';
import { body,failure,success } from '@/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 try {return success(await new FeedbackService(await database()).list(await authenticatedPrincipal(request)));}
 catch(error){return failure(error);}
}
export async function POST(request:Request) {
 try {checkOrigin(request);return success(await new FeedbackService(await database()).create(
  await authenticatedPrincipal(request),await body(request)),201);}
 catch(error){return failure(error);}
}
export async function PATCH(request:Request) {
 try {checkOrigin(request);return success(await new FeedbackService(await database()).resolve(
  await authenticatedPrincipal(request),await body(request)));}
 catch(error){return failure(error);}
}
