import { readFile, writeFile } from 'node:fs/promises';
import { inspectSourceSnapshot } from '../src/server/source-snapshot';

async function main() {
  const [current, output, previous] = process.argv.slice(2);
  if(!current || !output) throw new Error('Usage: tsx scripts/inspect-source-snapshot.ts current.json output.json [previous.json]');
  const input = JSON.parse(await readFile(current,'utf8'));
  const old = previous ? JSON.parse(await readFile(previous,'utf8')) : undefined;
  const report = inspectSourceSnapshot(input,old);
  // Output is a derived report. The input and upstream Sheet remain untouched.
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  process.stdout.write(JSON.stringify({output,counts:report.counts,snapshot_hash:report.snapshot_hash})+'\n');
}
main().catch(error=>{process.stderr.write(String(error instanceof Error?error.message:error)+'\n');process.exitCode=1;});
