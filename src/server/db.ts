import { PGlite, TransactionAbortedError } from '@electric-sql/pglite';
import { Pool, type PoolClient } from 'pg';
import { readFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { Principal } from './types';
import { AppError } from './errors';
export interface Queryable { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> }
export interface Database extends Queryable { transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>; close(): Promise<void> }
/**
 * The transaction ended in ROLLBACK although the callback returned: a statement inside it failed, the callback caught the error and went on, and COMMIT of an aborted transaction is
 * answered with the command ROLLBACK and no error. Nothing was written, so the caller must not see a success. The sentence is fixed: it carries nothing the database said (no table,
 * no constraint, no SQLSTATE), because it ends up in logs and in answers.
 */
export class TransactionNotCommittedError extends Error {
  constructor() { super('The transaction was rolled back and nothing was written.'); this.name = 'TransactionNotCommittedError'; }
}
/** PGlite as a Database. PGlite notices a COMMIT that answered ROLLBACK itself and throws its own error; the caller gets the same fixed error as from the pooled database. */
export function pgliteDatabase(pg: PGlite): Database {
  return {
    query: (sql, params) => pg.query(sql, params),
    async transaction(fn) {
      try { return await pg.transaction(tx => fn({ query: (sql, params) => tx.query(sql, params) })); }
      catch (error) { throw error instanceof TransactionAbortedError ? new TransactionNotCommittedError() : error; }
    },
    close: () => pg.close(),
  };
}
export async function embeddedDatabase(dataDir?: string): Promise<Database> {
  const pg = await PGlite.create(dataDir);
  for (const file of (await readdir(path.join(process.cwd(),'migrations'))).filter(f=>/^\d+.*\.sql$/.test(f)).sort()) await pg.exec(await readFile(path.join(process.cwd(),'migrations',file),'utf8'));
  return pgliteDatabase(pg);
}
/**
 * Refuses a login that owns tables, holds an elevated attribute, can reach more than one of the application roles, or can reach
 * the outbox audit role or the AI role (021: the service writes Z1, the pipeline writes Z4, never one login both). The 017 state-event
 * actor is proven by role only while no login can act as both libetech_runtime and libetech_intake and nobody can act as
 * libetech_outbox_audit (Database review I-1). No row for the current role also refuses.
 */
export async function assertRestrictedLogin(q: Queryable): Promise<void> {
  const row = (await q.query(`SELECT r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relowner=r.oid AND n.nspname IN ('public','identity','analytics','intelligence')) AS owns_tables,
      (SELECT count(*) FROM pg_roles g WHERE g.rolname IN ('libetech_runtime','libetech_intake','libetech_identity','libetech_outbox_audit')
        AND pg_has_role(r.oid,g.oid,'MEMBER'))>1 AS several_app_roles,
      EXISTS(SELECT 1 FROM pg_roles g WHERE g.rolname='libetech_outbox_audit' AND pg_has_role(r.oid,g.oid,'MEMBER')) AS audit_role,
      EXISTS(SELECT 1 FROM pg_roles g WHERE g.rolname='libetech_ai' AND pg_has_role(r.oid,g.oid,'MEMBER')) AS ai_role
    FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
  if (!row || Object.values(row).some(Boolean))
    throw new Error('Runtime login must not own tables, hold elevated database privileges or reach more than one application role.');
}
// Since migration 023 a transaction of the intake path that stays open holds the counter row of its thread and every other message of that thread waits for it (55P03 after 5 seconds, each
// time). So an idle transaction has to end by itself: every session of every pool starts with this timeout (a session parameter sent at connect, which a role default of 0 cannot undo), and a
// pool for a runtime login reads it back before it serves anything (N1 of DELIVERY-016).
export const IDLE_IN_TRANSACTION_TIMEOUT_MS = 30000;
export async function assertSessionTimeouts(q: Queryable): Promise<void> {
  const ms = Number((await q.query<{ ms: string }>("SELECT setting AS ms FROM pg_settings WHERE name='idle_in_transaction_session_timeout'")).rows[0]?.ms);
  if (!Number.isInteger(ms) || ms < 1 || ms > IDLE_IN_TRANSACTION_TIMEOUT_MS)
    throw new Error(`Runtime login must end an idle transaction by itself (idle_in_transaction_session_timeout between 1 ms and ${IDLE_IN_TRANSACTION_TIMEOUT_MS} ms).`);
}
export function pooledDatabase(url: string, requireRestricted=false, options: { idleInTransactionMs?: number } = {}): Database {
  const pool = new Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 10000, idle_in_transaction_session_timeout: options.idleInTransactionMs ?? IDLE_IN_TRANSACTION_TIMEOUT_MS });
  // An idle pooled connection that the server ends (a restart, a failover, pg_terminate_backend) raises 'error' on the pool; without a listener that error stops the process, and its
  // dump would carry the client (host, port, user, database). Only a fixed event and the SQLSTATE are logged: never the message, never the client.
  pool.on('error', e => console.error(JSON.stringify({ level: 'error', event: 'pool_idle_client_error', sqlstate: (e as { code?: string }).code ?? null })));
  let checked:Promise<void>|undefined;
  const check=()=>checked??=(async()=>{
    if(!requireRestricted) return;
    const q: Queryable = { query: async <T>(sql: string, params?: unknown[]) => ({ rows: (await pool.query(sql, params)).rows as T[] }) };
    await assertRestrictedLogin(q);
    await assertSessionTimeouts(q);
  })();
  const queryOn = (client: PoolClient): Queryable => ({ query: async <T>(sql: string, params?: unknown[]) => ({ rows: (await client.query(sql, params)).rows as T[] }) });
  return {
    query: async <T>(sql: string, params?: unknown[]) => { await check(); return { rows: (await pool.query(sql, params)).rows as T[] }; },
    async transaction(fn) {
      await check();
      const client = await pool.connect();
      // The server ends a session that idles in a transaction past the timeout: the client then raises 'error' on itself, and with no listener that error would stop the process.
      // The caller gets the error of its own statement; a rollback on a dead connection must not replace it, and the dead connection is dropped, not handed out again.
      let broken: Error | undefined;
      const onError = (e: Error) => { broken ??= e; };
      client.on('error', onError);
      // COMMIT of an aborted transaction raises no error: the server answers with the command ROLLBACK. That happens when a statement of the callback failed and the callback caught the error and
      // returned. Nothing was written, so the caller gets a fixed error and not the callback's value. The session is idle again after that answer, so it goes back to the pool (no second ROLLBACK).
      let open = true;
      try {
        await client.query('BEGIN');
        const result = await fn(queryOn(client));
        const committed = await client.query('COMMIT');
        open = false;
        if (committed.command !== 'COMMIT') throw new TransactionNotCommittedError();
        return result;
      }
      catch (error) {
        try { if (!broken && open) await client.query('ROLLBACK'); } catch (rollbackError) { broken ??= rollbackError as Error; }
        throw error;
      } finally {
        client.removeListener('error', onError);
        // the cause of a dropped connection is not in the error the caller gets ("not queryable"): a fixed event with the SQLSTATE says it (25P03 is the idle timeout), never the message
        if (broken) console.error(JSON.stringify({ level: 'error', event: 'db_session_ended', sqlstate: (broken as { code?: string }).code ?? null }));
        client.release(broken);
      }
    }, close: () => pool.end(),
  };
}
export async function scoped<T>(db: Database, principal: Principal, fn: (tx: Queryable) => Promise<T>): Promise<T> {
  if (!principal?.id || !principal.tenantId || !principal.projectIds.length) throw new AppError('UNAUTHENTICATED', 'Cần phiên làm việc có phạm vi dự án.', 401);
  return db.transaction(async tx => {
    await tx.query('SET LOCAL ROLE libetech_runtime');
    await tx.query("SELECT set_config('app.tenant_id', $1, true), set_config('app.project_ids', $2, true)", [principal.tenantId, principal.projectIds.join(',')]);
    return fn(tx);
  });
}
const globalDb = globalThis as unknown as { libetechDb?: Promise<Database> };
export async function database(): Promise<Database> {
  globalDb.libetechDb ??= (async () => {
    if (process.env.DATABASE_URL) {
      if (process.env.LIBETECH_DEMO === '1') throw new Error('Demo cannot connect to an external database.');
      const db = pooledDatabase(process.env.DATABASE_URL,true);
      const role = await db.query<{ rolsuper: boolean; rolbypassrls: boolean }>('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user');
      if (role.rows[0].rolsuper || role.rows[0].rolbypassrls) { await db.close(); throw new Error('Runtime database role must not be superuser or BYPASSRLS.'); }
      return db;
    }
    if (process.env.LIBETECH_DEMO !== '1') throw new Error('Database is not configured.');
    const dataDir = path.join(process.cwd(), '.data', 'postgres');
    await mkdir(dataDir, { recursive: true });
    const db = await embeddedDatabase(dataDir);
    const { seed } = await import('./seed');
    await seed(db);
    return db;
  })();
  return globalDb.libetechDb;
}
