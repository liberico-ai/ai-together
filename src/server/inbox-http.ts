import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { authenticatedPrincipal, checkOrigin } from './auth';
import type { Database } from './db';
import { AppError } from './errors';
import { body, failure, success } from './http';
import { InboxService } from './inbox';
import { currentExcerptChats } from './bridge-config';

// Same sentence as InboxService's out-of-scope answer: unknown path, unknown id and out-of-scope id are indistinguishable.
const notFound = () => new AppError('SCOPE_DENIED', 'Không tìm thấy mục trong phạm vi được cấp.', 404);
const key = (request: Request) => request.headers.get('idempotency-key') ?? '';
const projectQuery = z.object({ projectId: z.uuid() }).strict();

/** Query string -> raw object; the service schema (strict) decides what is valid. */
function query(request: Request): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of new URL(request.url).searchParams) out[k] = k === 'limit' || k === 'offset' ? Number(v) : v;
  return out;
}

/**
 * Thin adapter for the Inbox. Principal comes from the session; one requestId is generated per request,
 * handed to the service (audit rows) and returned in the response meta so audit joins request logs.
 * There is deliberately no intake or outbox-pull route here: those live under /api/bridge with signed requests.
 */
export async function handleInboxApi(request: Request, parts: string[], db: Database): Promise<Response> {
  const requestId = randomUUID();
  try {
    const principal = await authenticatedPrincipal(request);
    const m = request.method;
    if (m !== 'GET') checkOrigin(request);
    if (parts[0] !== 'inbox') throw notFound();
    // OQ-30: the flag list is read from the operator config on every request, so a tightened config hides text at once.
    const inbox = new InboxService(db, await currentExcerptChats());
    const rest = parts.slice(1);
    if (m === 'GET' && rest.length === 0) return success(await inbox.list(principal, query(request)), 200, requestId);
    if (m === 'GET' && rest.length === 1 && rest[0] === 'sources') return success(await inbox.sources(principal, projectQuery.parse(query(request)).projectId), 200, requestId);
    if (m === 'GET' && rest.length === 1 && rest[0] === 'failures') return success(await inbox.failures(principal, projectQuery.parse(query(request)).projectId), 200, requestId);
    if (m === 'POST' && rest.length === 3 && rest[0] === 'failures' && rest[2] === 'commands') {
      return success(await inbox.failureCommand(principal, rest[1], await body(request), key(request), requestId), 200, requestId);
    }
    if (m === 'POST' && rest.length === 2 && rest[1] === 'commands' && rest[0] !== 'failures') {
      return success(await inbox.command(principal, rest[0], await body(request), key(request), requestId), 200, requestId);
    }
    if (m === 'GET' && rest.length === 1) return success(await inbox.detail(principal, rest[0]), 200, requestId);
    throw notFound();
  } catch (error) { return failure(error, requestId); }
}
