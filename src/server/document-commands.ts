import { createHash } from 'node:crypto';
import type { Queryable } from './db';
import { AppError, invariant } from './errors';
import type { Principal } from './types';

/** Document idempotency: unique per person across projects (OQ-24 b). A key owned by a project hidden by RLS also conflicts. */
export async function claimDocumentCommand<T>(tx: Queryable, p: Principal, projectId: string, key: string, input: unknown, action: () => Promise<T>): Promise<T> {
  invariant(/^[A-Za-z0-9_-]{8,100}$/.test(key), 'IDEMPOTENCY_REQUIRED', 'Cần mã thao tác hợp lệ để chống ghi lặp.', 400);
  const conflict = () => new AppError('IDEMPOTENCY_CONFLICT', 'Mã thao tác đã được dùng với nội dung khác.', 409);
  const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  let created: { id: string } | undefined;
  try {
    created = (await tx.query<{ id: string }>(`INSERT INTO document_commands(tenant_id,project_id,actor_id,command_key,request_hash) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(tenant_id,actor_id,command_key) DO NOTHING RETURNING id`, [p.tenantId, projectId, p.id, key, hash])).rows[0];
  } catch (e) {
    if ((e as { code?: string })?.code === '23505') throw conflict();
    throw e;
  }
  if (!created) {
    const old = (await tx.query<{ request_hash: string; response: T }>('SELECT request_hash,response FROM document_commands WHERE tenant_id=$1 AND actor_id=$2 AND command_key=$3',
      [p.tenantId, p.id, key])).rows[0];
    if (!old || old.request_hash !== hash) throw conflict();
    return old.response;
  }
  const result = await action();
  await tx.query('UPDATE document_commands SET response=$1, updated_at=now() WHERE id=$2', [JSON.stringify(result), created.id]);
  return result;
}
