import { PGlite } from '@electric-sql/pglite';
import { Pool, type PoolClient } from 'pg';
import { readFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { Principal } from './types';
import { AppError } from './errors';
export interface Queryable { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> }
export interface Database extends Queryable { transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>; close(): Promise<void> }
export async function embeddedDatabase(dataDir?: string): Promise<Database> {
  const pg = await PGlite.create(dataDir);
  for (const file of (await readdir(path.join(process.cwd(),'migrations'))).filter(f=>/^\d+.*\.sql$/.test(f)).sort()) await pg.exec(await readFile(path.join(process.cwd(),'migrations',file),'utf8'));
  return { query: (sql, params) => pg.query(sql, params), transaction: fn => pg.transaction(tx => fn({ query: (sql, params) => tx.query(sql, params) })), close: () => pg.close() };
}
/**
 * Refuses a login that owns tables, holds an elevated attribute, can reach more than one of the application roles, or can reach
 * the outbox audit role. The 017 state-event actor is proven by role only while no login can act as both libetech_runtime and
 * libetech_intake and nobody can act as libetech_outbox_audit (Database review I-1). No row for the current role also refuses.
 */
export async function assertRestrictedLogin(q: Queryable): Promise<void> {
  const row = (await q.query(`SELECT r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relowner=r.oid AND n.nspname IN ('public','identity','analytics')) AS owns_tables,
      (SELECT count(*) FROM pg_roles g WHERE g.rolname IN ('libetech_runtime','libetech_intake','libetech_identity','libetech_outbox_audit')
        AND pg_has_role(r.oid,g.oid,'MEMBER'))>1 AS several_app_roles,
      EXISTS(SELECT 1 FROM pg_roles g WHERE g.rolname='libetech_outbox_audit' AND pg_has_role(r.oid,g.oid,'MEMBER')) AS audit_role
    FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
  if (!row || Object.values(row).some(Boolean))
    throw new Error('Runtime login must not own tables, hold elevated database privileges or reach more than one application role.');
}
export function pooledDatabase(url: string, requireRestricted=false): Database {
  const pool = new Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  let checked:Promise<void>|undefined;
  const check=()=>checked??=(async()=>{
    if(!requireRestricted) return;
    await assertRestrictedLogin({ query: async <T>(sql: string, params?: unknown[]) => ({ rows: (await pool.query(sql, params)).rows as T[] }) });
  })();
  const queryOn = (client: PoolClient): Queryable => ({ query: async <T>(sql: string, params?: unknown[]) => ({ rows: (await client.query(sql, params)).rows as T[] }) });
  return {
    query: async <T>(sql: string, params?: unknown[]) => { await check(); return { rows: (await pool.query(sql, params)).rows as T[] }; },
    async transaction(fn) {
      await check();
      const client = await pool.connect();
      try { await client.query('BEGIN'); const result = await fn(queryOn(client)); await client.query('COMMIT'); return result; }
      catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
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
