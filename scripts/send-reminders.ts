import { loadBridgeConfig } from '../src/server/bridge-config';
import { pooledDatabase } from '../src/server/db';
import { reminderCounts, sendReminders } from '../src/server/reminders';

// One scheduler pass (GIAO VIỆC 5 F). Login: libetech_reminder_svc (REMINDER_DATABASE_URL), which can only queue reminders to enabled targets; the gateway's
// outbox timer sends them. Prints counts only, never a chat id, a name or the URL. `--status` prints how far the queued reminders got.
const url = process.env.REMINDER_DATABASE_URL, tenantId = process.env.LIBETECH_TENANT_ID;
if (!url || !tenantId) throw new Error('REMINDER_DATABASE_URL and LIBETECH_TENANT_ID are required; use the reminder login, never the web or migration one.');
const db = pooledDatabase(url, true);
try {
  if (process.argv.includes('--status')) console.log(JSON.stringify({ event: 'reminder_counts', counts: await reminderCounts(db, tenantId) }));
  else {
    // the server config (LIBETECH_BRIDGE_CONFIG) says which project each group serves; without it nothing is queued (intake_scope_unchecked)
    const config = await loadBridgeConfig().catch(() => null);
    const run = await sendReminders(db, { tenantId, now: new Date(), config });
    console.log(JSON.stringify({ event: 'reminders_run', ...run }));
    if (run.skipped.failed || run.skipped.intake_scope_unchecked) process.exitCode = 1;
  }
} catch (error) {
  console.error(JSON.stringify({ level: 'error', event: 'reminders_run_failed', errorType: error instanceof Error ? error.name : 'unknown' }));
  process.exitCode = 1;
} finally { await db.close(); }
