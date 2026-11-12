import { z } from 'zod';
import { authenticatedPrincipal, checkOrigin } from './auth';
import type { Database } from './db';
import { exportDocumentsCsv, findDocuments } from './document-index';
import { DocumentService } from './documents';
import { AppError } from './errors';
import { body, failure, success } from './http';
import { ProjectRegistryService } from './projects-registry';

const notFound = () => new AppError('NOT_FOUND', 'Không có đường dẫn này.', 404);
const key = (request: Request) => request.headers.get('idempotency-key') ?? '';
const exportQuery = z.object({ projectId: z.uuid() }).strict();

/** Query string -> raw object; the service schema (strict) decides what is valid. */
function query(request: Request): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of new URL(request.url).searchParams) out[k] = k === 'limit' || k === 'offset' ? Number(v) : v;
  return out;
}

/** Thin adapter: principal from the session, call the service, wrap success/failure. */
export async function handleDocumentsApi(request: Request, parts: string[], db: Database): Promise<Response> {
  try {
    const principal = await authenticatedPrincipal(request);
    const m = request.method;
    if (m !== 'GET') checkOrigin(request);
    if (parts[0] === 'documents') {
      const docs = new DocumentService(db);
      const rest = parts.slice(1);
      if (m === 'GET' && rest.length === 0) return success(await findDocuments(db, principal, query(request)));
      if (m === 'GET' && rest.length === 1 && rest[0] === 'search') return success(await findDocuments(db, principal, query(request)));
      if (m === 'GET' && rest.length === 1 && rest[0] === 'export') {
        const { projectId } = exportQuery.parse(query(request));
        const csv = await exportDocumentsCsv(db, principal, projectId);
        return new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="tai-lieu.csv"', 'Cache-Control': 'no-store' } });
      }
      if (m === 'POST' && rest.length === 1 && rest[0] === 'register') return success(await docs.register(principal, await body(request), key(request)), 201);
      if (m === 'POST' && rest.length === 2 && rest[1] === 'revision-proposals') return success(await docs.proposeRevision(principal, rest[0], await body(request), key(request)));
      if (m === 'GET' && rest.length === 1) return success(await docs.detail(principal, rest[0]));
      if (m === 'GET' && rest.length === 2 && rest[1] === 'source') return success(await docs.openSource(principal, rest[0]));
    }
    if (parts[0] === 'projects' && parts.length === 3) {
      const registry = new ProjectRegistryService(db);
      if (m === 'GET' && parts[2] === 'registry') return success(await registry.registry(principal, parts[1]));
      if (m === 'PUT' && parts[2] === 'profile') return success(await registry.saveProfile(principal, parts[1], await body(request), key(request)));
      if (m === 'POST' && parts[2] === 'channels') return success(await registry.proposeChannel(principal, parts[1], await body(request), key(request)));
    }
    throw notFound();
  } catch (error) { return failure(error); }
}
