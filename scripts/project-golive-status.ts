import { pooledDatabase } from '../src/server/db';
import { AppError } from '../src/server/errors';
import { projectGoliveStatus } from '../src/server/golive-status';

// Z1 → Z2 GO LIVE status of every project with an enabled golive_status target (GIAO VIỆC 5 F). Operator login only (OQ-22). Prints counts only.
const url = process.env.MIGRATION_DATABASE_URL, tenantId = process.env.LIBETECH_TENANT_ID;
if (!url || !tenantId) throw new Error('MIGRATION_DATABASE_URL (operator login) and LIBETECH_TENANT_ID are required.');
const db = pooledDatabase(url);
const done = { event: 'golive_status_projected', projects: 0, members: 0, refused: 0, failed: 0 };
try {
  const targets = (await db.query<{ project_id: string }>("SELECT project_id FROM reminder_targets WHERE tenant_id=$1 AND enabled AND kind='golive_status' ORDER BY project_id", [tenantId])).rows;
  for (const t of targets) {
    try { done.members += (await projectGoliveStatus(db, tenantId, t.project_id)).members; done.projects++; }
    catch (error) { if (error instanceof AppError && error.code === 'REMINDER_PROJECT_REFUSED') done.refused++; else done.failed++; }
  }
  console.log(JSON.stringify(done));
  if (done.failed) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ level: 'error', event: 'golive_status_failed', errorType: error instanceof Error ? error.name : 'unknown' }));
  process.exitCode = 1;
} finally { await db.close(); }
