import { randomUUID } from 'node:crypto';
import { authenticatedPrincipal, checkOrigin } from './auth';
import { AppError } from './errors';
import { body, failure, success } from './http';
import { DocApprovalProposalService } from './doc-approval-proposals';
import type { IdentityService } from './identity';

// Task 7c: thin adapter for /api/team/doc-approvals. A project coordinator proposes a document-approval ballot, lists the own open ones and
// withdraws an own pending one.
// The principal comes from the session, never from the body or the query; the service reads every role from the database. Nothing here
// applies grants: only the account admin does, through /api/team/accounts.

/** One answer for an unknown path, a method the path does not take and every out-of-scope id: the service's own SCOPE_DENIED sentence. */
const notFound = () => new AppError('SCOPE_DENIED', 'Không tìm thấy mục trong phạm vi được cấp.', 404);

/** Every query parameter, a repeated one as a list; the strict service schema refuses whatever it does not name (an own `__proto__` included). */
function query(request: Request): Record<string, unknown> {
  const params = new URL(request.url).searchParams;
  return Object.fromEntries([...new Set(params.keys())].map(k => { const all = params.getAll(k); return [k, all.length === 1 ? all[0] : all]; }));
}

/** The header is set on the finished response, so a 401, 403, 404, 422, 500 and 503 carry it as well as a success (T7C-24). */
function noStore(response: Response): Response {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

/**
 * H1 of the Task 1a security review: the service maps only the one-open-ballot index to APPROVAL_PENDING and rethrows every other unique
 * violation unchanged (T7C-22). The shared failure() would word such an error as DUPLICATE_CODE, a sentence of the work module; here it is
 * the generic internal error, like any other failure the service did not mean to answer. failure() itself is not changed.
 * The class is named (code review M4, Task 1b N6) so that failure() logs `errorType:"UnmappedUniqueViolation"`, not the `"Error"` of every
 * other 500; the answer is the same generic 500. `name` is set as a string, so a minified class name never changes what is logged.
 */
export class UnmappedUniqueViolation extends Error { override name = 'UnmappedUniqueViolation'; }
const unexpected = (error: unknown): unknown =>
  !(error instanceof AppError) && (error as { code?: unknown } | null)?.code === '23505' ? new UnmappedUniqueViolation('Unmapped unique violation.') : error;

export async function handleDocApprovalApi(request: Request, parts: string[], identity: () => IdentityService): Promise<Response> {
  const requestId = randomUUID();
  try {
    const principal = await authenticatedPrincipal(request);
    // Next.js serves HEAD through the exported GET handler: a HEAD is a read like GET, never a write that needs the origin check
    const m = request.method === 'HEAD' ? 'GET' : request.method;
    if (m !== 'GET') checkOrigin(request);
    const proposals = new DocApprovalProposalService(identity());
    const ok = (data: unknown) => noStore(success(data, 200, requestId));
    if (parts.length === 0) {
      if (m === 'GET') return ok(await proposals.listOwn(principal, query(request)));
      if (m === 'POST') return ok(await proposals.propose(principal, await body(request)));
    }
    // Task 2: the path segment and the body go to the service as they are; the ballot id is never read from or merged into the body (T7C-31)
    if (parts.length === 2 && parts[1] === 'withdraw' && m === 'POST') return ok(await proposals.withdraw(principal, parts[0], await body(request)));
    // everything else is the common not-found
    throw notFound();
  } catch (error) { return noStore(failure(unexpected(error), requestId)); }
}
