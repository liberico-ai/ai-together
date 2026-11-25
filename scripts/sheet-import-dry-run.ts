/**
 * Dry run of the work-list import on an exported CSV, in memory only (GIAO VIỆC 5, hạng mục C; docs/plans/gv5-c-sheet-import.md mục 10).
 *
 *   umask 077
 *   npx tsx scripts/sheet-import-dry-run.ts --file <export.csv> --source-url '<sheet link>' --sheet 'Đầu việc Tech' --detail <detail.json> --receipt <receipt.json>
 *
 * The script takes no connection string and reads no environment variable for a database: it builds an embedded PGlite database in memory, applies every migration,
 * makes a fake tenant, three fake Team Tech projects and a fake importer on the Team Tech roster, then runs preview → commit → a second commit of the same file, and
 * checks that the second commit made no new request. Nothing it does can reach a serving database or another platform.
 *
 * `detail.json` (mode 0600) carries cell text for the people who compare it with the sheet (never the note column, and for an IBS HI row only the pointers, labels and
 * flags). `receipt.json` carries counts per sheet BU label (flags and reason codes counted per label), the reason codes by row number, and no cell text: only its content may be copied into a delivery receipt.
 * Counts are per group; no key sums across groups.
 */
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { embeddedDatabase } from '../src/server/db';
import { SheetImportService, type ImportPreview, type ImportReceipt } from '../src/server/sheet-import';
import type { Principal } from '../src/server/types';

function args(): { file: string; sourceUrl: string; sheet: string; detail: string; receipt: string } {
  const out: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    if (!key || !['file', 'source-url', 'sheet', 'detail', 'receipt'].includes(key) || argv[i + 1] === undefined) throw new Error('Usage: --file --source-url --sheet --detail --receipt (each with a value).');
    out[key] = argv[i + 1];
  }
  for (const key of ['file', 'source-url', 'detail', 'receipt']) if (!out[key]) throw new Error(`--${key} is required.`);
  // the outputs hold team data (detail.json) or its counts: never inside the repository, where a commit could pick them up
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (const key of ['detail', 'receipt']) {
    const rel = path.relative(repo, path.resolve(out[key]));
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) throw new Error(`--${key} must be outside the repository.`);
  }
  return { file: out.file, sourceUrl: out['source-url'], sheet: out.sheet ?? 'Đầu việc Tech', detail: out.detail, receipt: out.receipt };
}
const write = async (path: string, value: unknown) => { await writeFile(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); await chmod(path, 0o600); };

async function main() {
  const a = args();
  const fileBase64 = (await readFile(a.file)).toString('base64');
  const db = await embeddedDatabase();   // PGlite in memory: no data directory, no connection string
  const tenant = randomUUID(), importer = randomUUID(), anchor = randomUUID();
  const project = { LBRC: randomUUID(), XECA: randomUUID(), 'IBS HI': randomUUID() };
  await db.transaction(async tx => {
    for (const [bu, id] of Object.entries(project)) await tx.query('INSERT INTO projects(id,tenant_id,name,bu) VALUES($1,$2,$3,$4)', [id, tenant, `${bu} · Team Tech`, bu]);
    await tx.query("INSERT INTO projects(id,tenant_id,name,bu) VALUES($1,$2,'Dự án neo của người nhập thử','Thử')", [anchor, tenant]);
    await tx.query("INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'dry-run-importer','Người nhập thử','viewer','fixture-only')", [importer, tenant]);
    await tx.query("INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'viewer')", [tenant, importer, anchor]);
    await tx.query('INSERT INTO identity.tech_roster(tenant_id,user_id) VALUES($1,$2)', [tenant, importer]);
  });
  const who: Principal = { id: importer, tenantId: tenant, projectIds: [anchor], name: 'Người nhập thử', role: 'viewer', grants: [{ projectId: anchor, role: 'viewer', reportPermissions: [] }] };
  const svc = new SheetImportService(db, async () => []);   // no people: every owner stays blank and flagged
  const envelope = { fileBase64, sourceUrl: a.sourceUrl, sheet: a.sheet };
  const commit = async (pre: ImportPreview): Promise<ImportReceipt> => svc.commit(who, { ...envelope, previewDigest: pre.previewDigest, requestKey: randomUUID(),
    projects: pre.buLabels.filter(b => b.defaultProjectId).map(b => ({ buLabel: b.label, projectId: b.defaultProjectId as string })), owners: [] });

  const pre = await svc.preview(who, envelope);
  const first = await commit(pre);
  const pre2 = await svc.preview(who, envelope);
  const second = await commit(pre2);

  const labelOf = new Map(pre.rows.map(r => [r.row, r.buLabel]));
  const perLabel = (r: ImportReceipt, result: string) => Object.fromEntries(pre.buLabels.map(b => [b.label, r.results.filter(x => labelOf.get(x.row) === b.label && x.result === result).length]));
  const newOnSecond = perLabel(second, 'imported');
  const stillWritten = Object.values(newOnSecond).some(n => n > 0);
  const flagsByLabel = Object.fromEntries(pre.buLabels.map(b => [b.label, first.results.filter(x => labelOf.get(x.row) === b.label).flatMap(x => x.flags)
    .reduce<Record<string, number>>((m, f) => { m[f] = (m[f] ?? 0) + 1; return m; }, {})]));

  const reasonsByLabel = Object.fromEntries(pre.buLabels.map(b => [b.label, first.results.filter(x => labelOf.get(x.row) === b.label).flatMap(x => x.reasons)
    .reduce<Record<string, number>>((m, r) => { m[r] = (m[r] ?? 0) + 1; return m; }, {})]));
  const reasonsByBuLabel = reasonsByLabel;
  await write(a.detail, {
    note: 'Cell text for comparison with the sheet, local file mode 0600. The note column is never included; Rows read title-only (IBS HI, or no target project) carry pointers, labels and flags only.',
    // redaction follows the service's own per-row flag (the predicate that drops the note); the script has no rule of its own
    rows: pre.rows.map(r => r.titleOnly
      ? { row: r.row, stt: r.stt, buLabel: r.buLabel, status: r.status, due: r.due, result: r.result, reasons: r.reasons, flags: r.flags }
      : { row: r.row, stt: r.stt, buLabel: r.buLabel, code: r.code, title: r.title, owner: r.owner, collaborators: r.collaborators, status: r.status, due: r.due, result: r.result, reasons: r.reasons, flags: r.flags }),
  });
  await write(a.receipt, {
    kind: 'sheet_import_dry_run_v1', fileHash: pre.fileHash,
    // per sheet BU label only: the projects of this run are fake, so there is no reporting domain to count under; no key sums across labels
    countsByBuLabel: first.counts.byBuLabel,
    flagsByBuLabel: flagsByLabel, reasonsByBuLabel,
    rows: first.results.map(r => ({ row: r.row, result: r.result, reasons: r.reasons, flags: r.flags })),
    secondRunNewRequestsByBuLabel: newOnSecond,
    note: 'Counts are per group; no key sums across groups. In-memory database, fake tenant, projects and importer; owners left blank. Counts per sheet BU label only.',
  });
  await db.close();
  if (stillWritten) { console.error('The second run wrote new requests; idempotency failed.'); process.exitCode = 1; return; }
  console.log(JSON.stringify({ ok: true, groups: pre.buLabels.length }));
}
main().catch(e => { console.error(JSON.stringify({ level: 'error', event: 'sheet_import_dry_run_failed', errorType: e instanceof Error ? e.name : 'unknown', code: (e as { code?: string }).code ?? null })); process.exitCode = 1; });
