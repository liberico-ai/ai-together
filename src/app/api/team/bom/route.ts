import { authenticatedPrincipal,checkOrigin } from '@/server/auth';
import { database } from '@/server/db';
import { BomService } from '@/server/bom';
import { body,failure,success } from '@/server/http';
import { identityService } from '@/server/identity';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:Request) {
  try {
    const principal=await authenticatedPrincipal(request);
    const workId=new URL(request.url).searchParams.get('workId')??'';
    const people=await identityService().directory(principal);
    return success(await new BomService(await database()).read(principal,workId,people.map(person=>person.id)));
  } catch(error) { return failure(error); }
}

export async function POST(request:Request) {
  try {
    const principal=await authenticatedPrincipal(request);
    checkOrigin(request);
    return success(await new BomService(await database()).command(
      principal,await body(request),request.headers.get('Idempotency-Key')??''));
  } catch(error) { return failure(error); }
}
