import { randomUUID } from 'node:crypto';
import { authenticatedPrincipal, checkOrigin } from './auth';
import type { Database } from './db';
import { AppError } from './errors';
import { body, failure, success } from './http';
import { ReviewService } from './document-review';
import { DependencyService } from './document-dependencies';
import { DelegationService } from './review-delegations';
import { DecisionService } from './decisions';

// Same answer the review module gives for SCOPE_DENIED: unknown path, unknown literal, malformed id, out-of-scope id, a method the path does not take,
// bot, viewer and a member of another project are indistinguishable by status, code, message and shape.
const notFound = () => new AppError('SCOPE_DENIED', 'Không tìm thấy tài liệu trong phạm vi được cấp.', 404);

/** Every POST needs the header; the service validates its format and binds it to the command. Identity and requestId never come from the request body. */
function key(request: Request): string {
  const value = request.headers.get('idempotency-key') ?? '';
  if (value === '') throw new AppError('IDEMPOTENCY_REQUIRED', 'Cần mã thao tác hợp lệ để chống ghi lặp.', 400);
  return value;
}

/** Query string -> raw object; the service schema (strict) decides what is valid. */
function query(request: Request): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of new URL(request.url).searchParams) out[k] = k === 'limit' || k === 'offset' ? Number(v) : k === 'needsReview' && (v === 'true' || v === 'false') ? v === 'true' : v;
  return out;
}

/**
 * R15-g: the handler decides the not-found body, in one place. A service's SCOPE_DENIED with status 404 (the delegation service words it differently from the review
 * and dependency services) is answered with the handler's own not-found, so no route family can be told from another by the words. This replaces «the handler maps
 * nothing» for this one case only: every other code and status, and a SCOPE_DENIED with a status other than 404, passes through unchanged.
 */
const normalised = (error: unknown): unknown => (error instanceof AppError && error.code === 'SCOPE_DENIED' && error.status === 404 ? notFound() : error);

/** The header is set on the finished response so a 401, 403, 404, 422 and 500 carry it as well as a success. */
function noStore(response: Response): Response {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

/** For the route files: an error outside the handler (opening the database) answers the same way as one inside it. */
export function reviewRouteFailure(error: unknown): Response { return noStore(failure(normalised(error))); }

/**
 * Thin adapter for Review, project reviewers and document dependencies. The principal comes from the session; one requestId is generated per request,
 * handed to the service (audit rows) and returned in meta. Nothing here concerns document approval rights (those are applied only through accounts).
 */
export async function handleReviewApi(request: Request, parts: string[], db: Database): Promise<Response> {
  const requestId = randomUUID();
  try {
    const principal = await authenticatedPrincipal(request);
    const m = request.method;
    if (m !== 'GET') checkOrigin(request);
    if (parts[0] !== 'reviews') throw notFound();
    const rest = parts.slice(1);
    // the key is checked before the body is read: a write without it answers 400 whatever the body holds
    const write = async (run: (raw: unknown, k: string) => Promise<unknown>) => { const k = key(request); return noStore(success(await run(await body(request), k), 200, requestId)); };
    const review = new ReviewService(db), dependencies = new DependencyService(db), delegations = new DelegationService(db);
    if (m === 'GET' && rest.length === 0) return noStore(success(await review.queue(principal, query(request)), 200, requestId));
    if (rest[0] === 'dependencies') {
      if (m === 'GET' && rest.length === 1) return noStore(success(await dependencies.list(principal, query(request)), 200, requestId));
      if (m === 'POST' && rest.length === 1) return await write((raw, k) => dependencies.link(principal, raw, k, requestId));
      throw notFound();
    }
    if (rest[0] === 'delegations') {
      if (m === 'GET' && rest.length === 1) return noStore(success(await delegations.list(principal, query(request)), 200, requestId));
      if (m === 'POST' && rest.length === 1) return await write((raw, k) => delegations.grant(principal, raw, k, requestId));
      if (m === 'POST' && rest.length === 3 && rest[2] === 'revoke') return await write((raw, k) => delegations.revoke(principal, rest[1], raw, k, requestId));
      throw notFound();
    }
    if (m === 'POST' && rest.length === 2 && rest[1] === 'comments') return await write((raw, k) => review.comment(principal, rest[0], raw, k, requestId));
    if (m === 'POST' && rest.length === 2 && rest[1] === 'decisions') return await write((raw, k) => review.decide(principal, rest[0], raw, k, requestId));
    if (m === 'GET' && rest.length === 1) return noStore(success(await review.detail(principal, rest[0]), 200, requestId));   // a query string on a read by id has no effect, so a literal like `decisions` answers 404 with or without one
    throw notFound();
  } catch (error) { return noStore(failure(normalised(error), requestId)); }
}

/** GET /api/decisions only; this function takes no path, so nothing else is routed here. */
export async function handleDecisionsApi(request: Request, db: Database): Promise<Response> {
  const requestId = randomUUID();
  try {
    const principal = await authenticatedPrincipal(request);
    if (request.method !== 'GET') { checkOrigin(request); throw notFound(); }
    return noStore(success(await new DecisionService(db).list(principal, query(request)), 200, requestId));
  } catch (error) { return noStore(failure(normalised(error), requestId)); }
}
