import {readFile,readdir} from 'node:fs/promises';
import {Pool} from 'pg';
if(!process.env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL is required; do not use the web runtime login.');
const pool=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:1});
const client=await pool.connect();
try {
 await client.query("SELECT pg_advisory_lock(hashtext('libetech-ai-os-migrations'))");
 const existing=await client.query<{table_name:string|null}>("SELECT to_regclass('public.schema_migrations')::text AS table_name");
 const applied=existing.rows[0].table_name
  ? new Set((await client.query<{version:string}>('SELECT version FROM public.schema_migrations')).rows.map(row=>row.version))
  : new Set<string>();
 for(const file of (await readdir('migrations')).filter(f=>/^\d+.*\.sql$/.test(f)).sort()) {
  const version=file.match(/^\d+/)?.[0];
  if(version&&applied.has(version)) continue;
  try {await client.query(await readFile('migrations/'+file,'utf8'));}
  catch(error) {console.error(JSON.stringify({event:'migration_failed',file}));throw error;}
  console.log(JSON.stringify({event:'migration_applied',file}));
 }
 // Unlock on success only. After a failure the connection may still be inside the file's aborted transaction, or gone, and a query sent on it (this one, or a ROLLBACK first) raises an error
 // that takes the place of the migration's own. Closing the connection ends the session: PostgreSQL then rolls the open transaction back and releases the advisory lock.
 await client.query("SELECT pg_advisory_unlock(hashtext('libetech-ai-os-migrations'))");
} finally {client.release();await pool.end();}
