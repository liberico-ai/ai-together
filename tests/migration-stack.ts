import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import type {Harness} from './slice1-db';

// The cases that roll 023 back need every later migration off first (each rollback refuses while a later version is recorded). The later ones are read from the directory, not named,
// so a migration added on top of 024 (025, 026, 027, …) does not need a line in each of those cases.
const dir=(p:string)=>path.join(process.cwd(),p);
const num=(f:string)=>Number(f.match(/^\d+/)![0]);
/** Rolls back every migration numbered above `version`, newest first; answers their forward files in forward order for putBack. */
export async function takeOffAbove(h:Harness,version:number):Promise<string[]>{
  const files=(await readdir(dir('migrations'))).filter(f=>/^\d+.*\.sql$/.test(f)&&num(f)>version).sort();
  for(const f of [...files].reverse()) await h.exec(await readFile(dir('migrations/rollback/'+f),'utf8'));
  return files;
}
/** Applies the forward files again, oldest first (every migration is idempotent). */
export async function putBack(h:Harness,files:string[]):Promise<void>{
  for(const f of files) await h.exec(await readFile(dir('migrations/'+f),'utf8'));
}
