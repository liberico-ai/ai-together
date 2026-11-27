import {execFile} from 'node:child_process';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {pooledDatabase,type Database} from '../src/server/db';
import {assertIsolated,native} from './slice1-db';

// scripts/migrate.ts run as the operator runs it: a process of its own with one pg connection. The other migration tests hand each file to the database themselves, so none of them reaches the
// runner's error path. The runner reads `migrations/` from its working directory, so each case gives it a directory of synthetic files and a new empty database.
const RUNNER=['--import',pathToFileURL(path.join(process.cwd(),'node_modules/tsx/dist/loader.mjs')).href,path.join(process.cwd(),'scripts/migrate.ts')];

type Run={code:number;stdout:string;stderr:string};
const lines=(text:string)=>text.split('\n').filter(Boolean);
const applied=(file:string)=>JSON.stringify({event:'migration_applied',file});
const failed=(file:string)=>JSON.stringify({event:'migration_failed',file});

/** The statements of a migration that creates one table and records itself; `last` runs after both, so a failure there has work to undo. */
const step=(version:string,table:string,last='')=>`CREATE TABLE public.${table}(id int);
INSERT INTO public.schema_migrations VALUES ('${version}');
${last}`;
const inTransaction=(sql:string)=>`BEGIN;\n${sql}\nCOMMIT;\n`;
const LEDGER=inTransaction(`CREATE TABLE public.schema_migrations(version text PRIMARY KEY);
INSERT INTO public.schema_migrations VALUES ('001');`);
const REFUSAL='002: refused, a person has to decide about these rows first';
const refuse=`DO $$ BEGIN RAISE EXCEPTION '${REFUSAL}'; END $$;`;

describe.skipIf(!native)('scripts/migrate.ts as a process (native PostgreSQL only: PGlite serves no pg connection)',()=>{
  let admin:Database,serial=0;
  const databases:string[]=[],directories:string[]=[];
  beforeAll(()=>{
    const url=process.env.SLICE1_TEST_DATABASE_URL!;
    assertIsolated(url);
    admin=pooledDatabase(url);
  });
  afterAll(async()=>{
    for(const name of databases) await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin?.close();
    for(const directory of directories) await rm(directory,{recursive:true,force:true});
  });

  async function target(files:Record<string,string>){
    const url=new URL(process.env.SLICE1_TEST_DATABASE_URL!),name=`slice1_verify_${Date.now()}${String(++serial).padStart(2,'0')}`;
    url.pathname='/'+name;
    assertIsolated(url.toString());
    await admin.query(`CREATE DATABASE "${name}"`);
    databases.push(name);
    const directory=await mkdtemp(path.join(tmpdir(),'migrate-runner-'));
    directories.push(directory);
    await mkdir(path.join(directory,'migrations'));
    const write=(file:string,sql:string)=>writeFile(path.join(directory,'migrations',file),sql);
    for(const [file,sql] of Object.entries(files)) await write(file,sql);
    // A hang is not a refusal: the timeout reports -1, and the cases ask for the exit code by value.
    const run=()=>new Promise<Run>(resolve=>execFile(process.execPath,RUNNER,{cwd:directory,encoding:'utf8',timeout:20000,env:{...process.env,MIGRATION_DATABASE_URL:url.toString()}},
      (error,stdout,stderr)=>resolve({code:error?(typeof error.code==='number'?error.code:-1):0,stdout,stderr})));
    const state=async()=>{
      const db=pooledDatabase(url.toString());
      try{return (await db.query<{tables:string[];versions:string[]}>(`SELECT
        ARRAY(SELECT tablename::text FROM pg_tables WHERE schemaname='public' ORDER BY 1) AS tables,
        ARRAY(SELECT version FROM public.schema_migrations ORDER BY 1) AS versions`)).rows[0];}
      finally{await db.close();}
    };
    return {write,run,state};
  }

  it('prints one migration_applied line per file, then skips every recorded version',async()=>{
    const db=await target({'001_ledger.sql':LEDGER,'002_second.sql':inTransaction(step('002','second')),'003_third.sql':inTransaction(step('003','third'))});
    const first=await db.run();
    expect(first.code,first.stderr).toBe(0);
    expect(lines(first.stdout)).toEqual([applied('001_ledger.sql'),applied('002_second.sql'),applied('003_third.sql')]);
    expect(await db.state()).toEqual({tables:['schema_migrations','second','third'],versions:['001','002','003']});
    const again=await db.run();
    expect(again.code,again.stderr).toBe(0);
    expect(lines(again.stdout)).toEqual([]);
  });

  it.each([
    {shape:'a refusal inside the file\'s own BEGIN',sql:inTransaction(step('002','half_applied',refuse)),message:REFUSAL},
    {shape:'a refusal in a file without BEGIN',sql:step('002','half_applied',refuse),message:REFUSAL},
    // The server ends the session, so nothing more can be sent on it: whatever the runner does while it closes must not take the place of this message.
    {shape:'a failure that ends the connection',sql:inTransaction(step('002','half_applied','SELECT pg_terminate_backend(pg_backend_pid());')),message:'terminating connection due to administrator command'},
  ])('shows the database message and the failed file for $shape, applies nothing of it, and runs again once corrected',async({sql,message})=>{
    const db=await target({'001_ledger.sql':LEDGER,'002_fails.sql':sql,'003_later.sql':inTransaction(step('003','later'))});
    const run=await db.run();
    expect(run.code,run.stderr).toBe(1);
    expect.soft(run.stderr).toContain(message);
    expect.soft(lines(run.stderr)).toContain(failed('002_fails.sql'));
    expect(lines(run.stdout)).toEqual([applied('001_ledger.sql')]);
    expect(await db.state()).toEqual({tables:['schema_migrations'],versions:['001']});
    // The failed run left no lock and no open transaction behind: the next one takes the migration lock and starts at the failed file.
    await db.write('002_fails.sql',inTransaction(step('002','half_applied')));
    const corrected=await db.run();
    expect(corrected.code,corrected.stderr).toBe(0);
    expect(lines(corrected.stdout)).toEqual([applied('002_fails.sql'),applied('003_later.sql')]);
  });
});
